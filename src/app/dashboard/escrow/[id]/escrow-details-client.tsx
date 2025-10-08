// src/app/dashboard/escrow/[id]/escrow-details-client.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import type { Escrow } from '@/lib/definitions';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { Check, Clock, Copy, ShieldAlert, User, Milestone, Send, Bot, Wallet, MessageSquarePlus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from "@/hooks/use-toast";

interface Message {
  from: 'user' | 'bot' | 'system';
  text: string;
  phone: string;
}

const CHAT_STORAGE_KEY_PREFIX = 'escrow-chat-';

const StatusBadge = ({ status }: { status: Escrow['status'] }) => {
    const variants = {
      CREATED: 'secondary',
      FUNDED: 'default',
      COMPLETED: 'outline',
      DISPUTED: 'destructive',
      REFUNDED: 'outline',
      CANCELLED: 'secondary',
    } as const;
    
    return <Badge variant={variants[status] ?? "secondary"}>{status}</Badge>;
};

const TimelineStep = ({ title, timestamp, isCompleted, isLast = false }: { title: string, timestamp?: string | null, isCompleted: boolean, isLast?: boolean }) => (
    <div className="flex gap-4">
        <div className="flex flex-col items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isCompleted ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}>
                {isCompleted ? <Check className="w-5 h-5" /> : <Clock className="w-5 h-5 text-muted-foreground" />}
            </div>
            {!isLast && <div className={`w-0.5 grow ${isCompleted ? 'bg-primary' : 'bg-border'}`}></div>}
        </div>
        <div>
            <p className="font-medium">{title}</p>
            {timestamp && <p className="text-sm text-muted-foreground">{format(parseISO(timestamp), "MMM d, yyyy 'at' h:mm a")}</p>}
        </div>
    </div>
);


