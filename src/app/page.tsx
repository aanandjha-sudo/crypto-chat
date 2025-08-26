"use client";

import { SidebarProvider } from '@/components/ui/sidebar';
import ChatPage from '@/app/chat/page';

export default function Home() {
    return (
        <SidebarProvider>
            <ChatPage />
        </SidebarProvider>
    );
}
