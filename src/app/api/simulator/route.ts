
import { NextRequest, NextResponse } from 'next/server';
import { Sentry } from '@/config/sentry';
import EscrowService from '@/services/escrow.service';
import DisputeService from '@/services/dispute.service';
import WhatsAppService from '@/services/whatsapp.service';
import UserService from '@/services/user.service';

async function handleCreate(from: string, args: string[]) {
    // New step-by-step creation is handled on the client.
    // This maintains the old single-line command for direct API testing if needed.
    if (args.length < 3) {
      throw new Error('Invalid create format. Use: +<buyer-phone> <amount> <item>');
    }
    const buyerPhone = args[0];
    const amount = parseFloat(args[1]);
    const description = args.slice(2).join(' ');

    if (isNaN(amount) || !description || !buyerPhone) {
        throw new Error('Invalid create format.');
    }

    const seller = await UserService.getUserByPhone(from);
    if (!seller || !seller.wallet_address) {
        throw new Error("Seller wallet not found. Please ensure you've interacted with the app before to generate a wallet.");
    }

    const escrowData = await EscrowService.createEscrow({
        sellerPhone: from,
        buyerPhone,
        amount,
        description,
    });
    
    await WhatsAppService.sendEscrowCreatedToSeller(from, { ...escrowData, buyerPhone });
    await WhatsAppService.sendPaymentRequestToBuyer(buyerPhone, {
        amount: escrowData.amount,
        description: escrowData.description,
        escrowId: escrowData.escrowId,
    });
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

async function handleIncomingMessage(from: string, originalMessage: string) {
    const message = originalMessage.trim();
    const parts = message.split(' ');
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);
    
    if (command.startsWith('+')) {
        await handleCreate(from, [command, ...args]);
    } else {
        const escrowId = args[0];

        switch (command) {
            case 'confirm':
                await handleConfirm(from, escrowId);
                break;
            case 'dispute':
                await handleDispute(from, escrowId);
                break;
            case 'help':
                await WhatsAppService.sendHelpMessage(from);
                break;
            case 'history':
                await handleHistory(from);
                break;
            default:
                await WhatsAppService.sendMessage(from, 'Sorry, I didn\'t understand that command. Reply "help" for a list of commands.');
                break;
        }
    }
}

// Handles incoming messages from the simulator UI
export async function POST(req: NextRequest) {
  const messageQueue: any[] = [];
  const originalSendMessage = WhatsAppService.sendMessage;
  
  WhatsAppService.sendMessage = async (to: string, body: string) => {
      console.log(`Intercepted WhatsApp message to ${to}: ${body}`);
      messageQueue.push({ to, body });
      return Promise.resolve(`simulated_message_sid_${Date.now()}`);
  };

  const body = await req.json();
  const from = body.from;
  const message = body.message;

  try {
    await handleIncomingMessage(from, message);
    WhatsAppService.sendMessage = originalSendMessage;
    return NextResponse.json({ replies: messageQueue });

  } catch (error: any) {
    console.error("Simulator API Error:", error);
    Sentry.captureException(error);
    WhatsAppService.sendMessage = originalSendMessage;

    const errorReply = {
      to: from,
      body: `An error occurred: ${error.message}`
    };

    return NextResponse.json({ replies: [errorReply] }, { status: 200 });
  }
}
