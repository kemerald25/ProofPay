import { createClient } from '@supabase/supabase-js';
import { ethers } from 'ethers';
import { Sentry } from '@/config/sentry';

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
);

// A simple (and not production-safe) encryption for the demo.
// In a real app, use a dedicated KMS.
function simpleEncrypt(text: string, secret: string): string {
    return text.split('').map((char, i) => {
        return String.fromCharCode(char.charCodeAt(0) + secret.charCodeAt(i % secret.length));
    }).join('');
}

function simpleDecrypt(text: string, secret: string): string {
    return text.split('').map((char, i) => {
        return String.fromCharCode(char.charCodeAt(0) - secret.charCodeAt(i % secret.length));
    }).join('');
}


class UserService {
    
    async getOrCreateUser(phoneNumber: string) {
        try {
            const { data: existing } = await supabase
                .from('users')
                .select('*')
                .eq('phone_number', phoneNumber)
                .single();
            
            if (existing) return existing;
            
            // Create new wallet
            const wallet = ethers.Wallet.createRandom();
            const encryptionKey = process.env.ENCRYPTION_KEY;
            if (!encryptionKey) {
                throw new Error("ENCRYPTION_KEY environment variable is not set.");
            }

            const encryptedPrivateKey = simpleEncrypt(wallet.privateKey, encryptionKey);

            // Create new user
            const { data: newUser, error } = await supabase
                .from('users')
                .insert({
                    phone_number: phoneNumber,
                    username: `user_${phoneNumber.slice(-4)}`,
                    wallet_address: wallet.address,
                    private_key: encryptedPrivateKey, // Store encrypted key
                })
                .select()
                .single();
            
            if (error) throw error;
            
            return newUser;
        } catch(error) {
            Sentry.captureException(error);
            console.error("Error in getOrCreateUser:", error);
            throw error;
        }
    }
    
    async updateWalletAddress(userId: string, walletAddress: string) {
        await supabase
            .from('users')
            .update({ wallet_address: walletAddress })
            .eq('id', userId);
    }
    
    async incrementTransactionCount(userId: string, successful: boolean = true) {
        const { data: user } = await supabase
            .from('users')
            .select('total_transactions, successful_transactions')
            .eq('id', userId)
            .single();
        
        if (!user) return;
        
        await supabase
            .from('users')
            .update({
                total_transactions: user.total_transactions + 1,
                successful_transactions: successful ? user.successful_transactions + 1 : user.successful_transactions
            })
            .eq('id', userId);
    }
    
    async incrementDisputeCount(userId: string) {
        const { data: user } = await supabase
            .from('users')
            .select('dispute_count')
            .eq('id', userId)
            .single();
        
        if (!user) return;
        
        await supabase
            .from('users')
            .update({
                dispute_count: user.dispute_count + 1
            })
            .eq('id', userId);
    }
    
    async getUserByPhone(phoneNumber: string) {
        const { data } = await supabase
            .from('users')
            .select('*')
            .eq('phone_number', phoneNumber)
            .single();
        
        return data;
    }

    async getDecryptedPrivateKey(userId: string): Promise<string> {
        const { data: user, error } = await supabase
            .from('users')
            .select('private_key')
            .eq('id', userId)
            .single();

        if (error || !user) throw new Error("User not found to get private key.");

        const encryptionKey = process.env.ENCRYPTION_KEY;
        if (!encryptionKey) {
            throw new Error("ENCRYPTION_KEY environment variable is not set.");
        }
        
        return simpleDecrypt(user.private_key, encryptionKey);
    }
}

export default new UserService();
