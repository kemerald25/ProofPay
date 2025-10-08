import 'dotenv/config';
import { NextRequest, NextResponse } from 'next/server';
import EscrowService from '@/services/escrow.service';
import UserService from '@/services/user.service';
import WhatsAppService from '@/services/whatsapp.service';
import { Sentry } from '@/config/sentry';
import { ethers } from 'ethers';
import EscrowArtifact from '@/contracts/ProofPayEscrow.json';

// Get wallet_id from Privy using the user's DID
async function getWalletIdFromDID(privyDID: string): Promise<string> {
    const privyAppId = process.env.PRIVY_APP_ID || "cmgh540910017l50ctwq2f856";
    const privyAppSecret = process.env.PRIVY_APP_SECRET || "nG6sS2PC632ASUTw4WrToChhxaEDXhoZz8dArWR2npkPFJmG5SwpRQwrRFm6QBcivMxnXr2d3EmEkkqgVCoCSN5";

    const authHeader = 'Basic ' + Buffer.from(privyAppId + ':' + privyAppSecret).toString('base64');

    // Get user data from Privy using their DID
    const response = await fetch(`https://auth.privy.io/api/v1/users/${privyDID}`, {
        method: 'GET',
        headers: {
            'Authorization': authHeader,
            'privy-app-id': privyAppId,
        },
    });

    if (!response.ok) {
        const errorBody = await response.text();
        console.error('Privy Get User Error:', errorBody);
        throw new Error(`Failed to fetch user from Privy: ${response.statusText}`);
    }

    const userData = await response.json();

    console.log('[PRIVY DEBUG] Full user data:', JSON.stringify(userData, null, 2));
    console.log('[PRIVY DEBUG] linked_accounts:', JSON.stringify(userData.linked_accounts, null, 2));

    const linkedAccounts = userData.linked_accounts;

    if (!linkedAccounts || !Array.isArray(linkedAccounts)) {
        throw new Error(`No linked_accounts found in response for DID: ${privyDID}`);
    }

    // Find Ethereum wallet with delegated access
    // According to Privy docs: wallets with session signers have delegated: true
    const embeddedWallet = linkedAccounts.find(
        (account: any) => {
            console.log('[PRIVY DEBUG] Checking account:', JSON.stringify(account, null, 2));
            const isWallet = account.type === 'wallet';
            const isEthereum = account.chain_type === 'ethereum';
            const isDelegated = account.delegated === true;
            const hasId = 'id' in account && account.id;
            console.log(`[PRIVY DEBUG] type: ${account.type}, chain_type: ${account.chain_type}, delegated: ${account.delegated}, has_id: ${hasId}`);
            return isWallet && isEthereum && isDelegated && hasId;
        }
    );

    if (!embeddedWallet) {
        // Check if there's a non-delegated wallet
        const nonDelegatedWallet = linkedAccounts.find(
            (account: any) => account.type === 'wallet' && account.chain_type === 'ethereum'
        );
        
        if (nonDelegatedWallet) {
            console.error('[PRIVY ERROR] Found ethereum wallet but it does not have delegated access.');
            throw new Error(
                `Wallet found but user has not granted delegated access. ` +
                `The user must authorize your app to sign transactions on their behalf. ` +
                `Please implement session signer setup on the client side using Privy's requestSigner() method.`
            );
        }
        
        console.error('[PRIVY ERROR] No ethereum wallet found. Available accounts:',
            linkedAccounts.map((a: any) => ({
                type: a.type,
                chain_type: a.chain_type,
                delegated: a.delegated,
                id: a.id,
                address: a.address
            }))
        );
        throw new Error(`No Ethereum wallet with delegated access found for DID: ${privyDID}. Found ${linkedAccounts.length} linked accounts.`);
    }

    console.log('[PRIVY DEBUG] Found embedded wallet:', JSON.stringify(embeddedWallet, null, 2));

    const walletId = embeddedWallet.id;

    if (!walletId) {
        throw new Error(`Embedded wallet found but no 'id' field. Wallet data: ${JSON.stringify(embeddedWallet, null, 2)}`);
    }

    console.log(`[PRIVY] Found wallet ID: ${walletId} for DID: ${privyDID}`);
    return walletId;
}

