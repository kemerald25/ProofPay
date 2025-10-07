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
import { Loader2, ArrowLeft } from "lucide-react";
import React from "react";
import { createEscrowAction } from "./actions";

const formSchema = z.object({
    sellerPhone: z.string().min(10, "Please enter a valid phone number with country code, e.g., +14155552671."),
    buyerPhone: z.string().min(10, "Please enter a valid phone number with country code, e.g., +14155552671."),
    amount: z.coerce.number().positive("Amount must be positive."),
    description: z.string().min(3, "Please provide a short description.").max(100),
  });

export default function CreateEscrowPage() {
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [currentStep, setCurrentStep] = React.useState(1);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            sellerPhone: "",
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
            setCurrentStep(1);
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

    const nextStep = async () => {
        const isValid = await form.trigger(currentStep === 1 ? ["sellerPhone", "buyerPhone"] : ["amount", "description"]);
        if (isValid) {
            setCurrentStep(prev => prev + 1);
        }
    }

    const prevStep = () => {
        setCurrentStep(prev => prev - 1);
    }

  return (
    <div className="space-y-6">
        <div className="flex items-center gap-4">
            {currentStep > 1 && <Button variant="ghost" size="icon" onClick={prevStep}><ArrowLeft/></Button>}
            <h1 className="text-3xl font-bold font-headline">Create New Escrow</h1>
        </div>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
                <Card>
                    <CardHeader>
                        <CardTitle>
                            Step {currentStep}: {
                                currentStep === 1 ? "Participant Information" :
                                currentStep === 2 ? "Transaction Details" : "Review & Confirm"
                            }
                        </CardTitle>
                        <CardDescription>
                             {
                                currentStep === 1 ? "Enter the phone numbers for the seller and buyer." :
                                currentStep === 2 ? "Enter the amount and a description of the item being sold." : "Please review the details before creating the escrow."
                            }
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {currentStep === 1 && (
                            <>
                                <FormField
                                    control={form.control}
                                    name="sellerPhone"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Seller's WhatsApp Number</FormLabel>
                                        <FormControl>
                                            <Input placeholder="+15550009876" {...field} />
                                        </FormControl>
                                        <FormDescription>
                                            This will be used as the seller's contact.
                                        </FormDescription>
                                        <FormMessage />
                                        </FormItem>
                                    )}
                                />
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
                                            Notifications will be sent to this number.
                                        </FormDescription>
                                        <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </>
                        )}
                         {currentStep === 2 && (
                            <>
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
                            </>
                        )}

                        {currentStep === 3 && (
                            <div className="space-y-2 rounded-lg border bg-secondary p-4">
                                <h3 className="text-lg font-medium">Escrow Summary</h3>
                                <div className="flex justify-between"><span>Seller:</span> <span className="font-mono">{form.getValues().sellerPhone}</span></div>
                                <div className="flex justify-between"><span>Buyer:</span> <span className="font-mono">{form.getValues().buyerPhone}</span></div>
                                <div className="flex justify-between"><span>Amount:</span> <span className="font-mono">{form.getValues().amount} USDC</span></div>
                                <div className="flex justify-between"><span>Item:</span> <span>{form.getValues().description}</span></div>
                            </div>
                        )}

                    </CardContent>
                    <CardFooter>
                        {currentStep < 3 && <Button type="button" onClick={nextStep}>Next Step</Button>}
                        {currentStep === 3 && 
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Confirm & Create Escrow
                            </Button>
                        }
                    </CardFooter>
                </Card>
            </form>
        </Form>
    </div>
  );
}
