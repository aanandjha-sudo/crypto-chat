"use client";

import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { GoogleAuthProvider, signInWithPopup, signInAnonymously } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { generateContactCode } from '@/ai/flows/user-codes';
import { Chrome } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Check if user document exists, if not, create one
      const userDocRef = doc(db, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);
      if (!userDocSnap.exists()) {
        const { code } = await generateContactCode();
        await setDoc(userDocRef, {
          name: user.displayName,
          email: user.email,
          avatar: user.photoURL,
          contactCode: code,
          contacts: [],
        });
      }
      router.push('/chat');
    } catch (error) {
      console.error("Error during Google login:", error);
      toast({
        variant: 'destructive',
        title: 'Login Failed',
        description: 'Could not sign in with Google. Please try again.',
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
            const { code } = await generateContactCode();
            const guestName = `Guest-${user.uid.substring(0, 5)}`;
            await setDoc(userDocRef, {
                name: guestName,
                avatar: `https://picsum.photos/seed/${user.uid}/100/100`,
                contactCode: code,
                contacts: [],
                isAnonymous: true,
            });
        }
        router.push('/chat');
    } catch (error) {
        console.error("Error during guest login:", error);
        toast({
            variant: 'destructive',
            title: 'Login Failed',
            description: 'Could not sign in as a guest. Please try again.',
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
