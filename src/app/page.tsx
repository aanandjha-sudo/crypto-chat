"use client";

import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { GoogleAuthProvider, signInWithPopup, signInAnonymously } from 'firebase/auth';
import type { FirebaseError } from 'firebase/app';
import { auth, db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { doc, setDoc, getDoc, query, where, getDocs, collection } from 'firebase/firestore';
import { generateContactCode } from '@/ai/flows/user-codes';
import { Chrome } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();

  const generateUniqueCode = async () => {
    let isUnique = false;
    let newCode = '';
    let attempts = 0;
    const maxAttempts = 10;
    while (!isUnique && attempts < maxAttempts) {
      attempts++;
      const { code } = await generateContactCode();
      const q = query(collection(db, "users"), where("contactCode", "==", code));
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) {
        isUnique = true;
        newCode = code;
      }
    }
    if (!isUnique) {
      throw new Error("Failed to generate a unique contact code after several attempts.");
    }
    return newCode;
  }

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Check if user document exists, if not, create one
      const userDocRef = doc(db, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);
      if (!userDocSnap.exists()) {
        const newCode = await generateUniqueCode();
        await setDoc(userDocRef, {
          name: user.displayName,
          email: user.email,
          avatar: user.photoURL,
          contactCode: newCode,
          contacts: [],
        });
      }
      router.push('/chat');
    } catch (error) {
      console.error("Error during Google login:", error);
      let description = 'Could not sign in with Google. Please try again.';
      const firebaseError = error as FirebaseError;
      if (firebaseError.code) {
        description = firebaseError.message;
      }
      toast({
        variant: 'destructive',
        title: 'Login Failed',
        description: description,
      });
    }
  };

  const handleGuestLogin = async () => {
    try {
        const result = await signInAnonymously(auth);
        const user = result.user;

        // Check if user document exists, if not, create one
        const userDocRef = doc(db, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (!userDocSnap.exists()) {
            const newCode = await generateUniqueCode();
            const guestName = `Guest-${user.uid.substring(0, 5)}`;
            await setDoc(userDocRef, {
                name: guestName,
                avatar: `https://picsum.photos/seed/${user.uid}/100/100`,
                contactCode: newCode,
                contacts: [],
                isAnonymous: true,
            });
        }
        router.push('/chat');
    } catch (error) {
        console.error("Error during guest login:", error);
        let description = 'Could not sign in as a guest. Please try again.';
        const firebaseError = error as FirebaseError;
        if (firebaseError.code) {
            description = firebaseError.message;
        }
        toast({
            variant: 'destructive',
            title: 'Login Failed',
            description: description,
        });
    }
  };


  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <div className="text-center max-w-sm w-full mx-auto p-4">
        <h1 className="font-headline text-6xl font-bold text-primary">
          Cryptochat
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Secure, real-time messaging.
        </p>
        <div className="mt-8 space-y-4">
          <Button onClick={handleGoogleLogin} className="w-full">
            <Chrome className="mr-2 h-5 w-5" />
            Sign in with Google
          </Button>
          <Button variant="secondary" onClick={handleGuestLogin} className="w-full">
            Continue as Guest
          </Button>
        </div>
      </div>
    </div>
  );
}
