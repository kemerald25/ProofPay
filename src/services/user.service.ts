
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
            // First, check if user exists in our database
            let { data: existingUser } = await supabase
                .from('users')
                .select('*')
                .eq('phone_number', phoneNumber)
                .single();

            if (existingUser) {
                console.log(`[USER] Found existing user for ${phoneNumber}`);
                const privyUser = await privy.getUser(existingUser.privy_user_id);
                if (!privyUser.wallet) {
                     await privy.createWallet({userId: privyUser.id});
                }
                const wallet = privyUser.wallet || (await privy.getUser(privyUser.id).then(u => u.wallet));

                if (wallet && wallet.address !== existingUser.wallet_address) {
                    const { data: updatedUser } = await supabase
                        .from('users')
                        .update({ wallet_address: wallet.address })
                        .eq('id', existingUser.id)
                        .select()
                        .single();
                    return updatedUser;
                }
                return existingUser;
            }

            // If not, create a new user via Privy
            console.log(`[USER] No user found for ${phoneNumber}, creating new one...`);
            const newUserRequest = {
                create_embedded_wallet: true,
                linked_accounts: [{ type: 'phone', phone_number: phoneNumber }]
            } as const;

            const privyUser = await privy.createUser(newUserRequest);
            const wallet = privyUser.wallet;

            if (!wallet) {
                throw new Error("Failed to create or retrieve Privy wallet for new user.");
            }
             console.log(`[USER] Privy user and wallet created: ${privyUser.id}, ${wallet.address}`);

            // Store new user in our database
            const { data: newUser, error: insertError } = await supabase
                .from('users')
                .insert({
                    phone_number: phoneNumber,
                    privy_user_id: privyUser.id,
                    wallet_address: wallet.address,
                })
                .select()
                .single();

            if (insertError) throw insertError;
            console.log(`[USER] User stored in Supabase with ID: ${newUser.id}`);

            // Upload metadata to IPFS
            try {
                const metadata = { phoneNumber, walletAddress: wallet.address, createdAt: new Date().toISOString() };
                const cid = await web3Storage.put([new File([JSON.stringify(metadata)], 'wallet.json')]);
                await supabase.from('users').update({ ipfs_cid: cid }).eq('id', newUser.id);
                newUser.ipfs_cid = cid;
                 console.log(`[USER] Wallet metadata uploaded to IPFS: ${cid}`);
            } catch (ipfsError) {
                console.error("[USER] IPFS upload failed, continuing without it:", ipfsError);
                Sentry.captureException(ipfsError);
            }

            return newUser;
        } catch(error) {
            Sentry.captureException(error);
            console.error("[USER] Error in getOrCreateUser:", error);
            const privyError = error as any;
            if (privyError.response && privyError.response.data) {
                console.error("Privy API Error:", privyError.response.data);
            }
            throw new Error(`Failed to get or create user: ${ (error as Error).message}`);
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
