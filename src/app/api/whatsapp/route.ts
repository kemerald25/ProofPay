
import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';
import { Sentry } from '@/config/sentry';
import EscrowService from '@/services/escrow.service';
import DisputeService from '@/services/dispute.service';
import WhatsAppService from '@/services/whatsapp.service';
import UserService from '@/services/user.service';

async function handleHistory(from: string) {
    const user = await UserService.getUserByPhone(from);
    if (!user) throw new Error("User not found.");

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

// Handles incoming WhatsApp messages from Twilio
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const body = Object.fromEntries(formData);

  const twilioSignature = req.headers.get('X-Twilio-Signature') || '';
  const url = process.env.NEXT_PUBLIC_URL + '/api/whatsapp'; 
  const authToken = process.env.TWILIO_AUTH_TOKEN || '';

  if (!twilio.validateRequest(authToken, twilioSignature, url, body)) {
    return new NextResponse('Invalid Twilio signature', { status: 401 });
  }

  const from = (body.From as string).replace('whatsapp:', '');
  const originalMessage = (body.Body as string).trim();
  const parts = originalMessage.split(' ');
  const command = parts[0].toLowerCase();
  
  try {
    const args = parts.slice(1);
    const escrowId = args[0]; // Keep original case

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
  } catch (error: any) {
    Sentry.captureException(error);
    await WhatsAppService.sendMessage(from, `An error occurred: ${error.message}`);
  }

  const twiml = new twilio.twiml.MessagingResponse();
  return new NextResponse(twiml.toString(), {
    headers: { 'Content-Type': 'text/xml' },
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
