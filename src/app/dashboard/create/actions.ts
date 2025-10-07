// src/app/dashboard/create/actions.ts
'use server';

import EscrowService from '@/services/escrow.service';
import { z } from 'zod';

const formSchema = z.object({
  buyerPhone: z.string().min(10, "Please enter a valid phone number with country code, e.g., +14155552671."),
  amount: z.coerce.number().positive("Amount must be positive."),
  description: z.string().min(3, "Please provide a short description.").max(100),
});

export async function createEscrowAction(values: z.infer<typeof formSchema>) {
  // This assumes the logged-in user's phone is available on the server-side,
  // perhaps through session management, which is not implemented here.
  // For now, we'll hardcode a seller phone for demonstration.
  const sellerPhone = process.env.SELLER_PHONE_FOR_DEMO || '+15550009876';

  await EscrowService.createEscrow({
    sellerPhone,
    buyerPhone: values.buyerPhone,
    amount: values.amount,
    description: values.description,
  });
}
