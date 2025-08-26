"use client";

import { useState, useEffect, useMemo } from 'react';
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
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, Timestamp, doc, setDoc, getDoc, updateDoc, where, getDocs, DocumentData } from 'firebase/firestore';
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
  senderId: string;
  text: string;
  timestamp: Timestamp | null;
}

interface Contact {
  id: string;
  name: string;
  avatar: string;
}

interface UserData {
    contactCode: string;
    contacts: Contact[];
}

// A simple mock user ID. In a real app, this would come from an auth system.
const CURRENT_USER_ID = "user1";
const CURRENT_USER_NAME = "User";
const CURRENT_USER_AVATAR = "https://picsum.photos/100/100";


export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [userData, setUserData] = useState<UserData | null>(null);
  const [addContactCode, setAddContactCode] = useState('');
  const [isAddContactOpen, setAddContactOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const { toast } = useToast();

  const conversationId = useMemo(() => {
    if (!selectedContact) return null;
    // Create a consistent conversation ID between two users
    return [CURRENT_USER_ID, selectedContact.id].sort().join('_');
  }, [selectedContact]);


  useEffect(() => {
    // Fetch or create user data
    const userDocRef = doc(db, 'users', CURRENT_USER_ID);
    const getUserData = async () => {
      const docSnap = await getDoc(userDocRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as UserData;
        setUserData(data);
        if(data.contacts && data.contacts.length > 0 && !selectedContact) {
            setSelectedContact(data.contacts[0]);
        }
      } else {
        // First time user, create a document and generate a code.
        const { code } = await generateContactCode();
        const newUser: UserData = { contactCode: code, contacts: [] };
        await setDoc(userDocRef, newUser);
        setUserData(newUser);
      }
    };
    getUserData();
  }, []);

  useEffect(() => {
    if (!conversationId) return;

    // Listen for messages in the current conversation
    const messagesColRef = collection(db, 'conversations', conversationId, 'messages');
    const q = query(messagesColRef, orderBy('timestamp'));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const msgs: Message[] = [];
      querySnapshot.forEach((doc) => {
        msgs.push({ id: doc.id, ...doc.data() } as Message);
      });
      setMessages(msgs);
    });

    return () => unsubscribe();
  }, [conversationId]);


  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim() === '' || !conversationId) return;

    const messageContent = newMessage;
    setNewMessage('');

    try {
      const messagesColRef = collection(db, 'conversations', conversationId, 'messages');
      await addDoc(messagesColRef, {
        senderId: CURRENT_USER_ID,
        text: messageContent,
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
      await updateDoc(userDocRef, { contactCode: newCode });
      setUserData(prev => prev ? {...prev, contactCode: newCode} : null);
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
      
      const newContactDoc = querySnapshot.docs[0];
      const newContactId = newContactDoc.id;
      
      if(newContactId === CURRENT_USER_ID) {
        toast({
          variant: 'destructive',
          title: 'Cannot Add Yourself',
          description: 'You cannot add yourself as a contact.',
        });
        return;
      }
      
      if(userData?.contacts.find(c => c.id === newContactId)) {
        toast({
          variant: 'destructive',
          title: 'Contact Exists',
          description: 'This user is already in your contact list.',
        });
        return;
      }


      const newContactData = newContactDoc.data();
      const newContact: Contact = { 
          id: newContactId, 
          name: newContactData.name || `User ${newContactId}`, 
          avatar: newContactData.avatar || `https://picsum.photos/seed/${newContactId}/100/100` 
      };

      // Add to current user's contacts
      const userDocRef = doc(db, 'users', CURRENT_USER_ID);
      const updatedContacts = [...(userData?.contacts || []), newContact];
      await updateDoc(userDocRef, { contacts: updatedContacts });
      
      setUserData(prev => prev ? {...prev, contacts: updatedContacts} : null);

      toast({
        title: 'Contact Added!',
        description: `You've successfully added ${newContact.name}.`,
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
                <AvatarImage src={CURRENT_USER_AVATAR} alt="User Avatar" data-ai-hint="female person" />
                <AvatarFallback>{CURRENT_USER_NAME.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-foreground">{CURRENT_USER_NAME}</span>
                <span className="text-xs text-muted-foreground">user@email.com</span>
              </div>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarMenu>
              {userData?.contacts.map(contact => (
                <SidebarMenuItem key={contact.id}>
                  <SidebarMenuButton 
                    tooltip={contact.name} 
                    isActive={selectedContact?.id === contact.id}
                    onClick={() => setSelectedContact(contact)}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={contact.avatar} alt={contact.name} data-ai-hint="person" />
                      <AvatarFallback>{contact.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span className="truncate">{contact.name}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
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
                    <p className="text-xs text-muted-foreground font-mono truncate">{userData?.contactCode || 'loading...'}</p>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleGenerateCode}>
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                </div>
              </Card>
            </SidebarFooter>
        </Sidebar>
        <SidebarInset className="flex flex-col">
          {selectedContact ? (
            <>
              <header className="flex h-14 items-center justify-between border-b bg-background px-4">
                <div className="flex items-center gap-2">
                  <SidebarTrigger className="md:hidden" />
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={selectedContact.avatar} alt={selectedContact.name} data-ai-hint="person"/>
                    <AvatarFallback>{selectedContact.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <span className="font-semibold">{selectedContact.name}</span>
                </div>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </header>
              <ScrollArea className="flex-1">
                <main className="p-4">
                  <div className="space-y-4">
                    {messages.map((message) => {
                      const isUser = message.senderId === CURRENT_USER_ID;
                      const contact = isUser ? null : userData?.contacts.find(c => c.id === message.senderId);
                      return (
                        <div key={message.id} className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
                          <Avatar className="h-8 w-8">
                             <AvatarImage 
                                src={isUser ? CURRENT_USER_AVATAR : contact?.avatar} 
                                alt={isUser ? CURRENT_USER_NAME : contact?.name} 
                                data-ai-hint="person"
                            />
                            <AvatarFallback>{(isUser ? CURRENT_USER_NAME : contact?.name || '?').charAt(0)}</AvatarFallback>
                          </Avatar>
                          <Card className={`rounded-2xl p-3 ${isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                            <CardContent className="p-0">
                              <p className="text-sm">{message.text}</p>
                            </CardContent>
                          </Card>
                        </div>
                      )
                    })}
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
            </>
          ) : (
             <main className="flex flex-1 items-center justify-center p-4">
                <div className="text-center">
                    <h2 className="text-2xl font-semibold">Welcome to Cryptochat</h2>
                    <p className="mt-2 text-muted-foreground">Add a contact to start chatting.</p>
                </div>
            </main>
          )}
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
