
import { createClient } from '@supabase/supabase-js';
import { Sentry } from '@/config/sentry';
import { PrivyClient } from '@privy-io/server-auth';
import { Web3Storage, File } from 'web3.storage';
import { User } from '@/lib/definitions';
import { ethers } from 'ethers';

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
);

const privy = new PrivyClient(process.env.PRIVY_APP_ID!, process.env.PRIVY_APP_SECRET!);

const web3Storage = new Web3Storage({ token: process.env.WEB3_STORAGE_TOKEN! });


class UserService {

    private async _createPrivyUser(phoneNumber: string): Promise<any> {
        const authHeader = 'Basic ' + Buffer.from(process.env.PRIVY_APP_ID + ':' + process.env.PRIVY_APP_SECRET).toString('base64');
        const response = await fetch('https://api.privy.io/v1/users', {
            method: 'POST',
            headers: {
                'Authorization': authHeader,
                'privy-app-id': process.env.PRIVY_APP_ID!,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                linked_accounts: [{ type: 'phone', number: phoneNumber }],
                wallets: [{ chain_type: 'ethereum' }] // REMOVED invalid chain_id
            })
        });

        if (!response.ok) {
            const errorBody = await response.json();
            throw new Error(`Privy API Error: ${response.status} ${JSON.stringify(errorBody)}`);
        }
        return response.json();
    }

    async getOrCreateUser(phoneNumber: string): Promise<User> {
        try {
            const existingUser = await this.getUserByPhone(phoneNumber);
            if (existingUser) {
                 console.log(`[USER] Found existing user for ${phoneNumber}`);
                return existingUser;
            }

            // If not, create a new user via Privy API directly
            console.log(`[USER] No user found for ${phoneNumber}, creating new one via Privy API...`);
            const privyUser = await this._createPrivyUser(phoneNumber);
            
            // After creating, we need to fetch the user again to get wallet details
            const fullPrivyUser = await privy.getUser(privyUser.id);
            const wallet = fullPrivyUser.wallet;

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
            console.log(`[USER] User stored in Supabase with ID: ${newUser!.id}`);

            // Upload metadata to IPFS
            try {
                const metadata = { phoneNumber, walletAddress: wallet.address, createdAt: new Date().toISOString() };
                const cid = await web3Storage.put([new File([JSON.stringify(metadata)], 'wallet.json')]);
                await supabase.from('users').update({ ipfs_cid: cid }).eq('id', newUser!.id);
                newUser!.ipfs_cid = cid;
                 console.log(`[USER] Wallet metadata uploaded to IPFS: ${cid}`);
            } catch (ipfsError) {
                console.error("[USER] IPFS upload failed, continuing without it:", ipfsError);
                Sentry.captureException(ipfsError);
            }

            return newUser!;
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
    
    async getUserByPhone(phoneNumber: string): Promise<User | null> {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('phone_number', phoneNumber)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
            console.error('Error fetching user by phone from Supabase:', error);
            Sentry.captureException(error);
            throw error;
        }
        
        return data;
    }

    async findUserByPhone(phoneNumber: string): Promise<User | null> {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('phone_number', phoneNumber)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
            console.error('Error fetching user by phone from Supabase:', error);
            Sentry.captureException(error);
            throw error;
        }
        
        return data;
    }

    async getDecryptedPrivateKey(userId: string): Promise<string> {
        // This is a placeholder. In a real application, you would use a secure key management
        // system (like a KMS or Vault) to handle private keys.
        // For this demo, we'll use a hardcoded key, but THIS IS NOT SAFE FOR PRODUCTION.
        const demoPrivateKey = process.env.PRIVATE_KEY;
        if (!demoPrivateKey) {
            throw new Error("PRIVATE_KEY environment variable is not set for demo purposes.");
        }
        console.warn("Using a demo private key. THIS IS NOT SECURE FOR PRODUCTION.");
        return demoPrivateKey;
    }

    async incrementTransactionCount(userId: string, isSuccess: boolean) {
        // This function would interact with your database to keep track of user stats.
        // For now, it's a placeholder.
        console.log(`Incrementing transaction count for user ${userId}. Success: ${isSuccess}`);
    }

     async incrementDisputeCount(userId: string) {
        // This function would interact with your database to keep track of user stats.
        console.log(`Incrementing dispute count for user ${userId}.`);
    }

}

export default new UserService();
