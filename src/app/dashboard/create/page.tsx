// src/app/dashboard/create/page.tsx
"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
  } from "@/components/ui/form";
import { Loader2 } from "lucide-react";
import React from "react";
import EscrowService from "@/services/escrow.service"; // We need a way to call the service from the client.
                                                       // A server action would be ideal.

// Placeholder for a server action. In a real app, this would be in an actions.ts file.
async function createEscrowAction(values: z.infer<typeof formSchema>) {
    'use server';
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


const formSchema = z.object({
    buyerPhone: z.string().min(10, "Please enter a valid phone number with country code, e.g., +14155552671."),
    amount: z.coerce.number().positive("Amount must be positive."),
    description: z.string().min(3, "Please provide a short description.").max(100),
  });

export default function CreateEscrowPage() {
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            buyerPhone: "",
            amount: 0,
            description: "",
        },
    });

    async function onSubmit(values: z.infer<typeof formSchema>) {
        setIsSubmitting(true);
        try {
            await createEscrowAction(values);
            toast({
              title: "Escrow Created!",
              description: "Instructions have been sent to the buyer and seller via WhatsApp.",
            });
            form.reset();
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Error Creating Escrow',
                description: error.message || 'An unknown error occurred.',
            });
        } finally {
            setIsSubmitting(false);
        }
    }

  return (
    <div className="space-y-6">
        <h1 className="text-3xl font-bold font-headline">Create New Escrow</h1>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
                <Card>
                    <CardHeader>
                    <CardTitle>Escrow Details</CardTitle>
                    <CardDescription>
                        Fill in the details below to create a new secure escrow. Your phone number will be used as the seller's contact.
                    </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <FormField
                            control={form.control}
                            name="buyerPhone"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Buyer's WhatsApp Number</FormLabel>
                                <FormControl>
                                    <Input placeholder="+14155552671" {...field} />
                                </FormControl>
                                <FormDescription>
                                    Include the country code. This is where notifications will be sent.
                                </FormDescription>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="amount"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Amount (USDC)</FormLabel>
                                <FormControl>
                                    <Input type="number" placeholder="50.00" {...field} />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Item Description</FormLabel>
                                <FormControl>
                                    <Input
                                        placeholder="e.g., 'Vintage Leather Jacket, Size M'"
                                        {...field}
                                    />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                    </CardContent>
                    <CardFooter>
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Create Escrow
                    </Button>
                    </CardFooter>
                </Card>
            </form>
        </Form>
    </div>
  );
}
