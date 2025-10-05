
import { NextRequest, NextResponse } from 'next/server';
import { Sentry } from '@/config/sentry';
import EscrowService from '@/services/escrow.service';
import DisputeService from '@/services/dispute.service';
import WhatsAppService from '@/services/whatsapp.service';
import UserService from '@/services/user.service';

// Store messages to be sent instead of actually sending them
let messageQueue: any[] = [];

// Handles incoming messages from the simulator UI
export async function POST(req: NextRequest) {
  messageQueue = []; // Clear queue for each request
  const body = await req.json();

  const from = body.from;
  const message = (body.message as string).toLowerCase().trim();
  
  // Temporarily override the real sendMessage to capture replies
  const originalSendMessage = WhatsAppService.sendMessage;
  WhatsAppService.sendMessage = async (to: string, body: string) => {
      console.log(`Intercepted WhatsApp message to ${to}: ${body}`);
      messageQueue.push({ to, body });
      return `simulated_message_sid_${Date.now()}`;
  };

  try {
    await handleIncomingMessage(from, message);
  } catch (error: any) {
    Sentry.captureException(error);
    messageQueue.push({to: from, body: `An error occurred: ${error.message}`});
    // Restore the original function even if there's an error
    WhatsAppService.sendMessage = originalSendMessage;
    return NextResponse.json({ replies: messageQueue }, { status: 500 });
  }

  // Restore the original function after processing
  WhatsAppService.sendMessage = originalSendMessage;

  return NextResponse.json({ replies: messageQueue });
}


async function handleIncomingMessage(from: string, message: string) {
    const [command, ...args] = message.split(' ');

    if (message.startsWith('+')) {
        await handleCreate(from, message);
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


async function handleCreate(from: string, message: string) {
    const parts = message.split(' ');
    const buyerPhone = parts[0];
    const amount = parseFloat(parts[1]);
    const description = parts.slice(2).join(' ');

    if (!buyerPhone || !amount || !description) {
        throw new Error('Invalid format. Use: +<buyer-phone> <amount> <item>');
    }

    const escrowData = await EscrowService.createEscrow({
        sellerPhone: from,
        buyerPhone,
        amount,
        description,
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
