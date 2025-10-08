import { NextRequest, NextResponse } from 'next/server';
import EscrowService from '@/services/escrow.service';
import UserService from '@/services/user.service';
import { Sentry } from '@/config/sentry';
import { ethers } from 'ethers';
import EscrowArtifact from '@/contracts/ProofPayEscrow.json';

// This function calls the Privy API to send a transaction
async function sendPrivyTransaction(
    walletAddress: string,
    transactionData: { to: string; data: string; value?: string }
) {
    const privyAppId = process.env.PRIVY_APP_ID!;
    const privyAppSecret = process.env.PRIVY_APP_SECRET!;
    const authHeader = 'Basic ' + Buffer.from(privyAppId + ':' + privyAppSecret).toString('base64');
    const chainId = process.env.CHAIN_ID || 'eip155:84532'; // Default to Base Sepolia

    const response = await fetch(`https://api.privy.io/v1/wallets/${walletAddress}/rpc`, {
        method: 'POST',
        headers: {
            'Authorization': authHeader,
            'privy-app-id': privyAppId,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            method: 'eth_sendTransaction',
            caip2: chainId,
            chain_type: 'ethereum',
            sponsor: true, // Let's sponsor gas fees
            params: {
                transaction: transactionData,
            },
        }),
    });

    if (!response.ok) {
        const errorBody = await response.json();
        console.error('Privy RPC Error:', JSON.stringify(errorBody, null, 2));
        throw new Error(`Privy API Error: ${errorBody.error || response.statusText}`);
    }

    const result = await response.json();
    return result.data;
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
        if (!buyer || !buyer.wallet_address) {
            throw new Error('Buyer user or wallet not found.');
        }

        // 1. Approve USDC spending
        const usdcInterface = new ethers.Interface(['function approve(address spender, uint256 amount)']);
        const amountInSmallestUnit = ethers.parseUnits(escrow.amount.toString(), 6);
        const approveData = usdcInterface.encodeFunctionData('approve', [process.env.ESCROW_CONTRACT_ADDRESS!, amountInSmallestUnit]);
        
        console.log(`[FUND] Step 1: Approving USDC for wallet ${buyer.wallet_address}`);
        const approveResult = await sendPrivyTransaction(buyer.wallet_address, {
            to: process.env.USDC_CONTRACT_ADDRESS!,
            data: approveData,
        });
        console.log(`[FUND] Approve transaction sent: ${approveResult.hash}`);
        
        // Note: In a real app, we'd wait for the approval to be mined. For this demo, we assume it's quick.

        // 2. Fund the escrow
        const escrowInterface = new ethers.Interface(EscrowArtifact.abi);
        const fundData = escrowInterface.encodeFunctionData('fundEscrow', [escrow.escrow_id]);

        console.log(`[FUND] Step 2: Funding escrow ${escrow.escrow_id} from wallet ${buyer.wallet_address}`);
        const fundResult = await sendPrivyTransaction(buyer.wallet_address, {
            to: process.env.ESCROW_CONTRACT_ADDRESS!,
            data: fundData,
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

        return NextResponse.json({ success: true, txHash: fundResult.hash, message: "Funding transaction has been broadcasted successfully!" });

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