// Sign and broadcast transaction using Privy's eth_signTransaction + eth_sendRawTransaction
async function signAndBroadcastTransaction(
    walletId: string,
    transactionData: { 
        to: string; 
        data: string; 
        value?: string;
        from: string;
    }
) {
    const privyAppId = process.env.PRIVY_APP_ID || "cmgh540910017l50ctwq2f856";
    const privyAppSecret = process.env.PRIVY_APP_SECRET || "nG6sS2PC632ASUTw4WrToChhxaEDXhoZz8dArWR2npkPFJmG5SwpRQwrRFm6QBcivMxnXr2d3EmEkkqgVCoCSN5";

    if (!privyAppId || !privyAppSecret) {
        throw new Error('Privy credentials are not set in environment variables.');
    }

    const authHeader = 'Basic ' + Buffer.from(privyAppId + ':' + privyAppSecret).toString('base64');
    const chainId = 84532; // Base Sepolia

    // Get provider to fetch gas price and nonce
    const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL || 'https://sepolia.base.org');
    
    // Get current gas prices
    const feeData = await provider.getFeeData();
    const nonce = await provider.getTransactionCount(transactionData.from);

    console.log(`[PRIVY] Gas data - maxFeePerGas: ${feeData.maxFeePerGas}, maxPriorityFeePerGas: ${feeData.maxPriorityFeePerGas}`);

    // Prepare transaction for signing
    const txToSign = {
        to: transactionData.to,
        data: transactionData.data,
        value: transactionData.value || '0x0',
        chain_id: chainId,
        nonce: nonce,
        gas_limit: 200000, // Adjust as needed
        max_fee_per_gas: Number(feeData.maxFeePerGas),
        max_priority_fee_per_gas: Number(feeData.maxPriorityFeePerGas),
        type: 2 // EIP-1559
    };

    console.log(`[PRIVY] Signing transaction:`, JSON.stringify(txToSign, null, 2));

    // Step 1: Sign the transaction
    const signResponse = await fetch(`https://api.privy.io/v1/wallets/${walletId}/rpc`, {
        method: 'POST',
        headers: {
            'Authorization': authHeader,
            'privy-app-id': privyAppId,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            method: 'eth_signTransaction',
            params: {
                transaction: txToSign
            },
        }),
    });

    if (!signResponse.ok) {
        const errorBody = await signResponse.json();
        console.error('Privy Sign Error:', JSON.stringify(errorBody, null, 2));
        throw new Error(`Privy Sign Error: ${errorBody.error || signResponse.statusText}`);
    }

    const signResult = await signResponse.json();
    const signedTx = signResult.data.signed_transaction;

    console.log(`[PRIVY] Transaction signed successfully`);

    // Step 2: Broadcast the signed transaction
    const txHash = await provider.broadcastTransaction(signedTx);
    
    console.log(`[PRIVY] Transaction broadcasted: ${txHash.hash}`);

    return { hash: txHash.hash };
}


export async function POST(req: NextRequest) {
    try {
        const { escrowId, buyerPhone } = await req.json();

        if (!escrowId || !buyerPhone) {
            return NextResponse.json({ error: 'escrowId and buyerPhone are required' }, { status: 400 });
        }

        const escrow = await EscrowService.getEscrow(escrowId);
        if (!escrow) {
            return NextResponse.json({ error: 'Escrow not found' }, { status: 404 });
        }
        if (escrow.buyer_phone !== buyerPhone) {
            return NextResponse.json({ error: 'Unauthorized: Only the buyer can fund this escrow.' }, { status: 403 });
        }
        if (escrow.status !== 'CREATED') {
            return NextResponse.json({ error: 'Escrow is not in CREATED state.' }, { status: 400 });
        }

        const buyer = await UserService.getUserByPhone(buyerPhone);
        if (!buyer || !buyer.privy_user_id || !buyer.wallet_address) {
            throw new Error('Buyer user, Privy user ID, or wallet address not found.');
        }

        // Get the wallet_id from Privy using the DID
        console.log(`[FUND] Fetching wallet_id for DID: ${buyer.privy_user_id}`);
        const walletId = await getWalletIdFromDID(buyer.privy_user_id);

        // 1. Approve USDC spending
        const usdcInterface = new ethers.Interface(['function approve(address spender, uint256 amount)']);
        const amountInSmallestUnit = ethers.parseUnits(escrow.amount.toString(), 6);
        const approveData = usdcInterface.encodeFunctionData('approve', [
            process.env.ESCROW_CONTRACT_ADDRESS!, 
            amountInSmallestUnit
        ]);

        console.log(`[FUND] Step 1: Signing and broadcasting USDC approval`);
        const approveResult = await signAndBroadcastTransaction(walletId, {
            to: process.env.USDC_CONTRACT_ADDRESS!,
            data: approveData,
            from: buyer.wallet_address,
        });
        console.log(`[FUND] Approve transaction sent: ${approveResult.hash}`);

        // Wait for approval to be mined
        const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL || 'https://sepolia.base.org');
        console.log(`[FUND] Waiting for approval confirmation...`);
        await provider.waitForTransaction(approveResult.hash, 1);
        console.log(`[FUND] Approval confirmed`);

        // 2. Fund the escrow
        const escrowInterface = new ethers.Interface(EscrowArtifact.abi);
        const fundData = escrowInterface.encodeFunctionData('fundEscrow', [escrow.escrow_id]);

        console.log(`[FUND] Step 2: Signing and broadcasting escrow funding`);
        const fundResult = await signAndBroadcastTransaction(walletId, {
            to: process.env.ESCROW_CONTRACT_ADDRESS!,
            data: fundData,
            from: buyer.wallet_address,
        });
        console.log(`[FUND] Fund transaction sent: ${fundResult.hash}`);

        // Update database status to FUNDED
        await EscrowService.updateEscrowStatus(escrowId, 'FUNDED', new Date().toISOString());
        console.log(`[FUND] Database updated to FUNDED status`);

        // Notify both parties
        await WhatsAppService.sendPaymentConfirmed(
            escrow.buyer_phone,
            'buyer',
            Number(escrow.amount),
            escrowId
        );
        await WhatsAppService.sendPaymentConfirmed(
            escrow.seller_phone,
            'seller',
            Number(escrow.amount),
            escrowId
        );
        console.log(`[FUND] Notifications sent.`);

        return NextResponse.json({
            success: true,
            txHash: fundResult.hash,
            message: "Funding transaction has been broadcasted successfully!"
        });

    } catch (error: any) {
        console.error('[API FUND] Funding error:', error);
        Sentry.captureException(error);

        return NextResponse.json({
            success: false,
            error: error.message || 'Failed to fund escrow',
            details: error.toString()
        }, { status: 500 });
    }
}