export default function EscrowDetailsClient({ escrow }: { escrow: Escrow }) {
  const { toast } = useToast();
  // Chat state
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [chat, setChat] = useState<Message[]>([]);
  const [isSending, setIsSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatStorageKey = `${CHAT_STORAGE_KEY_PREFIX}${escrow.id}`;

  useEffect(() => {
    // Pre-populate with buyer phone, but allow user to change
    if (escrow) {
        setPhone(escrow.buyer_phone);
    }
  }, [escrow]);

  useEffect(() => {
    try {
      const savedChat = localStorage.getItem(chatStorageKey);
      if (savedChat) {
        setChat(JSON.parse(savedChat));
      } else {
        setChat([]);
      }
    } catch (error) {
      console.error("Failed to load chat from local storage", error);
    }
  }, [chatStorageKey]);
  
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    try {
      localStorage.setItem(chatStorageKey, JSON.stringify(chat));
    } catch (error) {
      console.error("Failed to save chat to local storage", error);
    }
  }, [chat, chatStorageKey]);

  const addMessageToChat = (msg: Message) => {
    setChat(prev => [...prev, msg]);
  }

  const handleApiCall = async (endpoint: string, body: object, operationName: string) => {
    addMessageToChat({ from: 'system', text: `⚙️  Executing ${operationName}...`, phone: 'System' });
    setIsSending(true);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || `Operation failed with status ${response.status}`);
      }
      const successText = result.message || `${operationName} successful.`;
      addMessageToChat({ from: 'bot', text: successText, phone: 'BasePay Bot' });
      return result;
    } catch (error: any) {
      const errorText = `❌ Error: ${error.message}`;
      addMessageToChat({ from: 'bot', text: errorText, phone: 'BasePay Bot' });
      toast({ variant: 'destructive', title: `Error: ${operationName}`, description: error.message });
      return null;
    } finally {
        setIsSending(false);
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !phone.trim()) return;
    addMessageToChat({ from: 'user', text: message, phone });
    await handleApiCall('/api/chat', { phone_number: phone, message, source: 'simulator' }, `Command: ${message}`);
    setMessage('');
  };

  const autoReleaseDistance = escrow.auto_release_time ? formatDistanceToNow(parseISO(escrow.auto_release_time), { addSuffix: true }) : '';

  return (
    <div className="space-y-6">
        <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold font-headline">Escrow Details</h1>
            <StatusBadge status={escrow.status} />
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <main className="lg:col-span-2 space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>{escrow.item_description}</CardTitle>
                        <CardDescription>Escrow ID: {escrow.id}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Amount</span>
                            <span className="font-bold text-lg">{escrow.amount} USDC</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Buyer</span>
                            <span className="font-mono text-sm">{escrow.buyer_phone}</span>
                        </div>
                         <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Seller</span>
                            <span className="font-mono text-sm">{escrow.seller_phone}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Auto-release</span>
                            <span className="font-medium text-amber-600">{autoReleaseDistance}</span>
                        </div>
                    </CardContent>
                </Card>
                
                <Card>
                    <CardHeader>
                        <CardTitle>Timeline</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <TimelineStep title="Escrow Created" timestamp={escrow.created_at} isCompleted={!!escrow.created_at} />
                        <TimelineStep title="Escrow Funded" timestamp={escrow.funded_at} isCompleted={!!escrow.funded_at} />
                        <TimelineStep title="Delivery Confirmed" timestamp={escrow.completed_at} isCompleted={!!escrow.completed_at} />
                        <TimelineStep title="Funds Released" timestamp={escrow.completed_at} isCompleted={!!escrow.completed_at} isLast={true} />
                    </CardContent>
                </Card>
            </main>
            <aside className="space-y-6">
                <Card className="flex-1 flex flex-col max-h-[calc(100vh-150px)]">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><MessageSquarePlus/> Chat Simulator</CardTitle>
                        <CardDescription>Simulate messages between buyer and seller.</CardDescription>
                    </CardHeader>
                     <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
                        {chat.map((msg, index) => (
                            <div key={index} className={`flex items-start gap-3 ${msg.phone === phone ? 'justify-end' : ''}`}>
                                {msg.phone !== phone && (
                                    <div className="flex-shrink-0">
                                        {msg.from === 'bot' ? <Bot className="h-8 w-8 text-primary" /> : <Wallet className="h-8 w-8 text-slate-400"/>}
                                    </div>
                                )}
                                <div className={cn(
                                    "rounded-lg p-3 max-w-xs",
                                    msg.phone === phone ? 'bg-primary text-primary-foreground' : 'bg-secondary',
                                    msg.from === 'system' && 'bg-blue-50 text-blue-800 text-xs w-full text-center'
                                )}>
                                    <p className="text-sm font-medium whitespace-pre-wrap">{msg.text}</p>
                                    <p className="text-xs opacity-70 mt-1">{msg.from !== 'system' ? msg.phone : ''}</p>
                                </div>
                                {msg.phone === phone && <User className="h-8 w-8 text-secondary-foreground" />}
                            </div>
                        ))}
                        <div ref={chatEndRef} />
                    </CardContent>
                    <div className="p-4 border-t space-y-4">
                        <div className="space-y-2">
                           <Label htmlFor="phone">Chatting as:</Label>
                            <Input
                            id="phone"
                            value={phone}
                            onChange={e => setPhone(e.target.value)}
                            placeholder="Buyer or Seller Phone"
                            />
                        </div>
                        <form onSubmit={handleSendMessage} className="space-y-2">
                            <Label htmlFor="message">Command Message</Label>
                            <div className="flex gap-2">
                            <Input
                                id="message"
                                value={message}
                                onChange={e => setMessage(e.target.value)}
                                placeholder={`e.g., confirm ${escrow.id}`}
                                disabled={isSending}
                            />
                            <Button type="submit" disabled={isSending} size="icon">
                                {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                            </Button>
                            </div>
                        </form>
                    </div>
                </Card>
            </aside>
        </div>
    </div>
  );
}
