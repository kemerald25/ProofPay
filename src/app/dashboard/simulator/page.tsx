'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, User, Bot, Wallet, Send, MessageSquarePlus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Message {
  from: 'user' | 'bot' | 'system';
  text: string;
  phone: string;
}

const CHAT_STORAGE_KEY = 'whatsapp-simulator-chat-v3';

export default function WhatsAppSimulatorPage() {
  const [phone, setPhone] = useState('+15550001111');
  const [message, setMessage] = useState('');
  const [chat, setChat] = useState<Message[]>([]);
  const [isSending, setIsSending] = useState(false);
  
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
      console.error(`Error during ${operationName}:`, error);
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
    await handleApiCall('/api/chat', { phone_number: phone, message: message, source: 'simulator' }, `Command: ${message}`);
    setMessage('');
  };

  const handleQuickAction = async (command: string, name: string) => {
    addMessageToChat({ from: 'user', text: command, phone });
    await handleApiCall('/api/chat', { phone_number: phone, message: command, source: 'simulator' }, name);
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
                      {msg.from === 'bot' ? <Bot className="h-8 w-8 text-primary" /> : <Wallet className="h-8 w-8 text-slate-400"/>}
                    </div>
                  )}
                  <div className={cn(
                    "rounded-lg p-3 max-w-md",
                     msg.from === 'user' ? 'bg-primary text-primary-foreground' : 'bg-secondary',
                     msg.from === 'system' && 'bg-blue-50 text-blue-800 text-xs w-full text-center'
                  )}>
                    <p className="text-sm font-medium whitespace-pre-wrap">{msg.text}</p>
                    <p className="text-xs opacity-70 mt-1">{msg.from !== 'system' ? msg.phone : ''}</p>
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
          <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><MessageSquarePlus/>Send Command</CardTitle>
                 <CardDescription>Send a raw WhatsApp command.</CardDescription>
            </CardHeader>
            <CardContent>
               <form onSubmit={handleSendMessage} className="space-y-2">
                <Label htmlFor="message">Command Message</Label>
                <div className="flex gap-2">
                  <Input
                    id="message"
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder='e.g., /createwallet'
                    disabled={isSending}
                  />
                  <Button type="submit" disabled={isSending} size="icon">
                    {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

           <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">Quick Actions</CardTitle>
                 <CardDescription>Common commands for the active phone number.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
               <Button onClick={() => handleQuickAction('/createwallet', 'Create Wallet')} disabled={isSending} variant="outline">
                    {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wallet className="mr-2 h-4 w-4" />}
                    Create Wallet
                </Button>
                <Button onClick={() => handleQuickAction('/balance', 'Check Balance')} disabled={isSending} variant="outline">
                    {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wallet className="mr-2 h-4 w-4" />}
                    Check Balance
                </Button>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}
