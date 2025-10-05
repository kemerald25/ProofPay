import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';
import { Sentry } from '@/config/sentry';
import EscrowService from '@/services/escrow.service';
import DisputeService from '@/services/dispute.service';
import WhatsAppService from '@/services/whatsapp.service';

// Handles incoming WhatsApp messages from Twilio
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const body = Object.fromEntries(formData);

  // Validate Twilio signature
  const twilioSignature = req.headers.get('X-Twilio-Signature') || '';
  const url = process.env.NEXT_PUBLIC_URL + '/api/whatsapp'; 
  const authToken = process.env.TWILIO_AUTH_TOKEN || '';

  if (!twilio.validateRequest(authToken, twilioSignature, url, body)) {
    return new NextResponse('Invalid Twilio signature', { status: 401 });
  }

  const from = (body.From as string).replace('whatsapp:', '');
  const message = (body.Body as string).toLowerCase().trim();
  const [command, ...args] = message.split(' ');

  try {
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
      default:
        // Try parsing as a create command
        if (message.startsWith('+')) {
            await handleCreate(from, message);
        } else {
            await WhatsAppService.sendMessage(from, 'Sorry, I didn\'t understand that. Reply "help" for a list of commands.');
        }
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


async function handleCreate(from: string, message: string) {
    // Format: +[buyer-phone] [amount] [item description]
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
    
    // Notify both parties
    await WhatsAppService.sendEscrowCreatedToSeller(from, { ...escrowData, buyerPhone });
    await WhatsAppService.sendPaymentRequestToBuyer(buyerPhone, escrowData);
}

async function handleConfirm(from: string, escrowId: string) {
  if (!escrowId) throw new Error('Please provide an Escrow ID. e.g., "confirm BP-123XYZ"');
  await EscrowService.releaseFunds(escrowId, from);
}

async function handleDispute(from: string, escrowId: string) {
  if (!escrowId) throw new Error('Please provide an Escrow ID. e.g., "dispute BP-123XYZ"');
  // A simple reason is used here. You could extend this to parse more complex reasons.
  await DisputeService.raiseDispute({ 
      escrowId: escrowId,
      raisedByPhone: from,
      reason: 'NOT_RECEIVED'
  });
}
