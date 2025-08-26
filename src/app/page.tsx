"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { SidebarProvider, Sidebar, SidebarInset, SidebarHeader, SidebarTrigger, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarFooter } from '@/components/ui/sidebar';
import { SheetTitle } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Paperclip, Send, RefreshCw, Users, User, LogOut, Phone, PhoneOff, Mic, MicOff, Copy, Edit, MessageSquare, Contact } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { triageNotification } from '@/ai/flows/notification-triage';
import { generateContactCode } from '@/ai/flows/user-codes';
import { generateLoginCode } from '@/ai/flows/user-login-code';
import { useToast } from '@/hooks/use-toast';
import { db, auth } from '@/lib/firebase';
import { signInAnonymously, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, Timestamp, doc, setDoc, getDoc, updateDoc, where, getDocs, DocumentData, writeBatch } from 'firebase/firestore';
import { Label } from '@/components/ui/label';
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ContactList } from '@/components/ContactList';


interface Message {
  id: string;
  senderId: string;
  senderName?: string;
  text: string;
  timestamp: Timestamp | null;
}

export interface Contact {
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
    call?: CallState;
}

export interface UserData {
    id: string;
    name: string;
    avatar: string;
    contactCode: string;
    loginCode: string;
    contacts: Contact[];
}

type CallState = {
    active: boolean;
    offer?: any;
    answer?: any;
    initiator: string;
    status: 'dialing' | 'ringing' | 'connected' | 'declined' | 'ended';
}

type ActiveView = 'chats' | 'contacts' | 'profile';


