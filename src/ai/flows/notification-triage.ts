'use server';

/**
 * @fileOverview A Genkit flow that determines whether a message warrants a push notification based on its content.
 *
 * - triageNotification - A function that analyzes a message and returns whether a push notification should be sent.
 * - TriageNotificationInput - The input type for the triageNotification function.
 * - TriageNotificationOutput - The return type for the triageNotification function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { getMessaging } from "firebase-admin/messaging";
import { adminApp } from '@/lib/firebase-admin';

const TriageNotificationInputSchema = z.object({
  messageContent: z.string().describe('The content of the message.'),
  senderName: z.string().describe('The name of the person sending the message'),
  fcmToken: z.string().optional().describe('The FCM token of the recipient device.'),
});
export type TriageNotificationInput = z.infer<typeof TriageNotificationInputSchema>;

const TriageNotificationOutputSchema = z.object({
  shouldSendNotification: z
    .boolean()
    .describe(
      'Whether a push notification should be sent based on the message content.'
    ),
  reason: z.string().describe('The reason for the notification decision.'),
});
export type TriageNotificationOutput = z.infer<typeof TriageNotificationOutputSchema>;

export async function triageNotification(
  input: TriageNotificationInput
): Promise<TriageNotificationOutput> {
  return triageNotificationFlow(input);
}

const sendPushNotification = ai.defineTool(
    {
        name: 'sendPushNotification',
        description: 'Sends a push notification to a user device.',
        inputSchema: z.object({
            fcmToken: z.string().describe("The Firebase Cloud Messaging token for the recipient's device."),
            title: z.string().describe("The title of the notification."),
            body: z.string().describe("The body content of the notification."),
        }),
        outputSchema: z.void(),
    },
    async ({ fcmToken, title, body }) => {
        try {
            await getMessaging(adminApp).send({
                token: fcmToken,
                notification: {
                    title,
                    body,
                },
                webpush: {
                    fcmOptions: {
                        link: '/chat'
                    }
                }
            });
        } catch (e) {
            console.error("Failed to send push notification:", e);
            // Don't throw error to client, just log it.
        }
    }
);


const prompt = ai.definePrompt({
  name: 'triageNotificationPrompt',
  input: {schema: TriageNotificationInputSchema},
  output: {schema: TriageNotificationOutputSchema},
  tools: [sendPushNotification],
  prompt: `You are a notification triage expert. Your job is to determine whether a given message warrants sending a push notification to the user and then send it.

Consider the content of the message and determine if it is important or urgent enough to interrupt the user.
If it is a routine message, such as a simple greeting or acknowledgment, you should not send a notification.
If it is important, you MUST call the sendPushNotification tool.
The notification title should be the name of the sender.
The notification body should be the message content.

Message Content: {{{messageContent}}}
Sender Name: {{{senderName}}}
Recipient FCM Token: {{{fcmToken}}}

Based on the message content, should a push notification be sent? Explain your reasoning.

Return a JSON object with 'shouldSendNotification' (boolean) and 'reason' (string) fields.`,
});

const triageNotificationFlow = ai.defineFlow(
  {
    name: 'triageNotificationFlow',
    inputSchema: TriageNotificationInputSchema,
    outputSchema: TriageNotificationOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
