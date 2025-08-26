import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="font-headline text-6xl font-bold text-primary">
          Cryptochat
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Secure, real-time messaging.
        </p>
        <div className="mt-8">
          <Button asChild>
            <Link href="/chat">Start Chatting</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}