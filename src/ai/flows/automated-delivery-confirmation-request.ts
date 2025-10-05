'use server';

/**
 * @fileOverview A flow to send automated delivery confirmation requests via WhatsApp,
 * using an LLM to decide on gentle or stronger language.
 *
 * - automatedDeliveryConfirmationRequest - A function that sends the delivery confirmation request.
 * - AutomatedDeliveryConfirmationRequestInput - The input type for the automatedDeliveryConfirmationRequest function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AutomatedDeliveryConfirmationRequestInputSchema = z.object({
  buyerPhone: z.string().describe('The phone number of the buyer.'),
  escrowId: z.string().describe('The ID of the escrow.'),
  itemDescription: z.string().describe('The description of the item.'),
  daysRemaining: z.number().describe('The number of days remaining until auto-release.'),
});

export type AutomatedDeliveryConfirmationRequestInput = z.infer<typeof AutomatedDeliveryConfirmationRequestInputSchema>;

export async function automatedDeliveryConfirmationRequest(input: AutomatedDeliveryConfirmationRequestInput): Promise<void> {
  await automatedDeliveryConfirmationRequestFlow(input);
}

const DeliveryConfirmationPromptSchema = z.object({
  message: z.string().describe('The message to send to the buyer.'),
});

const deliveryConfirmationPrompt = ai.definePrompt({
  name: 'deliveryConfirmationPrompt',
  input: {
    schema: AutomatedDeliveryConfirmationRequestInputSchema,
  },
  output: {schema: DeliveryConfirmationPromptSchema},
  prompt: `You are a helpful assistant that crafts WhatsApp messages to buyers to confirm delivery of an item in an escrow transaction.

  Based on the number of days remaining until auto-release, decide on the tone of the message. If there are more than 3 days remaining, use a gentle reminder. If there are 3 or fewer days remaining, use a stronger, more urgent tone.

  Here are the details of the escrow:
  - Buyer Phone: {{{buyerPhone}}}
  - Escrow ID: {{{escrowId}}}
  - Item Description: {{{itemDescription}}}
  - Days Remaining: {{{daysRemaining}}}

  Compose a WhatsApp message to the buyer asking them to confirm delivery of the item.

  If there are more than 3 days remaining, the message should be gentle and friendly. For example:
  "Hi! Just checking in to see if you've received your {{{itemDescription}}}. If so, please confirm by replying \"confirm {{{escrowId}}}\""

  If there are 3 or fewer days remaining, the message should be more urgent and direct. For example:
  "Important: Please confirm receipt of your {{{itemDescription}}} ASAP. Reply \"confirm {{{escrowId}}}\" to release funds. Auto-release in {{{daysRemaining}}} days!"

  Return only the content of the WhatsApp message. No explanation or preamble is required.
  `,
});

import WhatsAppService from "@/services/whatsapp.service";

const automatedDeliveryConfirmationRequestFlow = ai.defineFlow(
  {
    name: 'automatedDeliveryConfirmationRequestFlow',
    inputSchema: AutomatedDeliveryConfirmationRequestInputSchema,
  },
  async input => {
    const {output} = await deliveryConfirmationPrompt(input);
    await WhatsAppService.sendMessage(input.buyerPhone, output!.message);
  }
);
