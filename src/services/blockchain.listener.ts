import { ethers } from 'ethers';
import EscrowArtifact from '../contracts/ProofPayEscrow.json';

const EscrowABI = EscrowArtifact.abi;

interface EscrowFundedEvent {
    escrowId: string;
    amount: bigint;
    log: ethers.Log;
}

class BlockchainListener {
    private provider: ethers.JsonRpcProvider | null = null;
    private escrowContract: ethers.Contract | null = null;
    private contractAddress = process.env.ESCROW_CONTRACT_ADDRESS!;
    
    constructor() {
        if (!process.env.BASE_RPC_URL || !this.contractAddress) {
            console.warn("Blockchain environment variables not set. BlockchainListener will not be initialized.");
            return;
        }
        this.provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL);
        this.escrowContract = new ethers.Contract(
            this.contractAddress,
            EscrowABI,
            this.provider
        );
    }
    
    private isInitialized(): boolean {
        return !!this.provider && !!this.escrowContract;
    }

    /**
     * Fetches 'EscrowFunded' events for a specific list of escrow IDs.
     * @param escrowIds - An array of blockchain `escrow_id`s to check.
     * @returns A promise that resolves to an array of found funding events.
     */
    async getEscrowFundedEvents(escrowIds: string[]): Promise<EscrowFundedEvent[]> {
        if (!this.isInitialized() || !this.escrowContract) {
            throw new Error('BlockchainListener not initialized');
        }
        
        if (escrowIds.length === 0) {
            return [];
        }

        try {
            // The first argument to the filter corresponds to the first indexed event parameter (escrowId).
            // Ethers.js expects an array of values for the 'in' condition.
            const eventFilter = this.escrowContract.filters.EscrowFunded(escrowIds);

            // Check a reasonable range of recent blocks. e.g., last day on Base Sepolia (approx 43200 blocks)
            const fromBlock = await this.provider!.getBlockNumber() - 43200;

            const logs = await this.escrowContract.queryFilter(eventFilter, fromBlock, 'latest');

            const parsedEvents: EscrowFundedEvent[] = [];

            for (const log of logs) {
                if (log instanceof ethers.EventLog) {
                     parsedEvents.push({
                        escrowId: log.args.escrowId,
                        amount: log.args.amount,
                        log: log,
                    });
                }
            }

            return parsedEvents;

        } catch (error) {
            console.error('Error fetching EscrowFunded events:', error);
            throw new Error('Failed to fetch funding events from the blockchain.');
        }
    }
}

export default new BlockchainListener();
    