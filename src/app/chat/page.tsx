"use client";

import { useState, useEffect } from 'react';
import { SidebarProvider, Sidebar, SidebarInset, SidebarHeader, SidebarTrigger, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarFooter } from '@/components/ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MoreVertical, Paperclip, Send, Plus, RefreshCw } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { triageNotification } from '@/ai/flows/notification-triage';
import { generateContactCode } from '@/ai/flows/user-codes';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, Timestamp, doc, setDoc, getDoc, updateDoc, where, getDocs } from 'firebase/firestore';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"


interface Message {
  id: string;
  sender: 'user' | 'other';
  text: string;
  avatar: string;
  alt: string;
  timestamp: Timestamp | null;
}

// A simple mock user ID. In a real app, this would come from an auth system.
const CURRENT_USER_ID = "user1";

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [contactCode, setContactCode] = useState('');
  const [addContactCode, setAddContactCode] = useState('');
  const [isAddContactOpen, setAddContactOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Listen for messages
    const q = query(collection(db, 'messages'), orderBy('timestamp'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const msgs: Message[] = [];
      querySnapshot.forEach((doc) => {
        msgs.push({ id: doc.id, ...doc.data() } as Message);
      });
      setMessages(msgs);
    });

    // Fetch or create user data
    const userDocRef = doc(db, 'users', CURRENT_USER_ID);
    const getUserData = async () => {
      const docSnap = await getDoc(userDocRef);
      if (docSnap.exists()) {
        setContactCode(docSnap.data().contactCode);
      } else {
        // First time user, create a document and generate a code.
        handleGenerateCode();
      }
    };
    getUserData();

    return () => unsubscribe();
  }, []);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim() === '') return;

    const messageContent = newMessage;
    setNewMessage('');

    try {
      await addDoc(collection(db, 'messages'), {
        sender: 'user',
        text: messageContent,
        avatar: 'https://picsum.photos/100/100',
        alt: 'User Avatar',
        timestamp: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error sending message:', error);
       toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not send message.',
      });
    }

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
  
  const handleGenerateCode = async () => {
    try {
      const result = await generateContactCode();
      const newCode = result.code;
      const userDocRef = doc(db, 'users', CURRENT_USER_ID);
      await setDoc(userDocRef, { contactCode: newCode, contacts: [] }, { merge: true });
      setContactCode(newCode);
      toast({
        title: 'New Code Generated',
        description: `Your new contact code is: ${newCode}`,
      });
    } catch (error) {
      console.error("Error generating contact code:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not generate a new contact code.",
      })
    }
  };

  const handleAddContact = async () => {
    if (!addContactCode.trim()) return;
    
    try {
      const q = query(collection(db, "users"), where("contactCode", "==", addContactCode));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        toast({
          variant: 'destructive',
          title: 'Invalid Code',
          description: 'No user found with that contact code.',
        });
        return;
      }
      
      const newContactId = querySnapshot.docs[0].id;
      const newContactData = querySnapshot.docs[0].data();

      // Add to current user's contacts
      const userDocRef = doc(db, 'users', CURRENT_USER_ID);
      const userDoc = await getDoc(userDocRef);
      const userData = userDoc.data();
      const updatedContacts = [...(userData?.contacts || []), { id: newContactId, name: newContactData.name || `User ${newContactId}` }];
      await updateDoc(userDocRef, { contacts: updatedContacts });

      toast({
        title: 'Contact Added!',
        description: `You've successfully added the new contact.`,
      });
      setAddContactCode('');
      setAddContactOpen(false);

    } catch (error) {
       console.error("Error adding contact:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not add contact.",
      })
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
            <SidebarFooter>
               <Dialog open={isAddContactOpen} onOpenChange={setAddContactOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Contact
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add a new contact</DialogTitle>
                    <DialogDescription>
                      Enter the unique code of the person you want to chat with.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <Label htmlFor="contact-code">Contact Code</Label>
                    <Input
                      id="contact-code"
                      value={addContactCode}
                      onChange={(e) => setAddContactCode(e.target.value)}
                      placeholder="e.g. blue-tree-123"
                    />
                  </div>
                  <DialogFooter>
                    <Button onClick={handleAddContact}>Add Contact</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Card className="p-2">
                <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground font-mono truncate">{contactCode || 'loading...'}</p>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleGenerateCode}>
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                </div>
              </Card>
            </SidebarFooter>
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
