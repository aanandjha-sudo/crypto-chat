
"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Contact } from "@/app/page";
import { SidebarTrigger } from "./ui/sidebar";

interface ContactListProps {
    contacts: Contact[];
    onSelectContact: (contactId: string) => void;
}

export function ContactList({ contacts, onSelectContact }: ContactListProps) {
    return (
        <>
            <header className="flex h-14 items-center border-b bg-background px-4">
                <div className="flex items-center gap-2">
                     <SidebarTrigger className="md:hidden" />
                     <h2 className="text-lg font-semibold">Contacts</h2>
                </div>
            </header>
            <ScrollArea className="flex-1">
                {contacts.length > 0 ? (
                    contacts.map(contact => (
                        <div 
                            key={contact.id} 
                            onClick={() => onSelectContact(contact.id)}
                            className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted border-b"
                        >
                            <Avatar className="h-10 w-10">
                                <AvatarImage src={contact.avatar} alt={contact.name} />
                                <AvatarFallback>{contact.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                                <p className="font-semibold">{contact.name}</p>
                                <p className="text-sm text-muted-foreground font-mono truncate">{contact.id}</p>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="p-6 text-center text-muted-foreground">
                        <p>You haven't added any contacts yet.</p>
                        <p className="text-sm">Click "Add Contact" in the sidebar to get started.</p>
                    </div>
                )}
            </ScrollArea>
        </>
    );
}
