import { createClient } from '@supabase/supabase-js';
import { Sentry } from '@/config/sentry';
import { PrivyClient } from '@privy-io/server-auth';
import { Web3Storage, File } from 'web3.storage';

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
);

const privy = new PrivyClient(process.env.PRIVY_APP_ID!, process.env.PRIVY_APP_SECRET!);

const web3Storage = new Web3Storage({ token: process.env.WEB3_STORAGE_TOKEN! });


class UserService {
    
    async getOrCreateUser(phoneNumber: string) {
        try {
            const { data: existing } = await supabase
                .from('users')
                .select('*')
                .eq('phone_number', phoneNumber)
                .single();
            
            if (existing) {
                 // Even if user exists, we get their latest wallet info from Privy
                 const privyUser = await privy.getUser(existing.privy_user_id);
                 if (!privyUser.wallet) {
                     // This case might happen if wallet was unlinked. We can try to relink or create.
                     await privy.linkPhone({userId: privyUser.id, phone: phoneNumber});
                 }
                 const wallet = privyUser.wallet || (await privy.createWallet({userId: privyUser.id}));

                 if (wallet.address !== existing.wallet_address) {
                     const { data: updatedUser } = await supabase.from('users').update({ wallet_address: wallet.address }).eq('id', existing.id).select().single();
                     return updatedUser;
                 }
                return existing;
            }
            
            // Create new user with Privy
            const privyUser = await privy.getOrCreateUser({ create: { phone: phoneNumber } });
            
            if (!privyUser.wallet) {
                await privy.createWallet({userId: privyUser.id});
            }
            
            const wallet = await privy.getUser(privyUser.id).then(u => u.wallet);

            if (!wallet) {
                throw new Error("Failed to create or retrieve Privy wallet.");
            }

            // Create new user in our database
            const { data: newUser, error } = await supabase
                .from('users')
                .insert({
                    phone_number: phoneNumber,
                    privy_user_id: privyUser.id,
                    wallet_address: wallet.address,
                })
                .select()
                .single();
            
            if (error) throw error;

            // Upload metadata to IPFS
            try {
                const metadata = { phoneNumber, walletAddress: wallet.address, createdAt: new Date().toISOString() };
                const cid = await web3Storage.put([new File([JSON.stringify(metadata)], 'wallet.json')]);
                await supabase.from('users').update({ ipfs_cid: cid }).eq('id', newUser.id);
                newUser.ipfs_cid = cid;
            } catch (ipfsError) {
                console.error("IPFS upload failed, continuing without it:", ipfsError);
                Sentry.captureException(ipfsError);
            }
            
            return newUser;
        } catch(error) {
            Sentry.captureException(error);
            console.error("Error in getOrCreateUser:", error);
            throw error;
        }
    }
    
    async getUserByPhone(phoneNumber: string) {
        const { data } = await supabase
            .from('users')
            .select('*')
            .eq('phone_number', phoneNumber)
            .single();
        
        return data;
    }
}

export default new UserService();
