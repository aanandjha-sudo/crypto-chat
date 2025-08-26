"use client";

import { useState } from 'react';
import { SidebarProvider, Sidebar, SidebarInset, SidebarHeader, SidebarTrigger, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MoreVertical, Paperclip, Send } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { triageNotification } from '@/ai/flows/notification-triage';
import { useToast } from '@/hooks/use-toast';

interface Message {
  id: number;
  sender: 'user' | 'other';
  text: string;
  avatar: string;
  alt: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, sender: 'other', text: 'Hey, how is it going?', avatar: 'https://picsum.photos/100/100', alt: 'Alice' },
    { id: 2, sender: 'user', text: 'Pretty good! Just working on this new app.', avatar: 'https://picsum.photos/100/100', alt: 'User Avatar' },
  ]);
  const [newMessage, setNewMessage] = useState('');
  const { toast } = useToast();

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim() === '') return;

    const newMessageObj: Message = {
      id: messages.length + 1,
      sender: 'user',
      text: newMessage,
      avatar: 'https://picsum.photos/100/100',
      alt: 'User Avatar',
    };

    setMessages([...messages, newMessageObj]);
    const messageContent = newMessage;
    setNewMessage('');

    try {
      const result = await triageNotification({ messageContent });
      toast({
        title: result.shouldSendNotification
          ? 'Notification Would Be Sent'
          : 'Notification Would Not Be Sent',
        description: result.reason,
      });
    } catch (error) {
      console.error('Error triaging notification:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not triage notification.',
      });
    }
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen bg-background">
        <Sidebar>
          <SidebarHeader>
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src="https://picsum.photos/100/100" alt="User Avatar" data-ai-hint="female person" />
                <AvatarFallback>U</AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-foreground">User</span>
                <span className="text-xs text-muted-foreground">user@email.com</span>
              </div>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Alice" isActive={true}>
                  <Avatar className="h-8 w-8">
                    <AvatarImage src="https://picsum.photos/100/100" alt="Alice" data-ai-hint="woman person" />
                    <AvatarFallback>A</AvatarFallback>
                  </Avatar>
                  <span className="truncate">Alice</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Bob">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src="https://picsum.photos/101/101" alt="Bob" data-ai-hint="man person" />
                    <AvatarFallback>B</AvatarFallback>
                  </Avatar>
                  <span className="truncate">Bob</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarContent>
        </Sidebar>
        <SidebarInset className="flex flex-col">
          <header className="flex h-14 items-center justify-between border-b bg-background px-4">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="md:hidden" />
              <Avatar className="h-8 w-8">
                <AvatarImage src="https://picsum.photos/100/100" alt="Alice" data-ai-hint="woman person"/>
                <AvatarFallback>A</AvatarFallback>
              </Avatar>
              <span className="font-semibold">Alice</span>
            </div>
            <Button variant="ghost" size="icon">
              <MoreVertical className="h-5 w-5" />
            </Button>
          </header>
          <ScrollArea className="flex-1">
            <main className="p-4">
              <div className="space-y-4">
                {messages.map((message) => (
                  <div key={message.id} className={`flex items-start gap-3 ${message.sender === 'user' ? 'flex-row-reverse' : ''}`}>
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={message.avatar} alt={message.alt} data-ai-hint={message.sender === 'user' ? 'female person' : 'woman person'} />
                      <AvatarFallback>{message.alt.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <Card className={`rounded-2xl p-3 ${message.sender === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                      <CardContent className="p-0">
                        <p className="text-sm">{message.text}</p>
                      </CardContent>
                    </Card>
                  </div>
                ))}
              </div>
            </main>
          </ScrollArea>
          <footer className="border-t bg-background p-4">
            <form onSubmit={handleSendMessage} className="relative">
              <Input
                placeholder="Type a message..."
                className="pr-24"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
              />
              <div className="absolute inset-y-0 right-0 flex items-center">
                <Button variant="ghost" size="icon" type="button">
                  <Paperclip className="h-5 w-5" />
                </Button>
                <Button variant="ghost" size="icon" type="submit">
                  <Send className="h-5 w-5" />
                </Button>
              </div>
            </form>
          </footer>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
