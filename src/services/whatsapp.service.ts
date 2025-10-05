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
🔐 Escrow ID: ${escrowData.escrowId}

I've notified the buyer. You'll receive payment once they send USDC to the escrow address.

Payment will auto-release in 7 days after funding. 🔒`;
        
        return this.sendMessage(sellerPhone, message);
    }
    
    async sendPaymentRequestToBuyer(buyerPhone: string, escrowData: any) {
        const message = `💳 *Payment Request on BasePay*

Seller is requesting payment:
💰 Amount: ${escrowData.amount} USDC
🛍️ Item: ${escrowData.description}
🔐 Escrow ID: ${escrowData.escrowId}

*HOW TO PAY:*
1. Open your crypto wallet (e.g., Coinbase Wallet)
2. Send exactly ${escrowData.amount} USDC on Base network to:

\`${escrowData.paymentAddress}\`

⚠️ *IMPORTANT:*
• Network: Base
• Token: USDC
• Amount: Exactly ${escrowData.amount}

Your payment is protected! 🔒
Funds stay in escrow until you confirm delivery.

Need help? Reply "help"`;
        
        return this.sendMessage(buyerPhone, message);
    }
    
    async sendPaymentConfirmed(phone: string, role: 'buyer' | 'seller', amount: number, escrowId: string) {
        const buyerMsg = `✅ *Payment Confirmed!*

${amount} USDC is now secured in escrow! 🔒

The seller will deliver your item. When you receive it, reply:
"confirm ${escrowId}"

Funds will auto-release in 7 days if no issues.

Have a problem? Reply "dispute ${escrowId}"`;
        
        const sellerMsg = `✅ *Payment Received!*

${amount} USDC is now in escrow! 🔒

Deliver the item to the buyer. They'll confirm receipt and funds will be released to you.

Funds auto-release in 7 days. 💰`;
        
        return this.sendMessage(phone, role === 'buyer' ? buyerMsg : sellerMsg);
    }
    
    async sendDeliveryConfirmationRequest(buyerPhone: string, escrowId: string, description: string, daysRemaining: number) {
        const message = `📦 *Delivery Check*

Did you receive your ${description}?

Reply "confirm ${escrowId}" to release payment to seller.

⚠️ Funds auto-release in ${daysRemaining} day(s) if no response.

Problem? Reply "dispute ${escrowId}"`;
        
        return this.sendMessage(buyerPhone, message);
    }
    
    async sendFundsReleased(sellerPhone: string, netAmount: number) {
        const message = `💰 *Funds Released!*

You received: ${netAmount.toFixed(2)} USDC

Check your wallet.

Transaction complete! 🎉

Thanks for using BasePay! 🙏`;
        
        return this.sendMessage(sellerPhone, message);
    }
    
    async sendDisputeRaised(phone: string, escrowId: string) {
        const message = `⚠️ *Dispute Raised*

Escrow ID: ${escrowId}

An arbitrator will review this case within 24-48 hours.

Please be ready to provide:
• Photos/videos of the item
• Communication history
• Any other evidence

We'll contact you soon. 📞`;
        
        return this.sendMessage(phone, message);
    }
    
    async sendHelpMessage(phone: string) {
        const message = `🤖 *BasePay Help*

*CREATE ESCROW (Seller):*
+[buyer-phone] [amount] [item]
Example: +1234567890 50 iPhone case

*CONFIRM DELIVERY (Buyer):*
confirm [escrow-id]

*RAISE DISPUTE:*
dispute [escrow-id]

*MY TRANSACTIONS:*
history

Need more help? Visit our website.`;
        
        return this.sendMessage(phone, message);
    }
}

export default new WhatsAppService();
