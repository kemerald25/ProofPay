import { createClient } from '@supabase/supabase-js';
import BlockchainService from './blockchain.service';
import WhatsAppService from './whatsapp.service';
import UserService from './user.service';
import { Sentry } from '@/config/sentry';
import { ethers } from 'ethers';

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
);

class EscrowService {
    
    async createEscrow(params: {
        sellerPhone: string;
        buyerPhone: string;
        amount: number;
        description?: string;
        sellerWallet?: string;
    }) {
        try {
            // Get or create users
            const seller = await UserService.getOrCreateUser(params.sellerPhone);
            const buyer = await UserService.getOrCreateUser(params.buyerPhone);
            
            // Validate seller has wallet
            if (!params.sellerWallet && !seller.wallet_address) {
                // In a real app, you might ask the user to register their wallet first.
                // For the simulator, we accept a placeholder.
                if (process.env.NODE_ENV !== 'development' || !params.sellerWallet?.includes('0x0000000')) {
                     throw new Error('Seller must provide wallet address or register one.');
                }
            }
            
            const sellerWallet = params.sellerWallet || seller.wallet_address!;
            
            // If the user's wallet was just registered, update it
            if (params.sellerWallet && !seller.wallet_address) {
                await UserService.updateWalletAddress(seller.id, params.sellerWallet);
            }
            
            // Generate temporary buyer wallet for contract (or ask buyer to provide)
            const buyerWallet = buyer.wallet_address || ethers.Wallet.createRandom().address;
            
            // Create escrow on blockchain
            const { escrowId, txHash } = await BlockchainService.createEscrow(
                buyerWallet,
                sellerWallet,
                params.amount.toString()
            );
            
            // Generate short ID for easy reference
            const shortId = this.generateShortId();
            
            // Calculate auto-release time (7 days)
            const autoReleaseTime = new Date();
            autoReleaseTime.setDate(autoReleaseTime.getDate() + 7);
            
            // Save to database
            const { data, error } = await supabase
                .from('escrows')
                .insert({
                    id: shortId, // Using shortId as primary key for easier reference
                    escrow_id: escrowId,
                    buyer_id: buyer.id,
                    seller_id: seller.id,
                    buyer_phone: params.buyerPhone,
                    seller_phone: params.sellerPhone,
                    buyer_wallet: buyerWallet,
                    seller_wallet: sellerWallet,
                    amount: params.amount,
                    status: 'CREATED',
                    item_description: params.description || 'Item',
                    auto_release_time: autoReleaseTime.toISOString(),
                    tx_hash: txHash
                })
                .select()
                .single();
            
            if (error) throw error;
            
            // Record transaction
            await this.recordTransaction({
                escrowId: data.id,
                type: 'CREATE',
                txHash,
                fromAddress: process.env.PLATFORM_FEE_WALLET,
                toAddress: process.env.ESCROW_CONTRACT_ADDRESS,
                status: 'CONFIRMED'
            });
            
            return {
                escrowId: data.id,
                blockchainEscrowId: escrowId,
                amount: params.amount,
                description: params.description,
                sellerWallet,
                autoReleaseTime,
                paymentAddress: process.env.ESCROW_CONTRACT_ADDRESS,
                usdcAddress: process.env.USDC_CONTRACT_ADDRESS
            };
            
        } catch (error) {
            console.error('Create escrow error:', error);
            Sentry.captureException(error);
            throw error;
        }
    }
    
    async getEscrowByShortId(shortId: string) {
        const { data } = await supabase
            .from('escrows')
            .select('*')
            .eq('id', shortId)
            .single();
        
        return data;
    }
    
