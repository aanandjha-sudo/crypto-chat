'use server';

/**
 * @fileOverview A Genkit flow that generates a unique, user-friendly contact code.
 *
 * - generateContactCode - A function that returns a new unique contact code.
 * - GenerateContactCodeOutput - The return type for the generateContactCode function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const GenerateContactCodeOutputSchema = z.object({
  code: z.string().describe('The unique contact code.'),
});
export type GenerateContactCodeOutput = z.infer<typeof GenerateContactCodeOutputSchema>;

export async function generateContactCode(): Promise<GenerateContactCodeOutput> {
  return generateContactCodeFlow();
}

const prompt = ai.definePrompt({
  name: 'generateContactCodePrompt',
  prompt: `You are an expert in creating short, memorable, and unique user codes.
Generate a contact code that is a combination of two random, simple, lowercase English words and a 3-digit number.
For example: "blue-tree-123" or "happy-sun-789".
Do not include any other text or explanation.`,
});

const generateContactCodeFlow = ai.defineFlow(
  {
    name: 'generateContactCodeFlow',
    outputSchema: GenerateContactCodeOutputSchema,
  },
  async () => {
    let isUnique = false;
    let code = '';
    
    while (!isUnique) {
        const {output} = await prompt();
        const generatedCode = output!.code;

        // Check if the code already exists in Firestore
        const q = query(collection(db, 'users'), where('contactCode', '==', generatedCode));
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            isUnique = true;
            code = generatedCode;
        }
    }

    return { code };
  }
);
