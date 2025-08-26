'use server';

/**
 * @fileOverview A Genkit flow that generates a unique, user-friendly contact code.
 *
 * - generateContactCode - A function that returns a new unique contact code.
 * - GenerateContactCodeOutput - The return type for the generateContactCode function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateContactCodeOutputSchema = z.object({
  code: z.string().describe('The unique contact code.'),
});
export type GenerateContactCodeOutput = z.infer<typeof GenerateContactCodeOutputSchema>;

export async function generateContactCode(): Promise<GenerateContactCodeOutput> {
  return generateContactCodeFlow();
}

const prompt = ai.definePrompt({
  name: 'generateContactCodePrompt',
  output: { schema: GenerateContactCodeOutputSchema },
  prompt: `You are an expert in creating short, memorable, and unique user codes.
Generate a contact code that is a combination of two random, simple, lowercase English words and a 3-digit number.
For example: "blue-tree-123" or "happy-sun-789".
The words should be common and easy to spell.
Your output should be a JSON object with a "code" field.`,
});

const generateContactCodeFlow = ai.defineFlow(
  {
    name: 'generateContactCodeFlow',
    outputSchema: GenerateContactCodeOutputSchema,
  },
  async () => {
    // The flow now only generates a code. Uniqueness check is moved to the client.
    const {output} = await prompt();
    if (!output) {
      throw new Error("The AI model did not return a valid output.");
    }
    return { code: output.code.trim() };
  }
);
