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
    
    async sendEscrowCreatedToSeller(sellerPhone: string, escrowData: any) {
        const message = `✅ *Escrow Created on BasePay!*

💰 Amount: ${escrowData.amount} USDC
🛍️ Item: ${escrowData.description}
👤 Buyer: ${escrowData.buyerPhone}
🔐 Escrow ID: ${escrowId}

I've sent funding instructions to the buyer. You'll be notified once they've sent the payment to the secure escrow contract.

Payment will auto-release in 7 days after funding. 🔒`;
        
        return this.sendMessage(sellerPhone, message);
    }
    
    async sendPaymentRequestToBuyer(buyerPhone: string, escrowData: any) {
        const message = `💳 *Payment Request on BasePay*

Seller has created an escrow for you:
💰 Amount: ${escrowData.amount} USDC
🛍️ Item: ${escrowData.description}
🔐 Escrow ID: ${escrowData.escrowId}

*Your funds are protected!* 🔒
Reply "fund ${escrowData.escrowId}" to transfer USDC from your BasePay wallet into the secure escrow.

Need help? Reply "help"`;
        
        return this.sendMessage(buyerPhone, message);
    }
    
    async sendPaymentConfirmed(phone: string, role: 'buyer' | 'seller', amount: number, escrowId: string) {
        const buyerMsg = `✅ *Payment Confirmed!*

${amount} USDC is now secured in escrow! 🔒

The seller will now deliver your item. When you receive it, reply:
"confirm ${escrowId}"

Funds will auto-release in 7 days if there are no issues.

Problem? Reply "dispute ${escrowId}"`;
        
        const sellerMsg = `✅ *Payment Received!*

${amount} USDC is now in escrow for your item! 🔒

Please deliver the item to the buyer. They will confirm receipt, and your funds will be released.

Funds will auto-release in 7 days. 💰`;
        
        return this.sendMessage(phone, role === 'buyer' ? buyerMsg : sellerMsg);
    }
    
    async sendDeliveryConfirmationRequest(buyerPhone: string, escrowId: string, description: string, daysRemaining: number) {
        const message = `📦 *Delivery Check*

Did you receive your ${description}?

Reply "confirm ${escrowId}" to release payment to the seller.

⚠️ Funds will auto-release in ${daysRemaining} day(s) if no response.

Have a problem? Reply "dispute ${escrowId}"`;
        
        return this.sendMessage(buyerPhone, message);
    }
    
    async sendFundsReleased(sellerPhone: string, netAmount: number) {
        const message = `💰 *Funds Released!*

You have received: ${netAmount.toFixed(2)} USDC

Please check your wallet.

Transaction complete! 🎉

Thanks for using BasePay! 🙏`;
        
        return this.sendMessage(sellerPhone, message);
    }
    
    async sendDisputeRaised(phone: string, escrowId: string) {
        const message = `⚠️ *Dispute Raised*

A dispute has been opened for Escrow ID: ${escrowId}

An arbitrator will review this case within 24-48 hours.

Please be ready to provide any necessary evidence like photos, videos, or communication history. We will contact you if more information is needed. 📞`;
        
        return this.sendMessage(phone, message);
    }
    
    async sendHelpMessage(phone: string) {
        const message = `🤖 *BasePay Help*

*CREATE ESCROW (Dashboard only):*
Use the web dashboard to create a new escrow transaction.

*FUND ESCROW (Buyer):*
fund [escrow-id]

*CONFIRM DELIVERY (Buyer):*
confirm [escrow-id]

*RAISE DISPUTE:*
dispute [escrow-id]

*VIEW TRANSACTIONS:*
history

Need more help? Visit our website.`;
        
        return this.sendMessage(phone, message);
    }
}

export default new WhatsAppService();
