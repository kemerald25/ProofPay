// src/app/dashboard/create/actions.ts
'use server';

import EscrowService from '@/services/escrow.service';
import { z } from 'zod';

const formSchema = z.object({
  sellerPhone: z.string().min(10, "Please enter a valid phone number with country code, e.g., +14155552671."),
  buyerPhone: z.string().min(10, "Please enter a valid phone number with country code, e.g., +14155552671."),
  amount: z.coerce.number().positive("Amount must be positive."),
  description: z.string().min(3, "Please provide a short description.").max(100),
});

export async function createEscrowAction(values: z.infer<typeof formSchema>) {
  await EscrowService.createEscrow({
    sellerPhone: values.sellerPhone,
    buyerPhone: values.buyerPhone,
    amount: values.amount,
    description: values.description,
  });
}
