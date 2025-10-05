import { ethers } from 'ethers';
// Correctly import the full artifact which includes the ABI
import EscrowArtifact from '../contracts/ProofPayEscrow.sol/ProofPayEscrow.json';

const EscrowABI = EscrowArtifact.abi;

class BlockchainService {
    private provider: ethers.JsonRpcProvider | null = null;
    private wallet: ethers.Wallet | null = null;
    private escrowContract: ethers.Contract | null = null;
    
    constructor() {
        if (!process.env.BASE_RPC_URL || !process.env.PRIVATE_KEY || !process.env.ESCROW_CONTRACT_ADDRESS) {
            console.warn("Blockchain environment variables not set. BlockchainService will not be initialized.");
            return;
        }
        this.provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL);
        this.wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, this.provider);
        this.escrowContract = new ethers.Contract(
            process.env.ESCROW_CONTRACT_ADDRESS,
            EscrowABI,
            this.wallet
        );
    }
    
    private isInitialized(): boolean {
        return !!this.provider && !!this.wallet && !!this.escrowContract;
    }

    async createEscrow(
        buyerAddress: string,
        sellerAddress: string,
        amount: string // in USDC (6 decimals)
    ): Promise<{ escrowId: string; txHash: string }> {
        if (!this.isInitialized() || !this.escrowContract) throw new Error('BlockchainService not initialized');
        try {
            const amountInWei = ethers.parseUnits(amount, 6); // USDC has 6 decimals
            
            const tx = await this.escrowContract.createEscrow(
                buyerAddress,
                sellerAddress,
                amountInWei
            );
            
            const receipt = await tx.wait();

            if (!receipt) {
                throw new Error("Transaction receipt not found");
            }
            
            const event = (receipt.logs as any[]).find((log) => {
                try {
                    const parsedLog = this.escrowContract!.interface.parseLog(log);
                    return parsedLog?.name === "EscrowCreated";
                } catch (e) {
                    // This log is not from our contract, ignore
                    return false;
                }
            });
            
            if (!event) {
                throw new Error("EscrowCreated event not found");
            }
            
            const parsedLog = this.escrowContract.interface.parseLog(event);
            const escrowId = parsedLog!.args.escrowId;
            
            return {
                escrowId,
                txHash: receipt.hash
            };
            
        } catch (error) {
            console.error('Blockchain error:', error);
            throw new Error('Failed to create escrow on blockchain');
        }
    }
    
    async checkEscrowStatus(escrowId: string): Promise<any> {
        if (!this.isInitialized() || !this.escrowContract) throw new Error('BlockchainService not initialized');
        try {
            const escrow = await this.escrowContract.getEscrow(escrowId);
            
            return {
                buyer: escrow.buyer,
                seller: escrow.seller,
                amount: ethers.formatUnits(escrow.amount, 6),
                status: this.getStatusString(Number(escrow.status)),
                autoReleaseTime: new Date(Number(escrow.autoReleaseTime) * 1000),
                disputeRaised: escrow.disputeRaised
            };
            
        } catch (error) {
            console.error('Status check error:', error);
            throw new Error('Failed to check escrow status');
        }
    }
    
    async releaseFunds(escrowId: string): Promise<string> {
        if (!this.isInitialized() || !this.escrowContract) throw new Error('BlockchainService not initialized');
        try {
            const tx = await this.escrowContract.releaseFunds(escrowId);
            const receipt = await tx.wait();
            return receipt.hash;
        } catch (error) {
            console.error('Release funds error:', error);
            throw new Error('Failed to release funds');
        }
    }

    async fundEscrow(escrowId: string): Promise<string> {
        if (!this.isInitialized() || !this.escrowContract) throw new Error('BlockchainService not initialized');
        try {
            const tx = await this.escrowContract.fundEscrow(escrowId);
            const receipt = await tx.wait();
            return receipt.hash;
        } catch (error) {
            console.error('Fund escrow error:', error);
            throw new Error('Failed to fund escrow');
        }
    }
    
    async raiseDispute(escrowId: string): Promise<string> {
        if (!this.isInitialized() || !this.escrowContract) throw new Error('BlockchainService not initialized');
        try {
            const tx = await this.escrowContract.raiseDispute(escrowId);
            const receipt = await tx.wait();
            return receipt.hash;
        } catch (error) {
            console.error('Raise dispute error:', error);
            throw new Error('Failed to raise dispute');
        }
    }
    
    async resolveDispute(
        escrowId: string,
        buyerPercentage: number
    ): Promise<string> {
        if (!this.isInitialized() || !this.escrowContract) throw new Error('BlockchainService not initialized');
        try {
            const tx = await this.escrowContract.resolveDispute(escrowId, buyerPercentage);
            const receipt = await tx.wait();
            return receipt.hash;
        } catch (error) {
            console.error('Resolve dispute error:', error);
            throw new Error('Failed to resolve dispute');
        }
    }
    
    async checkAutoRelease(escrowId: string): Promise<boolean> {
        if (!this.isInitialized() || !this.escrowContract) return false;
        try {
            const escrow = await this.escrowContract.getEscrow(escrowId);
            const now = Math.floor(Date.now() / 1000);
            return Number(escrow.autoReleaseTime) <= now && Number(escrow.status) === 1; // FUNDED
        } catch (error) {
            return false;
        }
    }
    
    async executeAutoRelease(escrowId: string): Promise<string> {
        if (!this.isInitialized() || !this.escrowContract) throw new Error('BlockchainService not initialized');
        try {
            const tx = await this.escrowContract.autoRelease(escrowId);
            const receipt = await tx.wait();
            return receipt.hash;
        } catch (error) {
            console.error('Auto-release error:', error);
            throw new Error('Failed to execute auto-release');
        }
    }
    
    private getStatusString(status: number): string {
        const statuses = ['CREATED', 'FUNDED', 'COMPLETED', 'DISPUTED', 'REFUNDED', 'CANCELLED'];
        return statuses[status] || 'UNKNOWN';
    }
}

export default new BlockchainService();
