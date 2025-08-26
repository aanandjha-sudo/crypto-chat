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

const TriageNotificationInputSchema = z.object({
  messageContent: z.string().describe('The content of the message.'),
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

const prompt = ai.definePrompt({
  name: 'triageNotificationPrompt',
  input: {schema: TriageNotificationInputSchema},
  output: {schema: TriageNotificationOutputSchema},
  prompt: `You are a notification triage expert. Your job is to determine whether a given message warrants sending a push notification to the user.

Consider the content of the message and determine if it is important or urgent enough to interrupt the user. If it is a routine message, such as a simple greeting or acknowledgment, you should not send a notification.

Message Content: {{{messageContent}}}

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

