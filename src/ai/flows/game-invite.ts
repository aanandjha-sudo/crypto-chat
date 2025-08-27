'use server';

/**
 * @fileOverview A Genkit flow that sends a game invitation to a conversation.
 * 
 * - sendGameInvite - A function that adds a special invitation message to a conversation.
 * - SendGameInviteInput - The input type for the sendGameInvite function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { adminApp } from '@/lib/firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

const SendGameInviteInputSchema = z.object({
    conversationId: z.string().describe('The ID of the conversation to send the invite to.'),
    inviterId: z.string().describe('The ID of the user sending the invitation.'),
    inviterName: z.string().describe('The name of the user sending the invitation.'),
    gameId: z.string().describe('The ID of the game being invited to (e.g., "tictactoe").'),
    gameName: z.string().describe('The display name of the game (e.g., "Tic-Tac-Toe").'),
});
export type SendGameInviteInput = z.infer<typeof SendGameInviteInputSchema>;


export async function sendGameInvite(input: SendGameInviteInput) {
    return sendGameInviteFlow(input);
}


const sendGameInviteFlow = ai.defineFlow(
    {
        name: 'sendGameInviteFlow',
        inputSchema: SendGameInviteInputSchema,
        outputSchema: z.void(),
    },
    async ({ conversationId, inviterId, inviterName, gameId, gameName }) => {
        const db = getFirestore(adminApp);
        const messagesColRef = db.collection('conversations').doc(conversationId).collection('messages');
        
        await messagesColRef.add({
            senderId: inviterId,
            senderName: inviterName,
            type: 'game_invite',
            timestamp: new Date(),
            game: {
                id: gameId,
                name: gameName,
                status: 'pending', // pending, accepted, declined
            }
        });
    }
);
