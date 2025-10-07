import { NextRequest, NextResponse } from 'next/server';
import { Sentry } from '@/config/sentry';
import UserService from '@/services/user.service';
import WhatsAppService from '@/services/whatsapp.service';
import { ethers } from 'ethers';

async function handleCreateWallet(phone: string) {
    const user = await UserService.getOrCreateUser(phone);
    const message = `✅ Wallet ready!\nAddress: ${user.wallet_address}`;
    return {
        message,
        wallet_address: user.wallet_address,
        ipfs_cid: user.ipfs_cid
    };
}

async function handleBalance(phone: string) {
    const user = await UserService.getUserByPhone(phone);
    if (!user || !user.wallet_address) {
        throw new Error("User or wallet not found. Please create a wallet first by sending '/createwallet'.");
    }

    const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL!);
    const usdcContract = new ethers.Contract(
        process.env.USDC_CONTRACT_ADDRESS!,
        ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)'],
        provider
    );

    const balance = await usdcContract.balanceOf(user.wallet_address);
    const decimals = await usdcContract.decimals();
    const formattedBalance = ethers.formatUnits(balance, decimals);

    return { message: `Your wallet balance is: ${formattedBalance} USDC` };
}

async function handleIncomingMessage(phone: string, originalMessage: string) {
    const message = originalMessage.trim().toLowerCase();
    const parts = message.split(' ');
    const command = parts[0];
    
    switch (command) {
        case '/createwallet':
            return await handleCreateWallet(phone);
        case '/balance':
            return await handleBalance(phone);
        case '/help':
             return { message: await WhatsAppService.getHelpMessage() };
        // Other commands can be added here
        default:
            return { message: 'Sorry, I didn\'t understand that command. Reply "/help" for a list of commands.' };
    }
}

// Unified endpoint for both Simulator and WhatsApp
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phone_number, message, source } = body;

    if (!phone_number || !message) {
      return NextResponse.json({ success: false, message: 'phone_number and message are required.' }, { status: 400 });
    }

    const result = await handleIncomingMessage(phone_number, message);
    
    if (source === 'whatsapp') {
      // In a real scenario, you'd send this back via Twilio/WhatsApp API
      // For now, we just acknowledge the webhook
      return NextResponse.json({ success: true, message: "WhatsApp command processed." });
    } else {
      // Respond to the simulator
      return NextResponse.json({ success: true, ...result });
    }

  } catch (error: any) {
    console.error("API Error in /api/chat:", error);
    Sentry.captureException(error);
    const errorMessage = error.message || 'An unknown error occurred.';
    return NextResponse.json({ success: false, message: `❌ Error: ${errorMessage}` }, { status: 500 });
  }
}
