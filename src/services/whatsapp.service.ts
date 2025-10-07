
import twilio from 'twilio';
import { Sentry } from '@/config/sentry';

class WhatsAppService {
    private client: twilio.Twilio | null = null;
    private botNumber = process.env.BOT_PHONE_NUMBER!;

    constructor() {
        if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
            this.client = twilio(
                process.env.TWILIO_ACCOUNT_SID,
                process.env.TWILIO_AUTH_TOKEN
            );
        } else {
            console.warn("Twilio credentials not set. WhatsAppService will not send messages.");
        }
    }
    
    async sendMessage(to: string, body: string) {
        if (!this.client) {
            console.log(`Faking WhatsApp message to ${to}: ${body}`);
            return `fake_message_sid_${Date.now()}`;
        }
        try {
            const message = await this.client.messages.create({
                from: this.botNumber,
                to: `whatsapp:${to}`,
                body
            });
            
            return message.sid;
        } catch (error) {
            Sentry.captureException(error);
            console.error('WhatsApp send error:', error);
            throw error;
        }
    }

    async sendEscrowCreatedToSeller(sellerPhone: string, escrow: any) {
        const message = `🚀 Escrow Created!\n\n*ID:* ${escrow.id}\n*Item:* ${escrow.item_description}\n*Amount:* ${escrow.amount} USDC\n*Buyer:* ${escrow.buyer_phone}\n\nYou'll be notified when the buyer funds the escrow.`;
        return this.sendMessage(sellerPhone, message);
    }

    async sendPaymentRequestToBuyer(buyerPhone: string, escrow: any) {
        const message = `Action Required: Fund Escrow\n\n*ID:* ${escrow.id}\n*Item:* ${escrow.item_description}\n*Amount:* ${escrow.amount} USDC\n\nTo proceed, please fund your wallet and then use the fund command either here or in the simulator.`;
        return this.sendMessage(buyerPhone, message);
    }
    
    async sendPaymentConfirmed(phone: string, role: 'buyer' | 'seller', amount: number, escrowId: string) {
        let message;
        if (role === 'buyer') {
            message = `✅ Payment of ${amount} USDC confirmed for escrow *${escrowId}*.\n\nThe seller has been notified to send the item. We will hold the funds until you confirm delivery.`;
        } else {
            message = `✅ Buyer has funded the escrow *${escrowId}* with ${amount} USDC.\n\nPlease proceed with sending the item. Funds will be released to you upon buyer's confirmation.`;
        }
        return this.sendMessage(phone, message);
    }

    async sendDisputeRaised(phone: string, escrowId: string) {
        const message = `❗️ A dispute has been raised for escrow *${escrowId}*.\n\nOur team will review the case and contact both parties. Please check your email for further instructions.`;
        return this.sendMessage(phone, message);
    }
    
    async getHelpMessage(): Promise<string> {
        return `🤖 *BasePay Help*

*CREATE WALLET:*
/createwallet

*CHECK BALANCE:*
/balance

*CREATE ESCROW (Dashboard only):*
Use the web dashboard to create a new escrow transaction.

*CONFIRM DELIVERY (Buyer):*
confirm [escrow-id]

*RAISE DISPUTE:*
dispute [escrow-id]

*VIEW TRANSACTIONS:*
history`;
    }

    async sendHelpMessage(phone: string) {
        const message = await this.getHelpMessage();
        return this.sendMessage(phone, message);
    }
}

export default new WhatsAppService();
