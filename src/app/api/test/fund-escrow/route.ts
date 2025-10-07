import { NextRequest, NextResponse } from 'next/server';
import BlockchainService from '@/services/blockchain.service';
import EscrowService from '@/services/escrow.service';
import WhatsAppService from '@/services/whatsapp.service';
import { ethers } from 'ethers';
import { Sentry } from '@/config/sentry';

/**
 * TEST ONLY: This simulates a buyer funding an escrow
 * In production, the buyer would do this from their own wallet
 */
export async function POST(req: NextRequest) {
    try {
        const { escrowId } = await req.json();

        if (!escrowId) {
            return NextResponse.json({ error: 'Escrow ID required' }, { status: 400 });
        }

        console.log(`[FUND] Starting funding process for escrow: ${escrowId}`);

        // Get escrow details from database
        const escrow = await EscrowService.getEscrow(escrowId);

        if (!escrow) {
            return NextResponse.json({ error: 'Escrow not found' }, { status: 404 });
        }

        if (escrow.status !== 'CREATED') {
            return NextResponse.json({
                error: `Escrow status is ${escrow.status}. Must be CREATED to fund.`
            }, { status: 400 });
        }

        console.log(`[FUND] Escrow details:`, {
            id: escrow.id,
            blockchainId: escrow.escrow_id,
            amount: escrow.amount,
            buyer: escrow.buyer_wallet,
            seller: escrow.seller_wallet
        });

        // Initialize provider and wallet
        const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL);
        const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

        console.log(`[FUND] Using wallet: ${wallet.address}`);

        // USDC Contract setup
        const usdcAbi = [
            'function approve(address spender, uint256 amount) external returns (bool)',
            'function allowance(address owner, address spender) external view returns (uint256)',
            'function balanceOf(address account) external view returns (uint256)',
            'function decimals() external view returns (uint8)'
        ];

        const usdcContract = new ethers.Contract(
            process.env.USDC_CONTRACT_ADDRESS!,
            usdcAbi,
            wallet
        );

        // Check USDC decimals (should be 6 for USDC)
        const decimals = await usdcContract.decimals();
        console.log(`[FUND] USDC decimals: ${decimals}`);

        // Check balance
        const balance = await usdcContract.balanceOf(wallet.address);
        const amountNeeded = ethers.parseUnits(escrow.amount.toString(), Number(decimals));

        console.log(`[FUND] Wallet USDC balance: ${ethers.formatUnits(balance, decimals)}`);
        console.log(`[FUND] Amount needed: ${ethers.formatUnits(amountNeeded, decimals)}`);

        if (balance < amountNeeded) {
            return NextResponse.json({
                error: `Insufficient USDC balance. Have ${ethers.formatUnits(balance, decimals)}, need ${ethers.formatUnits(amountNeeded, decimals)}`,
                details: {
                    walletAddress: wallet.address,
                    balance: ethers.formatUnits(balance, decimals),
                    needed: ethers.formatUnits(amountNeeded, decimals)
                }
            }, { status: 400 });
        }

        // Check allowance
        const currentAllowance = await usdcContract.allowance(
            wallet.address,
            process.env.ESCROW_CONTRACT_ADDRESS!
        );

        console.log(`[FUND] Current USDC allowance: ${ethers.formatUnits(currentAllowance, decimals)}`);

        // Approve if needed
        if (currentAllowance < amountNeeded) {
            console.log('[FUND] Approving USDC spending...');
            const approveTx = await usdcContract.approve(
                process.env.ESCROW_CONTRACT_ADDRESS!,
                amountNeeded
            );
            console.log(`[FUND] Approve TX sent: ${approveTx.hash}`);

            const approveReceipt = await approveTx.wait();
            console.log(`[FUND] USDC approved in block ${approveReceipt.blockNumber}`);
        } else {
            console.log('[FUND] Sufficient allowance already exists');
        }

        // Fund the escrow on blockchain
        console.log(`[FUND] Calling fundEscrow(${escrow.escrow_id})...`);
        const txHash = await BlockchainService.fundEscrow(escrow.escrow_id);
        console.log(`[FUND] Escrow funded! TX: ${txHash}`);

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

        console.log(`[FUND] Notifications sent to buyer and seller`);

        return NextResponse.json({
            success: true,
            txHash,
            message: 'Escrow funded successfully',
            escrowId: escrowId,
            blockchainId: escrow.escrow_id,
            amount: escrow.amount,
            status: 'FUNDED'
        });

    } catch (error: any) {
        console.error('[FUND] Funding error:', error);
        Sentry.captureException(error);

        return NextResponse.json({
            error: error.message || 'Failed to fund escrow',
            details: error.toString()
        }, { status: 500 });
    }
}