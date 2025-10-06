
import { NextRequest, NextResponse } from 'next/server';
import { Sentry } from '@/config/sentry';
import EscrowService from '@/services/escrow.service';
import DisputeService from '@/services/dispute.service';
import WhatsAppService from '@/services/whatsapp.service';
import UserService from '@/services/user.service';

// Format: +<buyer-phone> <amount> <seller-wallet> <item>
async function handleCreate(from: string, message: string) {
    const parts = message.trim().split(' ');
    if (parts.length < 4 || !parts[0].startsWith('+') || !parts[2].startsWith('0x')) {
      throw new Error('Invalid create format. Use: +<buyer-phone> <amount> <seller-wallet> <item>');
    }
    const buyerPhone = parts[0];
    const amount = parseFloat(parts[1]);
    const sellerWallet = parts[2];
    const description = parts.slice(3).join(' ');

    if (isNaN(amount) || !description || !sellerWallet) {
        throw new Error('Invalid create format. Use: +<buyer-phone> <amount> <seller-wallet> <item>');
    }

    const escrowData = await EscrowService.createEscrow({
        sellerPhone: from,
        buyerPhone,
        amount,
        description,
        sellerWallet,
    });
    
    await WhatsAppService.sendEscrowCreatedToSeller(from, { ...escrowData, buyerPhone });
    await WhatsAppService.sendPaymentRequestToBuyer(buyerPhone, escrowData);
}

async function handleConfirm(from: string, escrowId: string) {
  if (!escrowId) throw new Error('Please provide an Escrow ID. e.g., "confirm BP-123XYZ"');
  await EscrowService.releaseFunds(escrowId, from);
}

async function handleDispute(from: string, escrowId: string) {
  if (!escrowId) throw new Error('Please provide an Escrow ID. e.g., "dispute BP-123XYZ"');
  await DisputeService.raiseDispute({ 
      escrowId: escrowId,
      raisedByPhone: from,
      reason: 'NOT_RECEIVED'
  });
}

async function handleHistory(from: string) {
    const user = await UserService.getUserByPhone(from);
    if (!user) {
      await WhatsAppService.sendMessage(from, "User not found. Please create an escrow first to register.");
      return;
    }

    const escrows = await EscrowService.getUserEscrows(user.id);
    
    if (escrows.length === 0) {
        await WhatsAppService.sendMessage(from, "You have no transactions.");
        return;
    }

    let historyMessage = "*Your Last 5 Transactions:*\n\n";
    escrows.slice(0, 5).forEach(e => {
        const role = e.seller_id === user.id ? 'Seller' : 'Buyer';
        historyMessage += `*ID:* ${e.id}\n*Item:* ${e.item_description}\n*Status:* ${e.status}\n*Amount:* ${e.amount} USDC\n*Role:* ${role}\n-----------------\n`;
    });
    
    await WhatsAppService.sendMessage(from, historyMessage);
}

async function handleIncomingMessage(from: string, message: string) {
    const lowerCaseMessage = message.trim().toLowerCase();
    const [command, ...args] = lowerCaseMessage.split(' ');

    if (message.trim().startsWith('+')) {
        await handleCreate(from, message.trim());
    } else {
        switch (command) {
            case 'confirm':
                await handleConfirm(from, args[0]);
                break;
            case 'dispute':
                await handleDispute(from, args[0]);
                break;
            case 'help':
                await WhatsAppService.sendHelpMessage(from);
                break;
            case 'history':
                await handleHistory(from);
                break;
            default:
                await WhatsAppService.sendMessage(from, 'Sorry, I\'ve received your message but didn\'t understand the command. Reply "help" for a list of commands.');
                break;
        }
    }
}

// Handles incoming messages from the simulator UI
export async function POST(req: NextRequest) {
  const messageQueue: any[] = [];
  const originalSendMessage = WhatsAppService.sendMessage;
  
  // Intercept messages for this request only
  WhatsAppService.sendMessage = async (to: string, body: string) => {
      console.log(`Intercepted WhatsApp message to ${to}: ${body}`);
      messageQueue.push({ to, body });
      // In the simulator, we don't need a real SID, so we return a promise 
      // that resolves to a simulated SID to match the function signature.
      return Promise.resolve(`simulated_message_sid_${Date.now()}`);
  };

  const body = await req.json();
  const from = body.from;
  const message = body.message;

  try {
    await handleIncomingMessage(from, message);
    
    // Restore original function
    WhatsAppService.sendMessage = originalSendMessage;
    return NextResponse.json({ replies: messageQueue });

  } catch (error: any) {
    console.error("Simulator API Error:", error);
    Sentry.captureException(error);
    
    // Restore original function even on error
    WhatsAppService.sendMessage = originalSendMessage;

    // We must ensure we reply with a valid JSON response, even on error.
    const errorReply = {
      to: from,
      body: `An error occurred: ${error.message}`
    };

    return NextResponse.json({ replies: [errorReply] }, { status: 200 });
  }
}
