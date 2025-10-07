'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, User, Bot, RefreshCw, Wallet, Send, FilePlus2, MessageSquarePlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

interface Message {
  from: 'user' | 'bot' | 'system';
  text: string;
  phone: string;
}

const CHAT_STORAGE_KEY = 'whatsapp-simulator-chat-v2';

export default function WhatsAppSimulatorPage() {
  const [phone, setPhone] = useState('+15550001111');
  const [message, setMessage] = useState('');
  const [chat, setChat] = useState<Message[]>([]);
  const [isSending, setIsSending] = useState(false);
  
  const [createStep, setCreateStep] = useState(1);
  const [createPayload, setCreatePayload] = useState({ buyerPhone: '+15550002222', amount: '50', description: 'A beautiful widget'});
  
  const [fundEscrowId, setFundEscrowId] = useState('');
  const [isFunding, setIsFunding] = useState(false);

  const { toast } = useToast();
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const savedChat = localStorage.getItem(CHAT_STORAGE_KEY);
      if (savedChat) {
        setChat(JSON.parse(savedChat));
      }
    } catch (error) {
      console.error("Failed to load chat from local storage", error);
    }
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    try {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(chat));
    } catch (error) {
      console.error("Failed to save chat to local storage", error);
    }
  }, [chat]);
  
  const addMessageToChat = (msg: Message) => {
    setChat(prev => [...prev, msg]);
  }

  const handleApiCall = async (endpoint: string, body: object, operationName: string) => {
    addMessageToChat({ from: 'system', text: `⚙️  Calling ${operationName}...`, phone: 'System' });
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || result.details || `Operation failed with status ${response.status}`);
      }
      
      const successText = result.message || `${operationName} successful.`;
      addMessageToChat({ from: 'system', text: `✅ ${successText}`, phone: 'System' });

      if (result.replies && Array.isArray(result.replies)) {
        const botMessages: Message[] = result.replies.map((reply: any) => ({
          from: 'bot',
          text: reply.body,
          phone: reply.to
        }));
        setChat(prev => [...prev, ...botMessages]);
      }
      
      return result;

    } catch (error: any) {
      console.error(`Error during ${operationName}:`, error);
      const errorText = `❌ Error during ${operationName}: ${error.message}`;
      addMessageToChat({ from: 'system', text: errorText, phone: 'System' });
      toast({ variant: 'destructive', title: `Error: ${operationName}`, description: error.message });
      return null;
    }
  }


  const handleFundEscrow = async () => {
    if (!fundEscrowId.trim()) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please enter an Escrow ID' });
      return;
    }
    
    // We need to know which user is funding, let's assume the current 'phone' input is the buyer.
    if (!phone) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please enter a "Your Phone Number" to act as the buyer.' });
      return;
    }

    setIsFunding(true);
    await handleApiCall('/api/escrow/fund', { escrowId: fundEscrowId, buyerPhone: phone }, 'Fund Escrow');
    setIsFunding(false);
  };
  
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !phone.trim()) return;

    addMessageToChat({ from: 'user', text: message, phone });
    setIsSending(true);
    
    await handleApiCall('/api/simulator', { from: phone, message }, 'WhatsApp Command');
    
    setMessage('');
    setIsSending(false);
  };

  const renderCreateStep = () => {
    switch(createStep) {
      case 1:
        return (
          <div className="space-y-2">
            <Label htmlFor="buyerPhone">Buyer's WhatsApp Phone</Label>
            <Input id="buyerPhone" value={createPayload.buyerPhone} onChange={(e) => setCreatePayload({...createPayload, buyerPhone: e.target.value})} placeholder="+14155552671" />
          </div>
        );
      case 2:
        return (
          <div className="space-y-2">
            <Label htmlFor="amount">Amount (USDC)</Label>
            <Input id="amount" type="number" value={createPayload.amount} onChange={(e) => setCreatePayload({...createPayload, amount: e.target.value})} placeholder="50.00" />
          </div>
        );
      case 3:
        return (
          <div className="space-y-2">
            <Label htmlFor="description">Item Description</Label>
            <Input id="description" value={createPayload.description} onChange={(e) => setCreatePayload({...createPayload, description: e.target.value})} placeholder="Vintage Leather Jacket" />
          </div>
        );
      default:
        return null;
    }
  }

  const handleCreateNext = async () => {
    if (createStep < 3) {
      setCreateStep(prev => prev + 1);
    } else {
        // Final step: submit
        setIsSending(true);
        const fullMessage = `${createPayload.buyerPhone} ${createPayload.amount} ${createPayload.description}`;
        addMessageToChat({ from: 'user', text: `(Sent via UI) Create Escrow:\n- To: ${createPayload.buyerPhone}\n- Amount: ${createPayload.amount}\n- Item: ${createPayload.description}`, phone: phone });
        
        await handleApiCall('/api/simulator', { from: phone, message: fullMessage }, 'Create Escrow');
        
        // Reset
        setCreateStep(1);
        setIsSending(false);
    }
  }

  return (
    <div className="space-y-6 h-[calc(100vh-100px)] flex flex-col">
       <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold font-headline">WhatsApp Simulator</h1>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        <div className="lg:col-span-2 flex flex-col">
          <Card className="flex-1 flex flex-col">
            <CardHeader>
              <CardTitle>Chat Window</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
              {chat.map((msg, index) => (
                <div key={index} className={`flex items-start gap-3 ${msg.from === 'user' ? 'justify-end' : ''}`}>
                  {msg.from !== 'user' && (
                    <div className="flex-shrink-0">
                      {msg.from === 'bot' ? <Bot className="h-8 w-8 text-primary" /> : <div className="w-8 h-8 flex items-center justify-center bg-slate-200 rounded-full"><RefreshCw className="h-4 w-4 text-slate-500"/></div>}
                    </div>
                  )}
                  <div className={cn(
                    "rounded-lg p-3 max-w-md",
                     msg.from === 'user' ? 'bg-primary text-primary-foreground' : 'bg-secondary',
                     msg.from === 'system' && 'bg-blue-50 text-blue-800 text-xs'
                  )}>
                    <p className="text-sm font-medium whitespace-pre-wrap">{msg.text}</p>
                    <p className="text-xs opacity-70 mt-1">{msg.phone}</p>
                  </div>
                  {msg.from === 'user' && <User className="h-8 w-8 text-secondary-foreground" />}
                </div>
              ))}
              <div ref={chatEndRef} />
            </CardContent>
             <div className="p-4 border-t space-y-2">
                <Label htmlFor="phone">Your Active Phone Number (Sender)</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="e.g. +14155551234"
                />
            </div>
          </Card>
        </div>

        <div className="space-y-6">

          {/* Create Escrow Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><FilePlus2/>Create Escrow</CardTitle>
              <CardDescription>Simulate a seller creating an escrow. You are the seller.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className={cn("h-6 w-6 rounded-full flex items-center justify-center", createStep >= 1 ? "bg-primary text-primary-foreground" : "bg-secondary")}>1</div>
                    <Separator className={cn("flex-1", createStep > 1 && "bg-primary")}/>
                    <div className={cn("h-6 w-6 rounded-full flex items-center justify-center", createStep >= 2 ? "bg-primary text-primary-foreground" : "bg-secondary")}>2</div>
                     <Separator className={cn("flex-1", createStep > 2 && "bg-primary")}/>
                    <div className={cn("h-6 w-6 rounded-full flex items-center justify-center", createStep >= 3 ? "bg-primary text-primary-foreground" : "bg-secondary")}>3</div>
                </div>
                {renderCreateStep()}
              </div>
            </CardContent>
            <CardFooter>
               <Button onClick={handleCreateNext} disabled={isSending} className="w-full">
                {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {createStep === 3 ? "Create Escrow" : "Next Step"}
              </Button>
            </CardFooter>
          </Card>

          {/* Fund Escrow Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Wallet/>Fund Escrow</CardTitle>
              <CardDescription>Simulate a buyer funding an escrow from their generated wallet.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="fundEscrowId">Escrow ID</Label>
                <Input
                  id="fundEscrowId"
                  value={fundEscrowId}
                  onChange={e => setFundEscrowId(e.target.value)}
                  placeholder="e.g. BPCABCDE"
                  disabled={isFunding}
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleFundEscrow} disabled={isFunding || !fundEscrowId.trim()} className="w-full">
                {isFunding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Fund from Buyer's Wallet"}
              </Button>
            </CardFooter>
          </Card>
          
          {/* Manual Command */}
          <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><MessageSquarePlus/>Send Command</CardTitle>
                 <CardDescription>Send a raw WhatsApp command like `confirm`, `dispute`, or `history`.</CardDescription>
            </CardHeader>
            <CardContent>
               <form onSubmit={handleSendMessage} className="space-y-2">
                <Label htmlFor="message">Command Message</Label>
                <div className="flex gap-2">
                  <Input
                    id="message"
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder='e.g., confirm BPXHJP4U'
                    disabled={isSending}
                  />
                  <Button type="submit" disabled={isSending} size="icon">
                    {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}
