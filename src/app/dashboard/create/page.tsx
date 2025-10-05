// This form would use server actions to call the EscrowService
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

const formSchema = z.object({
    buyerPhone: z.string().min(10, "Please enter a valid phone number with country code."),
    sellerWallet: z.string().refine((val) => val.startsWith("0x") && val.length === 42, {
        message: "Please enter a valid Ethereum wallet address.",
    }),
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
            sellerWallet: "",
            amount: 0,
            description: "",
        },
    });

    async function onSubmit(values: z.infer<typeof formSchema>) {
        setIsSubmitting(true);
        // Here you would call a server action
        // await createEscrowAction(values);
        console.log(values);
        
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 2000));

        toast({
          title: "Escrow Created!",
          description: "Instructions have been sent to the buyer via WhatsApp.",
        });
        form.reset();
        setIsSubmitting(false);
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
                        Fill in the details below to create a new secure escrow. The seller's phone will be your own.
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
                                    Include the country code.
                                </FormDescription>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="sellerWallet"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Seller's Wallet Address</FormLabel>
                                <FormControl>
                                    <Input placeholder="0x..." {...field} />
                                </FormControl>
                                <FormDescription>
                                    This is where the funds will be sent upon release.
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
                                    <Textarea
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
