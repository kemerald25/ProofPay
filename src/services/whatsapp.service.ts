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
