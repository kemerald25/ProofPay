
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
    }) {
        try {
            // Get or create users and their wallets
            const seller = await UserService.getOrCreateUser(params.sellerPhone);
            const buyer = await UserService.getOrCreateUser(params.buyerPhone);
            
            const sellerWallet = seller.wallet_address;
            const buyerWallet = buyer.wallet_address;
            
            // Create escrow on blockchain using the service wallet
            const { escrowId, txHash } = await BlockchainService.createEscrow(
                buyerWallet,
                sellerWallet,
                params.amount.toString()
            );
            
            const shortId = this.generateShortId();
            
            const autoReleaseTime = new Date();
            autoReleaseTime.setDate(autoReleaseTime.getDate() + 7);
            
            const { data, error } = await supabase
                .from('escrows')
                .insert({
                    id: shortId,
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
            
            return {
                escrowId: data.id,
                blockchainEscrowId: escrowId,
                amount: params.amount,
                description: params.description,
                sellerWallet,
                autoReleaseTime,
            };
            
        } catch (error) {
            console.error('Create escrow error:', error);
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

    async fundEscrow(escrowId: string, buyerPhone: string) {
        try {
            const escrow = await this.getEscrow(escrowId);
            if (!escrow) throw new Error('Escrow not found');
            if (escrow.buyer_phone !== buyerPhone) throw new Error('Unauthorized: Only the buyer can fund this escrow.');
            if (escrow.status !== 'CREATED') throw new Error('Escrow is not in CREATED state.');

            const buyer = await UserService.getUserByPhone(buyerPhone);
            if (!buyer) throw new Error('Buyer user not found.');

            const buyerPrivateKey = await UserService.getDecryptedPrivateKey(buyer.id);

            const txHash = await BlockchainService.fundEscrowAsUser(escrow.escrow_id, escrow.amount.toString(), buyerPrivateKey);

            await this.updateEscrowStatus(escrowId, 'FUNDED', new Date().toISOString());

            await WhatsAppService.sendPaymentConfirmed(escrow.buyer_phone, 'buyer', Number(escrow.amount), escrow.id);
            await WhatsAppService.sendPaymentConfirmed(escrow.seller_phone, 'seller', Number(escrow.amount), escrow.id);
            
            return { success: true, txHash };

        } catch (error) {
            Sentry.captureException(error);
            throw error;
        }
    }
    
    async releaseFunds(escrowId: string, callingPhone: string) {
        try {
            const escrow = await this.getEscrow(escrowId);
            
            if (!escrow) throw new Error('Escrow not found');
            if (escrow.buyer_phone !== callingPhone) throw new Error('Unauthorized: Only the buyer can release funds.');
            if (escrow.status !== 'FUNDED') throw new Error('Escrow is not in a funded state.');
            if (escrow.dispute_raised) throw new Error('Dispute is active');
            
            const txHash = await BlockchainService.ownerReleaseFunds(escrow.escrow_id);
            
            await supabase
                .from('escrows')
                .update({
                    status: 'COMPLETED',
                    completed_at: new Date().toISOString(),
                    release_tx_hash: txHash
                })
                .eq('id', escrowId);
            
            await UserService.incrementTransactionCount(escrow.buyer_id, true);
            await UserService.incrementTransactionCount(escrow.seller_id, true);
            
            const netAmount = Number(escrow.amount) * 0.995;
            
            await WhatsAppService.sendMessage(
                escrow.seller_phone,
                `💰 Funds released! You received ${netAmount.toFixed(2)} USDC (after 0.5% fee). Transaction complete!`
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
    
    async updateEscrowStatus(escrowId: string, status: string, fundedAt?: string) {
        let updateData: any = { status };
        if (fundedAt) {
            updateData.funded_at = fundedAt;
        }
        await supabase
            .from('escrows')
            .update(updateData)
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
    
    private generateShortId(): string {
        return 'BP' + Math.random().toString(36).substring(2, 8).toUpperCase();
    }
}

export default new EscrowService();
