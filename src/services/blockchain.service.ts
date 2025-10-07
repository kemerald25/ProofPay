import { ethers } from 'ethers';
import EscrowArtifact from '../contracts/ProofPayEscrow.json';

const EscrowABI = EscrowArtifact.abi;

class BlockchainService {
    private provider: ethers.JsonRpcProvider | null = null;
    private serviceWallet: ethers.Wallet | null = null; // The app's main wallet
    private escrowContract: ethers.Contract | null = null;
    
    constructor() {
        if (!process.env.BASE_RPC_URL || !process.env.PRIVATE_KEY || !process.env.ESCROW_CONTRACT_ADDRESS) {
            console.warn("Blockchain environment variables not set. BlockchainService will not be initialized.");
            return;
        }
        this.provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL);
        this.serviceWallet = new ethers.Wallet(process.env.PRIVATE_KEY!, this.provider);
        this.escrowContract = new ethers.Contract(
            process.env.ESCROW_CONTRACT_ADDRESS,
            EscrowABI,
            this.serviceWallet // The contract instance is connected to the service wallet by default
        );
    }
    
    private isInitialized(): boolean {
        return !!this.provider && !!this.serviceWallet && !!this.escrowContract;
    }

    async createEscrow(
        buyerAddress: string,
        sellerAddress: string,
        amount: string // in USDC
    ): Promise<{ escrowId: string; txHash: string }> {
        if (!this.isInitialized() || !this.escrowContract) throw new Error('BlockchainService not initialized');
        try {
            const amountInSmallestUnit = ethers.parseUnits(amount, 6); // USDC has 6 decimals
            
            const tx = await this.escrowContract.createEscrow(
                buyerAddress,
                sellerAddress,
                amountInSmallestUnit
            );
            
            const receipt = await tx.wait();
            if (!receipt) throw new Error("Transaction receipt not found");
            
            const event = (receipt.logs as any[]).map(log => {
                try {
                    return this.escrowContract!.interface.parseLog(log);
                } catch(e) { return null; }
            }).find(log => log?.name === "EscrowCreated");
            
            if (!event) throw new Error("EscrowCreated event not found in transaction logs");
            
            return {
                escrowId: event.args.escrowId,
                txHash: receipt.hash
            };
            
        } catch (error) {
            console.error('Blockchain error in createEscrow:', error);
            throw new Error('Failed to create escrow on blockchain');
        }
    }
    
    async fundEscrowAsUser(escrowId: string, amount: string, userPrivateKey: string): Promise<string> {
        if (!this.isInitialized()) throw new Error('BlockchainService not initialized');

        const userWallet = new ethers.Wallet(userPrivateKey, this.provider!);
        const usdcContract = new ethers.Contract(process.env.USDC_CONTRACT_ADDRESS!, [
            'function approve(address spender, uint256 amount) external returns (bool)',
            'function allowance(address owner, address spender) external view returns (uint256)'
        ], userWallet);
        
        const escrowContractAsUser = new ethers.Contract(process.env.ESCROW_CONTRACT_ADDRESS!, EscrowABI, userWallet);

        try {
            const amountInSmallestUnit = ethers.parseUnits(amount, 6);

            // Approve spending
            const currentAllowance = await usdcContract.allowance(userWallet.address, await escrowContractAsUser.getAddress());
            if (currentAllowance < amountInSmallestUnit) {
                const approveTx = await usdcContract.approve(await escrowContractAsUser.getAddress(), amountInSmallestUnit);
                await approveTx.wait();
            }

            // Fund escrow
            const tx = await escrowContractAsUser.fundEscrow(escrowId);
            const receipt = await tx.wait();
            if (!receipt) throw new Error("Transaction receipt not found for fundEscrow");
            return receipt.hash;
        } catch (error) {
            console.error('Fund escrow error:', error);
            throw new Error('Failed to fund escrow as user');
        }
    }

    async ownerReleaseFunds(escrowId: string): Promise<string> {
        if (!this.isInitialized() || !this.escrowContract) throw new Error('BlockchainService not initialized');
        try {
            // This function is called by the contract owner (service wallet)
            const tx = await this.escrowContract.ownerReleaseFunds(escrowId);
            const receipt = await tx.wait();
            if (!receipt) throw new Error("Transaction receipt not found for ownerReleaseFunds");
            return receipt.hash;
        } catch (error) {
            console.error('Owner release funds error:', error);
            throw new Error('Failed to execute owner release of funds');
        }
    }
    
    async raiseDispute(escrowId: string, userPrivateKey: string): Promise<string> {
        if (!this.isInitialized()) throw new Error('BlockchainService not initialized');
        const userWallet = new ethers.Wallet(userPrivateKey, this.provider!);
        const escrowContractAsUser = new ethers.Contract(process.env.ESCROW_CONTRACT_ADDRESS!, EscrowABI, userWallet);
        try {
            const tx = await escrowContractAsUser.raiseDispute(escrowId);
            const receipt = await tx.wait();
            if (!receipt) throw new Error("Transaction receipt not found for raiseDispute");
            return receipt.hash;
        } catch (error) {
            console.error('Raise dispute error:', error);
            throw new Error('Failed to raise dispute');
        }
    }
    
    async resolveDispute(escrowId: string, buyerPercentage: number): Promise<string> {
        if (!this.isInitialized() || !this.escrowContract) throw new Error('BlockchainService not initialized');
        try {
            const tx = await this.escrowContract.resolveDispute(escrowId, buyerPercentage);
            const receipt = await tx.wait();
            if (!receipt) throw new Error("Transaction receipt not found for resolveDispute");
            return receipt.hash;
        } catch (error) {
            console.error('Resolve dispute error:', error);
            throw new Error('Failed to resolve dispute');
        }
    }
    
    async executeAutoRelease(escrowId: string): Promise<string> {
        if (!this.isInitialized() || !this.escrowContract) throw new Error('BlockchainService not initialized');
        try {
            const tx = await this.escrowContract.autoRelease(escrowId);
            const receipt = await tx.wait();
            if (!receipt) throw new Error("Transaction receipt not found for autoRelease");
            return receipt.hash;
        } catch (error) {
            console.error('Auto-release error:', error);
            throw new Error('Failed to execute auto-release');
        }
    }
}

export default new BlockchainService();
