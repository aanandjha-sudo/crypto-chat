'use server';

/**
 * @fileOverview A Genkit flow that generates a unique, 8-character private login code.
 *
 * - generateLoginCode - A function that returns a new unique login code.
 * - GenerateLoginCodeOutput - The return type for the generateLoginCode function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateLoginCodeOutputSchema = z.object({
  code: z.string().describe('The unique 8-character login code.'),
});
export type GenerateLoginCodeOutput = z.infer<typeof GenerateLoginCodeOutputSchema>;

export async function generateLoginCode(): Promise<GenerateLoginCodeOutput> {
  return generateLoginCodeFlow();
}

const prompt = ai.definePrompt({
  name: 'generateLoginCodePrompt',
  output: { schema: GenerateLoginCodeOutputSchema },
  prompt: `You are an expert in creating secure and random user login codes.
Generate a unique, 8-character alphanumeric code that is difficult to guess.
It should be a mix of lowercase letters and numbers.
For example: "a1b2c3d4" or "z9y8x7w6".
Your output should be a JSON object with a "code" field.`,
});

const generateLoginCodeFlow = ai.defineFlow(
  {
    name: 'generateLoginCodeFlow',
    outputSchema: GenerateLoginCodeOutputSchema,
  },
  async () => {
    const {output} = await prompt();
    if (!output) {
      throw new Error("The AI model did not return a valid output.");
    }
    return { code: output.code.trim() };
  }
);