    async checkPaymentStatus(escrowId: string) {
        try {
            const escrow = await this.getEscrow(escrowId);
            if (!escrow) throw new Error('Escrow not found');
            
            const blockchainStatus = await BlockchainService.checkEscrowStatus(
                escrow.escrow_id
            );
            
            if (blockchainStatus.status === 'FUNDED' && escrow.status !== 'FUNDED') {
                const { error } = await supabase.from('escrows').update({ status: 'FUNDED', funded_at: new Date().toISOString() }).eq('id', escrowId);
                if (error) throw error;
                
                await WhatsAppService.sendMessage(
                    escrow.seller_phone,
                    `✅ Payment received! ${escrow.amount} is now in escrow. Deliver the item and buyer will confirm.`
                );
                
                await WhatsAppService.sendMessage(
                    escrow.buyer_phone,
                    `✅ Payment successful! ${escrow.amount} is secured in escrow. You'll receive the item soon. Reply "confirm ${escrowId}" when you receive it.`
                );
            }
            
            return blockchainStatus;
            
        } catch (error) {
            Sentry.captureException(error);
            throw error;
        }
    }
    
    async releaseFunds(escrowId: string, buyerPhone: string) {
        try {
            const escrow = await this.getEscrow(escrowId);
            
            if (!escrow) throw new Error('Escrow not found');
            if (escrow.buyer_phone !== buyerPhone) throw new Error('Unauthorized');
            if (escrow.status !== 'FUNDED') throw new Error('Escrow not funded');
            if (escrow.dispute_raised) throw new Error('Dispute is active');
            
            const txHash = await BlockchainService.releaseFunds(escrow.escrow_id);
            
            await supabase
                .from('escrows')
                .update({
                    status: 'COMPLETED',
                    completed_at: new Date().toISOString(),
                    release_tx_hash: txHash
                })
                .eq('id', escrowId);
            
            await this.recordTransaction({
                escrowId,
                type: 'RELEASE',
                txHash,
                fromAddress: process.env.ESCROW_CONTRACT_ADDRESS,
                toAddress: escrow.seller_wallet,
                amount: Number(escrow.amount),
                status: 'CONFIRMED'
            });
            
            await UserService.incrementTransactionCount(escrow.buyer_id, true);
            await UserService.incrementTransactionCount(escrow.seller_id, true);
            
            const netAmount = Number(escrow.amount) * 0.995;
            
            await WhatsAppService.sendMessage(
                escrow.seller_phone,
                `💰 Funds released! You received ${netAmount.toFixed(2)} (after 0.5% fee). Transaction complete!`
            );
            
            await WhatsAppService.sendMessage(
                escrow.buyer_phone,
                `✅ Transaction complete! Thanks for using BasePay. 🎉`
            );
            
            return { success: true, txHash };
            
        } catch (error) {
            Sentry.captureException(error);
            throw error;
        }
    }
    
    async getEscrow(escrowId: string) {
        const { data } = await supabase
            .from('escrows')
            .select('*')
            .eq('id', escrowId)
            .single();
        
        return data;
    }
    
    async updateEscrowStatus(escrowId: string, status: string) {
        await supabase
            .from('escrows')
            .update({ status })
            .eq('id', escrowId);
    }
    
    async getUserEscrows(userId: string) {
        const { data } = await supabase
            .from('escrows')
            .select('*')
            .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
            .order('created_at', { ascending: false })
            .limit(50);
        
        return data || [];
    }
    
    private async recordTransaction(params: {
        escrowId: string;
        type: string;
        txHash: string;
        fromAddress?: string;
        toAddress?: string;
        amount?: number;
        status?: string;
    }) {
        await supabase.from('transactions').insert({
            escrow_id: params.escrowId,
            type: params.type,
            tx_hash: params.txHash,
            from_address: params.fromAddress,
            to_address: params.toAddress,
            amount: params.amount,
            status: params.status || 'PENDING',
            confirmed_at: params.status === 'CONFIRMED' ? new Date().toISOString() : null
        });
    }
    
    private generateShortId(): string {
        return 'BP' + Math.random().toString(36).substring(2, 8).toUpperCase();
    }
}

export default new EscrowService();
