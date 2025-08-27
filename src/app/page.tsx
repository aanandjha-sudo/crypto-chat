
"use client";

import { SidebarProvider } from '@/components/ui/sidebar';
import ChatPage from './chat/page';

export default function Home() {
    return (
        <SidebarProvider>
            <ChatPage />
        </SidebarProvider>
    );
}
    