export default function ChatPage() {
  const [currentUser, setCurrentUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [activeView, setActiveView] = useState<ActiveView>('chats');


  // Add Contact states
  const [addContactCode, setAddContactCode] = useState('');
  const [isAddContactOpen, setAddContactOpen] = useState(false);
  
  // Create Group states
  const [isCreateGroupOpen, setCreateGroupOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupMembers, setGroupMembers] = useState<string[]>([]);
  
  // Account Switching
  const [isSwitchAccountOpen, setSwitchAccountOpen] = useState(false);
  const [loginCodeInput, setLoginCodeInput] = useState('');

  // Code Regeneration
  const [isRegenerateConfirmOpen, setRegenerateConfirmOpen] = useState(false);
  const [regenerationTimer, setRegenerationTimer] = useState(0);
  const regenerationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Profile Editing
  const [isEditProfileOpen, setEditProfileOpen] = useState(false);
  const [editProfileName, setEditProfileName] = useState('');
  const [editProfileAvatar, setEditProfileAvatar] = useState('');

  const { toast } = useToast();

  // WebRTC states
  const [isCallModalOpen, setCallModalOpen] = useState(false);
  const [isMuted, setMuted] = useState(false);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const servers = {
    iceServers: [
        { urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] },
    ],
  };
  
  const generateUniqueCode = async (type: 'contact' | 'login') => {
    let isUnique = false;
    let newCode = '';
    let attempts = 0;
    const maxAttempts = 10;
    while (!isUnique && attempts < maxAttempts) {
      attempts++;
      const { code } = type === 'contact' ? await generateContactCode() : await generateLoginCode();
      const field = type === 'contact' ? "contactCode" : "loginCode";
      const q = query(collection(db, "users"), where(field, "==", code));
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) {
        isUnique = true;
        newCode = code;
      }
    }
    if (!isUnique) {
      throw new Error(`Failed to generate a unique ${type} code after several attempts.`);
    }
    return newCode;
  }
  
  const initializeUser = useCallback(async (firebaseUser: FirebaseUser) => {
    const userId = localStorage.getItem('currentUserId') || firebaseUser.uid;
    if(userId !== firebaseUser.uid) {
        localStorage.setItem('currentUserId', firebaseUser.uid);
    }

    const userDocRef = doc(db, 'users', userId);
    let docSnap = await getDoc(userDocRef);

    let user: UserData;

    if (docSnap.exists()) {
        user = { id: docSnap.id, ...docSnap.data() } as UserData;
    } else {
        try {
            const [newContactCode, newLoginCode] = await Promise.all([
                generateUniqueCode('contact'),
                generateUniqueCode('login')
            ]);
            
            const newUser: UserData = {
                id: userId,
                name: `Guest-${userId.substring(0, 5)}`,
                avatar: `https://picsum.photos/seed/${userId}/100/100`,
                contactCode: newContactCode,
                loginCode: newLoginCode,
                contacts: [],
            };
            
            await setDoc(userDocRef, newUser);
            user = newUser;
        } catch(error) {
            console.error("Failed to create new user:", error);
            toast({ variant: 'destructive', title: 'Initialization Failed', description: 'Could not create a new user profile.'});
            setLoading(false);
            return null;
        }
    }

    setCurrentUser(user);
    setEditProfileName(user.name);
    setEditProfileAvatar(user.avatar);
    setLoading(false);
    return user;
  }, [toast]);


  useEffect(() => {
    const authUnsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      let user = firebaseUser;
      if (!user) {
        try {
          const userCredential = await signInAnonymously(auth);
          user = userCredential.user;
        } catch (error) {
           console.error("Anonymous sign-in failed", error);
           toast({ variant: 'destructive', title: 'Authentication Failed', description: 'Could not start a secure session.' });
           setLoading(false);
           return;
        }
      }
      await initializeUser(user);
    });

    return () => authUnsubscribe();
  }, [initializeUser, toast]);

  const loadConversations = useCallback(async (user: UserData) => {
    const conversationsQuery = query(collection(db, 'conversations'), where('members', 'array-contains', user.id));
    
    const unsubscribe = onSnapshot(conversationsQuery, async (snapshot) => {
        const convPromises = snapshot.docs.map(async (docSnap) => {
            const convData = docSnap.data();
            const conversationId = docSnap.id;

            if (convData.type === 'group') {
                return {
                    id: conversationId,
                    type: 'group',
                    name: convData.name,
                    avatar: convData.avatar || `https://picsum.photos/seed/${conversationId}/100/100`,
                    members: convData.members,
                    call: convData.call
                };
            } else { // 'private'
                const otherUserId = convData.members.find((id: string) => id !== user.id);
                if (otherUserId) {
                    const contact = user.contacts.find(c => c.id === otherUserId);
                    return {
                        id: conversationId,
                        type: 'private',
                        name: contact?.name || 'Unknown User',
                        avatar: contact?.avatar || `https://picsum.photos/seed/${otherUserId}/100/100`,
                        members: convData.members,
                        call: convData.call,
                    };
                }
            }
            return null;
        });

        const loadedConversations = (await Promise.all(convPromises))
            .filter((c): c is Conversation => c !== null)
            .sort((a, b) => a.name.localeCompare(b.name));
            
        setConversations(loadedConversations);

        if (loadedConversations.length > 0) {
            const lastConversationId = localStorage.getItem('selectedConversationId');
            const currentSelected = loadedConversations.find(c => c.id === selectedConversation?.id);
            const lastSelected = loadedConversations.find(c => c.id === lastConversationId);
            
            if (!currentSelected && activeView === 'chats') {
              setSelectedConversation(lastSelected || loadedConversations[0]);
            }
        } else {
            setSelectedConversation(null);
        }
    }, (error) => {
        console.error("Error loading conversations:", error);
        toast({
            variant: 'destructive',
            title: 'Loading Error',
            description: 'Could not load your conversations.'
        });
    });

    return unsubscribe;
  }, [toast, selectedConversation, activeView]);

  useEffect(() => {
    let unsubscribe: Function | null = null;
    if (currentUser) {
        loadConversations(currentUser).then(unsub => {
          unsubscribe = unsub;
        });
    }
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [currentUser, loadConversations]);


  useEffect(() => {
    if (!selectedConversation || activeView !== 'chats') {
        setMessages([]);
        return;
    };
    localStorage.setItem('selectedConversationId', selectedConversation.id);

    const messagesColRef = collection(db, 'conversations', selectedConversation.id, 'messages');
    const q = query(messagesColRef, orderBy('timestamp'));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const msgs: Message[] = [];
      querySnapshot.forEach((doc) => {
        msgs.push({ id: doc.id, ...doc.data() } as Message);
      });
      setMessages(msgs);
    }, (error) => {
        console.error(`Error fetching messages for ${selectedConversation.id}:`, error);
        toast({variant: 'destructive', title: 'Message Error', description: `Could not load messages for ${selectedConversation.name}.`})
    });

    return () => unsubscribe();
  }, [selectedConversation, toast, activeView]);
  
  const handleHangUp = useCallback(async (isSilent = false) => {
      if(peerConnection.current) {
        peerConnection.current.getSenders().forEach(sender => sender.track?.stop());
        peerConnection.current.close();
        peerConnection.current = null;
      }
      if(localStream.current){
        localStream.current.getTracks().forEach(track => track.stop());
        localStream.current = null;
      }
      if(remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = null;
      }
      
      setCallModalOpen(false);
      setMuted(false);

      if (selectedConversation && !isSilent) {
          const callDocRef = doc(db, 'conversations', selectedConversation.id);
          const callSnap = await getDoc(callDocRef);
          if (callSnap.exists() && callSnap.data().call?.active) {
             const batch = writeBatch(db);
             batch.update(callDocRef, { call: { active: false, status: 'ended', initiator: '' } });
             
             await batch.commit();
          }
      }
  }, [selectedConversation]);
  
  useEffect(() => {
    if (!selectedConversation || !currentUser) return;
  
    const convDocRef = doc(db, "conversations", selectedConversation.id);
  
    const unsubscribe = onSnapshot(convDocRef, (snapshot) => {
      const convData = snapshot.data();
      if (!convData) return;
  
      const callState = convData.call as CallState | undefined;

      setConversations(prevConvs => prevConvs.map(c => 
        c.id === snapshot.id ? {...c, call: callState} : c
      ));

      setSelectedConversation(prev => {
        if (!prev || prev.id !== snapshot.id) return prev;
        const needsUpdate = JSON.stringify(prev.call) !== JSON.stringify(callState);
        return needsUpdate ? { ...prev, call: callState } : prev;
      });

      const isPartOfCall = callState?.active && convData.members?.includes(currentUser.id);

      if (isPartOfCall) {
        const isRingingForMe = callState.status === 'ringing' && callState.initiator !== currentUser.id;
        
        if (isRingingForMe) {
          if (!isCallModalOpen) setCallModalOpen(true);
        } else if (callState.status === 'connected') {
           if (!isCallModalOpen) setCallModalOpen(true);
        } else if(callState.status === 'dialing' || (callState.status === 'ringing' && callState.initiator === currentUser.id)) {
           if (!isCallModalOpen) setCallModalOpen(true);
        } else {
          if (isCallModalOpen) handleHangUp(true); 
        }
      } else {
         if (isCallModalOpen) handleHangUp(true);
      }
    });
  
    return () => unsubscribe();
  
  }, [selectedConversation, currentUser, isCallModalOpen, handleHangUp]);

  // Regeneration Timer effect
  useEffect(() => {
    if (regenerationTimer > 0) {
      regenerationIntervalRef.current = setInterval(() => {
        setRegenerationTimer(prev => prev - 1);
      }, 1000);
    } else if (regenerationTimer === 0 && regenerationIntervalRef.current) {
      clearInterval(regenerationIntervalRef.current);
      regenerationIntervalRef.current = null;
      performCodeRegeneration();
    }
    return () => {
      if (regenerationIntervalRef.current) {
        clearInterval(regenerationIntervalRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regenerationTimer]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim() === '' || !selectedConversation || !currentUser) return;

    const messageContent = newMessage;
    setNewMessage('');

    try {
      const messagesColRef = collection(db, 'conversations', selectedConversation.id, 'messages');
      await addDoc(messagesColRef, {
        senderId: currentUser.id,
        senderName: currentUser.name,
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
    }
  };

  const handleGenerateContactCode = async () => {
    if (!currentUser) return;
    try {
      const newCode = await generateUniqueCode('contact');
      const userDocRef = doc(db, 'users', currentUser.id);
      await updateDoc(userDocRef, { contactCode: newCode });
      setCurrentUser(prev => prev ? {...prev, contactCode: newCode} : null);
      toast({
        title: 'New Contact Code Generated',
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
  
  const performCodeRegeneration = async () => {
      if (!currentUser) return;
       try {
        const newCode = await generateUniqueCode('login');
        const userDocRef = doc(db, 'users', currentUser.id);
        await updateDoc(userDocRef, { loginCode: newCode });
        setCurrentUser(prev => prev ? {...prev, loginCode: newCode} : null);
        toast({
          title: 'Private Code Regenerated',
          description: `Your new private login code is: ${newCode}`,
        });
      } catch (error) {
        console.error("Error regenerating login code:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Could not regenerate your private code.",
        });
      } finally {
        setRegenerateConfirmOpen(false);
      }
  }

  const handleStartRegeneration = () => {
    setRegenerateConfirmOpen(false);
    setRegenerationTimer(120); // 2 minutes
    toast({
        title: 'Regeneration Started',
        description: 'A new private code will be generated in 2 minutes. You can cancel this process.',
    });
  };

  const handleCancelRegeneration = () => {
    if (regenerationIntervalRef.current) {
        clearInterval(regenerationIntervalRef.current);
        regenerationIntervalRef.current = null;
    }
    setRegenerationTimer(0);
    toast({
        title: 'Regeneration Canceled',
        description: 'Your private code has not been changed.',
    });
  }
  
  const handleEditProfile = async () => {
      if (!editProfileName.trim() || !currentUser) {
          toast({ variant: 'destructive', title: 'Invalid Name', description: 'Profile name cannot be empty.' });
          return;
      }

      try {
          const userDocRef = doc(db, 'users', currentUser.id);
          const newAvatar = editProfileAvatar.trim() || `https://picsum.photos/seed/${currentUser.id}/100/100`;
          await updateDoc(userDocRef, { 
              name: editProfileName,
              avatar: newAvatar,
          });
          const updatedUser = { ...currentUser, name: editProfileName, avatar: newAvatar };
          setCurrentUser(updatedUser);
          
          toast({ title: 'Profile Updated', description: 'Your profile has been successfully updated.' });
          setEditProfileOpen(false);
      } catch (error) {
          console.error('Error updating profile:', error);
          toast({ variant: 'destructive', title: 'Update Failed', description: 'Could not update your profile.' });
      }
  }


  const handleAddContact = async () => {
    if (!addContactCode.trim() || !currentUser) return;
    
    try {
      const q = query(collection(db, "users"), where("contactCode", "==", addContactCode));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        toast({ variant: 'destructive', title: 'Invalid Code', description: 'No user found with that contact code.' });
        return;
      }
      
      const newContactDoc = querySnapshot.docs[0];
      const newContactId = newContactDoc.id;
      
      if(newContactId === currentUser.id) {
        toast({ variant: 'destructive', title: 'Cannot Add Yourself', description: 'You cannot add yourself as a contact.' });
        return;
      }
      
      const existingContact = (currentUser.contacts || []).find(c => c.id === newContactId)
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

      const userDocRef = doc(db, 'users', currentUser.id);
      const updatedContacts = [...(currentUser.contacts || []), newContact];
      
      const newContactUserDocRef = doc(db, 'users', newContactId);
      const updatedNewContactContacts = [...(newContactData.contacts || []), { id: currentUser.id, name: currentUser.name, avatar: currentUser.avatar }];

      const conversationId = [currentUser.id, newContactId].sort().join('_');
      const convDocRef = doc(db, 'conversations', conversationId);
      
      const batch = writeBatch(db);
      batch.update(userDocRef, { contacts: updatedContacts });
      batch.update(newContactUserDocRef, { contacts: updatedNewContactContacts });
      batch.set(convDocRef, {
          type: 'private',
          members: [currentUser.id, newContactId],
          createdAt: serverTimestamp(),
          call: { active: false, status: 'ended', initiator: '' }
      }, { merge: true });
      
      await batch.commit();

      setCurrentUser(prev => prev ? {...prev, contacts: updatedContacts} : null);
      toast({ title: 'Contact Added!', description: `You've successfully added ${newContact.name}.` });
      setAddContactCode('');
      setAddContactOpen(false);

    } catch (error) {
       console.error("Error adding contact:", error)
      toast({ variant: "destructive", title: "Error", description: "Could not add contact." })
    }
  };

  const handleCreateGroup = async () => {
     if (!groupName.trim() || groupMembers.length === 0 || !currentUser) {
        toast({ variant: 'destructive', title: 'Invalid Group', description: 'Group name and at least one member are required.' });
        return;
     }

     try {
        const allMembers = [currentUser.id, ...groupMembers];
        const newGroup = {
            name: groupName,
            type: 'group',
            members: allMembers,
            createdBy: currentUser.id,
            createdAt: serverTimestamp(),
            avatar: `https://picsum.photos/seed/${groupName.replace(/\s+/g, '-')}/100/100`
        };

        await addDoc(collection(db, 'conversations'), newGroup);
        
        toast({ title: 'Group Created!', description: `Group "${groupName}" was successfully created.` });
        setGroupName('');
        setGroupMembers([]);
        setCreateGroupOpen(false);

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
    if (!currentUser) return { name: '?', avatar: '' };
    if (senderId === currentUser.id) {
      return { name: currentUser.name, avatar: currentUser.avatar };
    }
    
    // This is not fully robust for group chats with non-contacts.
    // A better approach would be to fetch user profiles by ID when needed.
    const contact = currentUser.contacts.find(c => c.id === senderId);
     if (contact) {
        return { name: contact.name, avatar: contact.avatar };
    }
    
    return { 
      name: `User ${senderId.substring(0,4)}`, 
      avatar: `https://picsum.photos/seed/${senderId}/100/100` 
    };
  }

  const handleSwitchAccount = async () => {
    if (!loginCodeInput.trim()) return;

    try {
      const q = query(collection(db, 'users'), where('loginCode', '==', loginCodeInput));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        toast({ variant: 'destructive', title: 'Invalid Code', description: 'No account found with that private code.' });
        return;
      }
      
      const userDoc = querySnapshot.docs[0];
      const newUserId = userDoc.id;

      if(peerConnection.current) await handleHangUp(false);
      
      localStorage.setItem('currentUserId', newUserId);
      
      setLoginCodeInput('');
      setSwitchAccountOpen(false);
      
      setCurrentUser(null);
      setSelectedConversation(null);
      setMessages([]);
      setConversations([]);

      toast({ title: 'Account Switched', description: 'Successfully logged in. Reloading...' });
      
      window.location.reload();
      
    } catch(error) {
      console.error("Error switching account:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not switch accounts.' });
    }
  }

  const handleCopyCode = (code: string | undefined, type: string) => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    toast({
        title: `${type} Copied!`,
        description: `Your ${type.toLowerCase()} has been copied to the clipboard.`,
    });
  }


  // WebRTC Call Handling
  const initializePeerConnection = useCallback(async () => {
    if (!selectedConversation || !currentUser) return null;
    
    const pc = new RTCPeerConnection(servers);
    
    try {
      localStream.current = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStream.current.getTracks().forEach(track => {
          pc.addTrack(track, localStream.current!);
      });
    } catch (error) {
        console.error("Error getting user media", error);
        toast({ variant: 'destructive', title: "Microphone Error", description: "Could not access your microphone."})
        return null;
    }


    const newRemoteStream = new MediaStream();
    if(remoteAudioRef.current){
        remoteAudioRef.current.srcObject = newRemoteStream;
    }
    
    pc.ontrack = (event) => {
        event.streams[0].getTracks().forEach(track => {
            newRemoteStream.addTrack(track);
        });
    };

    const callDocRef = doc(db, 'conversations', selectedConversation.id);
    const iceCandidatesColRef = collection(callDocRef, 'iceCandidates');
    const otherUserId = selectedConversation.members!.find(id => id !== currentUser.id)!;
    const myIceCandidatesCol = collection(iceCandidatesColRef, currentUser.id);
    const otherIceCandidatesCol = collection(iceCandidatesColRef, otherUserId);

    pc.onicecandidate = (event) => {
        if (event.candidate) {
            addDoc(myIceCandidatesCol, event.candidate.toJSON());
        }
    };

    onSnapshot(otherIceCandidatesCol, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
                const candidate = new RTCIceCandidate(change.doc.data());
                pc.addIceCandidate(candidate).catch(e => console.error("Error adding ICE candidate", e));
            }
        });
    });
    
    peerConnection.current = pc;
    return pc;
  }, [currentUser, selectedConversation, toast]);
  
  const handleInitiateCall = async () => {
    if (!selectedConversation || !currentUser || selectedConversation.type !== 'private') return;
    
    const pc = await initializePeerConnection();
    if (!pc) return;

    const callDocRef = doc(db, 'conversations', selectedConversation.id);
    const offerDescription = await pc.createOffer();
    await pc.setLocalDescription(offerDescription);
    
    const offer = { sdp: offerDescription.sdp, type: offerDescription.type };
    await updateDoc(callDocRef, { call: { active: true, initiator: currentUser.id, offer, status: 'ringing' } });
    
    onSnapshot(callDocRef, (snapshot) => {
        const data = snapshot.data();
        if (data?.call?.answer && pc.signalingState === "have-local-offer") {
            const answerDescription = new RTCSessionDescription(data.call.answer);
            pc.setRemoteDescription(answerDescription)
              .then(() => {
                updateDoc(callDocRef, { 'call.status': 'connected' });
              })
              .catch(e => console.error("Error setting remote description", e));
        }
    });
  };

  const handleAnswerCall = async () => {
    if (!selectedConversation || !currentUser) return;

    const pc = await initializePeerConnection();
    if (!pc) return;
    
    const callDocRef = doc(db, 'conversations', selectedConversation.id);
    const callSnap = await getDoc(callDocRef);
    const callData = callSnap.data()?.call;
    
    if(callData?.offer) {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(callData.offer));
        const answerDescription = await pc.createAnswer();
        await pc.setLocalDescription(answerDescription);

        const answer = { type: answerDescription.type, sdp: answerDescription.sdp };
        await updateDoc(callDocRef, { 'call.answer': answer, 'call.status': 'connected' });
      } catch (error) {
        console.error("Error answering call: ", error);
        toast({variant: 'destructive', title: 'Call Error', description: 'Failed to connect the call.'})
      }
    }
  };

  const handleDeclineCall = useCallback(async () => {
     if (!selectedConversation || !currentUser) return;
     const callDocRef = doc(db, 'conversations', selectedConversation.id);
     await updateDoc(callDocRef, { 'call.status': 'declined', 'call.active': false });
     handleHangUp(true); // silent hangup
  }, [selectedConversation, currentUser, handleHangUp]);

  const handleToggleMute = () => {
    if (localStream.current) {
        localStream.current.getAudioTracks().forEach(track => {
            track.enabled = !track.enabled;
        });
        setMuted(!isMuted);
    }
  };

  const handleConversationSelect = (conv: Conversation) => {
    setSelectedConversation(conv);
    setActiveView('chats');
  }

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-muted-foreground">Initializing Secure Session...</p>
        </div>
      </div>
    );
  }

  const renderCallModal = () => {
    if (!selectedConversation) return null;
    const callState = selectedConversation.call;
    if (!isCallModalOpen || !callState?.active) return null;

    const isInitiator = callState.initiator === currentUser?.id;
    const callStatus = callState.status;

    let title = "Voice Call";
    let content = <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />;
    let actions = (
       <Button variant="destructive" onClick={() => handleHangUp(false)}>
          <PhoneOff className="mr-2 h-4 w-4" />
          Hang Up
        </Button>
    );

    if (callStatus === 'ringing' && !isInitiator) {
        title = `Incoming Call from ${selectedConversation.name}`;
        content = <AlertDialogDescription>Do you want to accept the call?</AlertDialogDescription>;
        actions = (
            <>
                <Button onClick={handleAnswerCall} className="bg-green-600 hover:bg-green-700">
                    <Phone className="mr-2 h-4 w-4" />
                    Accept
                </Button>
                <Button variant="destructive" onClick={handleDeclineCall}>
                    <PhoneOff className="mr-2 h-4 w-4" />
                    Decline
                </Button>
            </>
        )
    } else if (callStatus === 'ringing' && isInitiator) {
        title = `Calling ${selectedConversation.name}...`;
        content = <AlertDialogDescription>Waiting for them to answer.</AlertDialogDescription>
    } else if (callStatus === 'connected') {
        title = `On call with ${selectedConversation.name}`;
        content = (
            <div className="flex items-center justify-center gap-4">
                <AlertDialogDescription>Call is active.</AlertDialogDescription>
                <Button variant="outline" size="icon" onClick={handleToggleMute}>
                   {isMuted ? <MicOff className="h-4 w-4"/> : <Mic className="h-4 w-4"/>}
                </Button>
            </div>
        )
    }


    return (
         <AlertDialog open={isCallModalOpen} onOpenChange={(isOpen) => { if (!isOpen) handleDeclineCall(); else setCallModalOpen(true);}}>
            <AlertDialogContent onEscapeKeyDown={(e) => { e.preventDefault(); handleDeclineCall(); }}>
                <AlertDialogHeader>
                    <AlertDialogTitle className="text-center">{title}</AlertDialogTitle>
                </AlertDialogHeader>
                <div className="text-center my-4">
                    {content}
                </div>
                <AlertDialogFooter className="sm:justify-center">
                    {actions}
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
  }

  const renderRegenDialog = () => (
    <AlertDialog open={isRegenerateConfirmOpen} onOpenChange={setRegenerateConfirmOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This will permanently create a new private login code. Your old code will no longer work. This action will start a 2-minute timer before completing.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleStartRegeneration}>Continue</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
  );

  const renderProfileView = () => (
      <>
        <header className="flex h-14 items-center border-b bg-background px-4">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="md:hidden" />
            <h2 className="text-lg font-semibold">Profile & Settings</h2>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6 space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Your Profile</CardTitle>
                    <CardDescription>This is how other users will see you.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center gap-4">
                        <Avatar className="h-16 w-16">
                            <AvatarImage src={currentUser?.avatar} alt={currentUser?.name} data-ai-hint="person" />
                            <AvatarFallback>{currentUser?.name?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                            <p className="text-xl font-semibold">{currentUser?.name}</p>
                            <p className="text-sm text-muted-foreground font-mono">{currentUser?.id}</p>
                        </div>
                    </div>
                     <Dialog open={isEditProfileOpen} onOpenChange={setEditProfileOpen}>
                        <DialogTrigger asChild>
                           <Button><Edit className="mr-2 h-4 w-4" /> Edit Profile</Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Edit Your Profile</DialogTitle>
                                <DialogDescription>
                                    Change your display name and avatar URL. Click save when you're done.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="profile-name" className="text-right">Name</Label>
                                    <Input
                                        id="profile-name"
                                        value={editProfileName}
                                        onChange={(e) => setEditProfileName(e.target.value)}
                                        className="col-span-3"
                                    />
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="profile-avatar" className="text-right">Avatar URL</Label>
                                    <Input
                                        id="profile-avatar"
                                        value={editProfileAvatar}
                                        onChange={(e) => setEditProfileAvatar(e.target.value)}
                                        className="col-span-3"
                                        placeholder="https://example.com/image.png"
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button onClick={handleEditProfile}>Save Changes</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Your Codes</CardTitle>
                    <CardDescription>Use these codes to log in and let others add you as a contact.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-1">
                        <Label className="text-sm">Your Private Login Code (Keep it secret!)</Label>
                        <div className="flex items-center justify-between p-2 rounded-md bg-muted">
                            <p className="text-sm text-foreground font-mono truncate">{currentUser?.loginCode}</p>
                            <div className="flex items-center">
                                {regenerationTimer > 0 ? (
                                   <Button variant="destructive" size="sm" onClick={handleCancelRegeneration}>
                                     Cancel ({Math.floor(regenerationTimer/60)}:{(regenerationTimer%60).toString().padStart(2, '0')})
                                   </Button>
                                ) : (
                                    <>
                                     <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleCopyCode(currentUser?.loginCode, 'Private Login Code')}>
                                        <Copy className="h-4 w-4" />
                                     </Button>
                                     <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setRegenerateConfirmOpen(true)}>
                                        <RefreshCw className="h-4 w-4" />
                                     </Button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-sm">Your Public Contact Code</Label>
                        <div className="flex items-center justify-between p-2 rounded-md bg-muted">
                            <p className="text-sm text-muted-foreground font-mono truncate">{currentUser?.contactCode || 'loading...'}</p>
                             <div className="flex items-center">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleCopyCode(currentUser?.contactCode, 'Public Contact Code')}>
                                    <Copy className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleGenerateContactCode}>
                                    <RefreshCw className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
             <Card>
                <CardHeader>
                    <CardTitle>Switch Account</CardTitle>
                     <CardDescription>Enter a private login code to switch to another account.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-2">
                        <Input 
                            id="login-code"
                            value={loginCodeInput}
                            onChange={(e) => setLoginCodeInput(e.target.value)}
                            placeholder="e.g. a1b2c3d4"
                        />
                        <Button onClick={handleSwitchAccount}>Switch</Button>
                    </div>
                </CardContent>
            </Card>
        </main>
      </>
  );

  return (
    <SidebarProvider>
      <div className="flex min-h-screen bg-background">
        <Sidebar>
          <SheetTitle className="sr-only">Main Navigation</SheetTitle>
            <div className="flex h-full flex-col">
                <SidebarHeader>
                    <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                        <AvatarImage src={currentUser?.avatar} alt={currentUser?.name} data-ai-hint="female person" />
                        <AvatarFallback>{currentUser?.name?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col overflow-hidden">
                        <span className="text-sm font-semibold text-foreground truncate">{currentUser?.name}</span>
                        </div>
                    </div>
                </SidebarHeader>
                <SidebarContent>
                    <SidebarMenu>
                        <SidebarMenuItem>
                            <SidebarMenuButton 
                                tooltip="Chats" 
                                isActive={activeView === 'chats'}
                                onClick={() => setActiveView('chats')}
                            >
                                <MessageSquare />
                                <span>Chats</span>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                        <SidebarMenuItem>
                            <SidebarMenuButton 
                                tooltip="Contacts" 
                                isActive={activeView === 'contacts'}
                                onClick={() => setActiveView('contacts')}
                            >
                                <Contact />
                                <span>Contacts</span>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                        <SidebarMenuItem>
                            <SidebarMenuButton 
                                tooltip="Profile" 
                                isActive={activeView === 'profile'}
                                onClick={() => setActiveView('profile')}
                            >
                                <User />
                                <span>Profile</span>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    </SidebarMenu>
                </SidebarContent>
                <SidebarFooter>
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
                            {currentUser?.contacts.map(contact => (
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
                </SidebarFooter>
            </div>
        </Sidebar>
        <SidebarInset className="flex flex-col">
          {activeView === 'chats' && (
            selectedConversation ? (
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
                    <div>
                       {selectedConversation.type === 'private' && (
                        <Button variant="ghost" size="icon" onClick={handleInitiateCall} disabled={selectedConversation.call?.active && selectedConversation.call?.status !== 'ended'}>
                            <Phone className="h-5 w-5" />
                        </Button>
                       )}
                    </div>
                  </header>
                  <ScrollArea className="flex-1">
                    <div className="p-4 space-y-4">
                        {messages.map((message) => {
                          const isUser = message.senderId === currentUser?.id;
                          const sender = getSender(message.senderId);
                          return (
                            <div key={message.id} className={`flex items-end gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
                               <Avatar className="h-8 w-8">
                                 <AvatarImage src={sender?.avatar} alt={sender?.name} data-ai-hint="person" />
                                <AvatarFallback>{sender?.name?.charAt(0)}</AvatarFallback>
                              </Avatar>
                              <div className={`flex flex-col space-y-1 ${isUser ? 'items-end' : 'items-start'}`}>
                                {selectedConversation.type ==='group' && !isUser && (
                                    <span className="text-xs text-muted-foreground px-3">{sender.name}</span>
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
                <>
                 <header className="flex h-14 items-center border-b bg-background px-4">
                    <div className="flex items-center gap-2">
                        <SidebarTrigger className="md:hidden" />
                        <h2 className="text-lg font-semibold">Chats</h2>
                    </div>
                </header>
                <ScrollArea className="flex-1">
                    {conversations.map(conv => (
                        <div key={conv.id} onClick={() => handleConversationSelect(conv)} className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted border-b">
                            <Avatar className="h-10 w-10">
                                <AvatarImage src={conv.avatar} alt={conv.name} />
                                <AvatarFallback>{conv.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                                <p className="font-semibold">{conv.name}</p>
                                <p className="text-sm text-muted-foreground truncate">
                                    {conv.type === 'group' ? `${conv.members?.length} members` : 'Private Chat'}
                                </p>
                            </div>
                        </div>
                    ))}
                </ScrollArea>
                </>
              )
            )}
            {activeView === 'contacts' && currentUser && (
                <ContactList 
                    contacts={currentUser.contacts}
                    onSelectContact={(contactId) => {
                        const convId = [currentUser.id, contactId].sort().join('_');
                        const conv = conversations.find(c => c.id === convId);
                        if(conv) {
                            handleConversationSelect(conv);
                        }
                    }}
                />
            )}
            {activeView === 'profile' && renderProfileView()}
        </SidebarInset>
      </div>
      {renderCallModal()}
      {renderRegenDialog()}
      <audio ref={remoteAudioRef} autoPlay playsInline />
    </SidebarProvider>
  );
}
