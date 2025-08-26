"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SidebarProvider, Sidebar, SidebarInset, SidebarHeader, SidebarTrigger, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarFooter } from '@/components/ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MoreVertical, Paperclip, Send, Plus, RefreshCw, Users, User, LogOut } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { triageNotification } from '@/ai/flows/notification-triage';
import { generateContactCode } from '@/ai/flows/user-codes';
import { useToast } from '@/hooks/use-toast';
import { auth, db } from '@/lib/firebase';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, Timestamp, doc, setDoc, getDoc, updateDoc, where, getDocs, DocumentData } from 'firebase/firestore';
import { Label } from '@/components/ui/label';
import { Checkbox } from "@/components/ui/checkbox"
import { onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';
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
  senderName?: string;
  text: string;
  timestamp: Timestamp | null;
}

interface Contact {
  id: string;
  name: string;
  avatar: string;
}

interface Conversation {
    id: string;
    type: 'private' | 'group';
    name: string;
    avatar: string;
    members?: string[];
}

interface UserData {
    name: string;
    avatar: string;
    contactCode: string;
    contacts: Contact[];
}


export default function ChatPage() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);

  // Add Contact states
  const [addContactCode, setAddContactCode] = useState('');
  const [isAddContactOpen, setAddContactOpen] = useState(false);
  
  // Create Group states
  const [isCreateGroupOpen, setCreateGroupOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupMembers, setGroupMembers] = useState<string[]>([]);

  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        // Fetch or create user data
        const userDocRef = doc(db, 'users', currentUser.uid);
        let docSnap = await getDoc(userDocRef);
        if (!docSnap.exists()) {
          // This case should ideally be handled on the login page, but as a fallback:
          const { code } = await generateContactCode();
          const newUser: Partial<UserData> & {name: string, avatar: string} = { 
              name: currentUser.displayName || `Guest-${currentUser.uid.substring(0,5)}`, 
              avatar: currentUser.photoURL || `https://picsum.photos/seed/${currentUser.uid}/100/100`,
              contactCode: code, 
              contacts: [], 
          };
          await setDoc(userDocRef, newUser);
          docSnap = await getDoc(userDocRef); // re-fetch to get server data
        }
        
        const data = docSnap.data() as UserData;
        setUserData(data);

      } else {
        setUser(null);
        setUserData(null);
        router.push('/');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (!user || !userData) return;

     // After getting user data, fetch their conversations
    const convQuery = query(collection(db, 'conversations'), where('members', 'array-contains', user.uid));
    const unsubscribeConversations = onSnapshot(convQuery, async (querySnapshot) => {
      const convs: Conversation[] = [];
      for (const docSnapshot of querySnapshot.docs) {
          const convData = docSnapshot.data();
          if (convData.type === 'private') {
              const otherUserId = convData.members.find((id: string) => id !== user.uid);
              if (otherUserId) {
                const otherUserDoc = await getDoc(doc(db, 'users', otherUserId));
                if (otherUserDoc.exists()) {
                    const otherUserData = otherUserDoc.data();
                    convs.push({
                        id: docSnapshot.id,
                        type: 'private',
                        name: otherUserData.name || `User ${otherUserId}`,
                        avatar: otherUserData.avatar || `https://picsum.photos/seed/${otherUserId}/100/100`
                    });
                }
              }
          } else { // group
               convs.push({
                  id: docSnapshot.id,
                  type: 'group',
                  name: convData.name,
                  avatar: convData.avatar || `https://picsum.photos/seed/${docSnapshot.id}/100/100`,
                  members: convData.members,
              });
          }
      }
      setConversations(convs);
      if (convs.length > 0 && !selectedConversation) {
          // Check if a conversation is stored in localStorage
          const lastConversationId = localStorage.getItem('selectedConversationId');
          const lastConv = convs.find(c => c.id === lastConversationId);
          setSelectedConversation(lastConv || convs[0]);
      }
    });
    return () => unsubscribeConversations();

  }, [user, userData, selectedConversation]);


  useEffect(() => {
    if (!selectedConversation) {
        setMessages([]);
        return;
    };
    // Store selected conversation in local storage
    localStorage.setItem('selectedConversationId', selectedConversation.id);

    // Listen for messages in the current conversation
    const messagesColRef = collection(db, 'conversations', selectedConversation.id, 'messages');
    const q = query(messagesColRef, orderBy('timestamp'));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const msgs: Message[] = [];
      querySnapshot.forEach((doc) => {
        msgs.push({ id: doc.id, ...doc.data() } as Message);
      });
      setMessages(msgs);
    });

    return () => unsubscribe();
  }, [selectedConversation]);


  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim() === '' || !selectedConversation || !user) return;

    const messageContent = newMessage;
    setNewMessage('');

    try {
      const messagesColRef = collection(db, 'conversations', selectedConversation.id, 'messages');
      await addDoc(messagesColRef, {
        senderId: user.uid,
        senderName: userData?.name,
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
      if (result.shouldSendNotification) {
         toast({
          title: 'Notification Sent (Simulated)',
          description: result.reason,
        });
      }
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
    if (!user) return;
    try {
      const result = await generateContactCode();
      const newCode = result.code;
      const userDocRef = doc(db, 'users', user.uid);
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
    if (!addContactCode.trim() || !user) return;
    
    try {
      const q = query(collection(db, "users"), where("contactCode", "==", addContactCode));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        toast({ variant: 'destructive', title: 'Invalid Code', description: 'No user found with that contact code.' });
        return;
      }
      
      const newContactDoc = querySnapshot.docs[0];
      const newContactId = newContactDoc.id;
      
      if(newContactId === user.uid) {
        toast({ variant: 'destructive', title: 'Cannot Add Yourself', description: 'You cannot add yourself as a contact.' });
        return;
      }
      
      const existingContact = (userData?.contacts || []).find(c => c.id === newContactId)
      if(existingContact) {
        toast({ variant: 'destructive', title: 'Contact Exists', description: 'This user is already in your contact list.' });
        return;
      }

      const newContactData = newContactDoc.data();
      const newContact: Contact = { 
          id: newContactId, 
          name: newContactData.name || `User ${newContactId}`, 
          avatar: newContactData.avatar || `https://picsum.photos/seed/${newContactId}/100/100` 
      };

      // Add to current user's contacts
      const userDocRef = doc(db, 'users', user.uid);
      const updatedContacts = [...(userData?.contacts || []), newContact];
      await updateDoc(userDocRef, { contacts: updatedContacts });
      
      // Create a new private conversation
      const conversationId = [user.uid, newContactId].sort().join('_');
      const convDocRef = doc(db, 'conversations', conversationId);
      const convDocSnap = await getDoc(convDocRef);
      if (!convDocSnap.exists()) {
        await setDoc(convDocRef, {
            type: 'private',
            members: [user.uid, newContactId],
            createdAt: serverTimestamp(),
        });
      }

      setUserData(prev => prev ? {...prev, contacts: updatedContacts} : null);
      toast({ title: 'Contact Added!', description: `You've successfully added ${newContact.name}.` });
      setAddContactCode('');
      setAddContactOpen(false);

    } catch (error) {
       console.error("Error adding contact:", error)
      toast({ variant: "destructive", title: "Error", description: "Could not add contact." })
    }
  };

  const handleCreateGroup = async () => {
     if (!groupName.trim() || groupMembers.length === 0 || !user) {
        toast({ variant: 'destructive', title: 'Invalid Group', description: 'Group name and at least one member are required.' });
        return;
     }

     try {
        const allMembers = [user.uid, ...groupMembers];
        const newGroup = {
            name: groupName,
            type: 'group',
            members: allMembers,
            createdBy: user.uid,
            createdAt: serverTimestamp(),
            avatar: `https://picsum.photos/seed/${groupName}/100/100`
        };

        const groupDocRef = await addDoc(collection(db, 'conversations'), newGroup);
        
        toast({ title: 'Group Created!', description: `Group "${groupName}" was successfully created.` });
        setGroupName('');
        setGroupMembers([]);
        setCreateGroupOpen(false);

        const newConv = {id: groupDocRef.id, ...newGroup};
        // select the new group
        setConversations(prev => [...prev, newConv]);
        setSelectedConversation(newConv);

     } catch(error) {
        console.error("Error creating group:", error);
        toast({ variant: "destructive", title: "Error", description: "Could not create group." });
     }
  }
  
  const handleGroupMemberToggle = (contactId: string) => {
    setGroupMembers(prev => 
        prev.includes(contactId) 
            ? prev.filter(id => id !== contactId)
            : [...prev, contactId]
    )
  }
  
  const getSender = (senderId: string) => {
    if (senderId === user?.uid) {
      return { name: userData?.name, avatar: userData?.avatar };
    }
    const contact = userData?.contacts.find(c => c.id === senderId);
     if (contact) {
        return { name: contact.name, avatar: contact.avatar };
    }
    // Fallback for group members who are not in contacts list (possible in future)
    return { 
      name: `User ${senderId.substring(0,4)}`, 
      avatar: `https://picsum.photos/seed/${senderId}/100/100` 
    };
  }

  const handleLogout = async () => {
    try {
      await signOut(auth);
      // The onAuthStateChanged listener will handle routing to '/'
    } catch (error) {
      console.error("Error signing out:", error);
      toast({
        variant: 'destructive',
        title: 'Logout Failed',
        description: 'There was an error signing you out.',
      });
    }
  };

  if (loading || !user || !userData) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen bg-background">
        <Sidebar>
          <SidebarHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={userData?.avatar} alt={userData?.name} data-ai-hint="female person" />
                  <AvatarFallback>{userData?.name?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-foreground">{userData?.name}</span>
                  <span className="text-xs text-muted-foreground">{user.email || 'Guest'}</span>
                </div>
              </div>
               <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarMenu>
              {conversations.map(conv => (
                <SidebarMenuItem key={conv.id}>
                  <SidebarMenuButton 
                    tooltip={conv.name} 
                    isActive={selectedConversation?.id === conv.id}
                    onClick={() => setSelectedConversation(conv)}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={conv.avatar} alt={conv.name} data-ai-hint={conv.type === 'group' ? 'group users' : 'person'} />
                      <AvatarFallback>{conv.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span className="truncate">{conv.name}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarContent>
            <SidebarFooter>
              <div className="flex gap-2">
                 <Dialog open={isAddContactOpen} onOpenChange={setAddContactOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full">
                      <User className="mr-2 h-4 w-4" />
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
                <Dialog open={isCreateGroupOpen} onOpenChange={setCreateGroupOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full">
                      <Users className="mr-2 h-4 w-4" />
                      New Group
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create a new group</DialogTitle>
                      <DialogDescription>
                        Give your group a name and add members from your contact list.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <Label htmlFor="group-name">Group Name</Label>
                      <Input
                        id="group-name"
                        value={groupName}
                        onChange={(e) => setGroupName(e.target.value)}
                        placeholder="e.g. My Awesome Team"
                      />
                      <Label>Members</Label>
                       <ScrollArea className="h-40">
                         <div className="space-y-2">
                          {userData?.contacts.map(contact => (
                              <div key={contact.id} className="flex items-center space-x-2">
                                <Checkbox 
                                  id={`member-${contact.id}`} 
                                  onCheckedChange={() => handleGroupMemberToggle(contact.id)}
                                  checked={groupMembers.includes(contact.id)}
                                />
                                <Label htmlFor={`member-${contact.id}`} className="font-normal flex items-center gap-2">
                                    <Avatar className="h-6 w-6">
                                        <AvatarImage src={contact.avatar} alt={contact.name} data-ai-hint="person" />
                                        <AvatarFallback>{contact.name.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    {contact.name}
                                </Label>
                              </div>
                          ))}
                         </div>
                       </ScrollArea>
                    </div>
                    <DialogFooter>
                      <Button onClick={handleCreateGroup}>Create Group</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              
              <Card className="p-2 mt-2">
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
          {selectedConversation ? (
            <>
              <header className="flex h-14 items-center justify-between border-b bg-background px-4">
                <div className="flex items-center gap-2">
                  <SidebarTrigger className="md:hidden" />
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={selectedConversation.avatar} alt={selectedConversation.name} data-ai-hint={selectedConversation.type === 'group' ? 'group users' : 'person'}/>
                    <AvatarFallback>{selectedConversation.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="font-semibold">{selectedConversation.name}</span>
                    {selectedConversation.type === 'group' && (
                        <span className="text-xs text-muted-foreground">{selectedConversation.members?.length} members</span>
                    )}
                  </div>
                </div>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </header>
              <ScrollArea className="flex-1">
                <main className="p-4">
                  <div className="space-y-4">
                    {messages.map((message) => {
                      const isUser = message.senderId === user.uid;
                      const sender = getSender(message.senderId);
                      return (
                        <div key={message.id} className={`flex items-end gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
                           <Avatar className="h-8 w-8">
                             <AvatarImage src={sender?.avatar} alt={sender?.name} data-ai-hint="person" />
                            <AvatarFallback>{sender?.name?.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div className={`flex flex-col space-y-1 ${isUser ? 'items-end' : 'items-start'}`}>
                            {selectedConversation.type ==='group' && !isUser && (
                                <span className="text-xs text-muted-foreground px-3">{message.senderName}</span>
                            )}
                            <Card className={`rounded-2xl p-3 max-w-sm md:max-w-md ${isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                              <CardContent className="p-0">
                                <p className="text-sm">{message.text}</p>
                              </CardContent>
                            </Card>
                          </div>
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
                    <p className="mt-2 text-muted-foreground">Select a conversation to start chatting.</p>
                </div>
            </main>
          )}
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
