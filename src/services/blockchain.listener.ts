import { ethers } from 'ethers';
import EscrowArtifact from '../contracts/ProofPayEscrow.json';

const EscrowABI = EscrowArtifact.abi;

class BlockchainListener {
    private provider: ethers.JsonRpcProvider | null = null;
    private escrowContract: ethers.Contract | null = null;
    
    constructor() {
        if (!process.env.BASE_RPC_URL || !process.env.ESCROW_CONTRACT_ADDRESS) {
            console.warn("Blockchain environment variables not set. BlockchainListener will not be initialized.");
            return;
        }
        this.provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL);
        this.escrowContract = new ethers.Contract(
            process.env.ESCROW_CONTRACT_ADDRESS,
            EscrowABI,
            this.provider
        );
    }
    
    private isInitialized(): boolean {
        return !!this.provider && !!this.escrowContract;
    }

    /**
     * Get EscrowFunded events for specific escrow IDs
     * @param escrowIds Array of blockchain escrow IDs to check
     * @returns Array of funding events with escrowId and amount
     */
    async getEscrowFundedEvents(escrowIds: string[]): Promise<Array<{ escrowId: string; amount: string; blockNumber: number }>> {
        if (!this.isInitialized() || !this.escrowContract) {
            console.warn('BlockchainListener not initialized');
            return [];
        }

        try {
            // Get events from the last 10,000 blocks (adjust as needed)
            const currentBlock = await this.provider!.getBlockNumber();
            const fromBlock = Math.max(0, currentBlock - 10000);

            // Query EscrowFunded events
            const filter = this.escrowContract.filters.EscrowFunded();
            const events = await this.escrowContract.queryFilter(filter, fromBlock, currentBlock);

            const fundedEvents: Array<{ escrowId: string; amount: string; blockNumber: number }> = [];

            for (const event of events) {
                const parsedLog = this.escrowContract.interface.parseLog({
                    topics: [...event.topics],
                    data: event.data
                });

                if (!parsedLog) continue;

                const escrowId = parsedLog.args.escrowId;
                const amount = parsedLog.args.amount;

                // Only include events for escrows we're tracking
                if (escrowIds.includes(escrowId)) {
                    fundedEvents.push({
                        escrowId,
                        amount: ethers.formatUnits(amount, 6), // USDC has 6 decimals
                        blockNumber: event.blockNumber
                    });
                }
            }

            return fundedEvents;

        } catch (error) {
            console.error('Error fetching EscrowFunded events:', error);
            return [];
        }
    }

    /**
     * Get all events for a specific escrow
     * @param escrowId Blockchain escrow ID
     */
    async getEscrowEvents(escrowId: string) {
        if (!this.isInitialized() || !this.escrowContract) {
            return [];
        }

        try {
            const currentBlock = await this.provider!.getBlockNumber();
            const fromBlock = Math.max(0, currentBlock - 10000);

            // Get all contract events
            const allEvents = await this.escrowContract.queryFilter('*', fromBlock, currentBlock);

            const escrowEvents = allEvents
                .map(event => {
                    try {
                        const parsed = this.escrowContract!.interface.parseLog({
                            topics: [...event.topics],
                            data: event.data
                        });
                        
                        if (!parsed) return null;
                        
                        // Check if this event is for our escrow
                        if (parsed.args.escrowId === escrowId) {
                            return {
                                name: parsed.name,
                                args: parsed.args,
                                blockNumber: event.blockNumber,
                                transactionHash: event.transactionHash
                            };
                        }
                        return null;
                    } catch (e) {
                        return null;
                    }
                })
                .filter(e => e !== null);

            return escrowEvents;

        } catch (error) {
            console.error('Error fetching escrow events:', error);
            return [];
        }
    }

    /**
     * Check if a specific escrow has been funded
     * @param escrowId Blockchain escrow ID
     */
    async isEscrowFunded(escrowId: string): Promise<boolean> {
        const events = await this.getEscrowFundedEvents([escrowId]);
        return events.length > 0;
    }
}

export default new BlockchainListener();