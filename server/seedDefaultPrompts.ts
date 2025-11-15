/**
 * Seed script pentru prompturi default
 * Rulează automat la pornirea server-ului pentru a asigura că fiecare user are cele 3 prompturi default
 */

import { drizzle } from "drizzle-orm/mysql2";
import { userPrompts } from "../drizzle/schema";
import { HARDCODED_PROMPTS } from "./hardcodedPrompts";
import { eq, and } from "drizzle-orm";

export async function seedDefaultPromptsForUser(userId: number) {
  if (!process.env.DATABASE_URL) {
    console.warn("[Seed] No DATABASE_URL, skipping default prompts seed");
    return;
  }

  const db = drizzle(process.env.DATABASE_URL);

  try {
    // Check dacă user-ul are deja prompturile default
    const existingPrompts = await db
      .select()
      .from(userPrompts)
      .where(and(eq(userPrompts.userId, userId), eq(userPrompts.isDefault, 1)));

    // Dacă are deja toate 3 prompturile default, skip
    if (existingPrompts.length >= 3) {
      return;
    }

    // Seed cele 3 prompturi default
    const defaultPrompts = [
      {
        userId,
        promptName: "PROMPT_NEUTRAL",
        promptTemplate: HARDCODED_PROMPTS.PROMPT_NEUTRAL.content,
        isDefault: 1,
      },
      {
        userId,
        promptName: "PROMPT_SMILING",
        promptTemplate: HARDCODED_PROMPTS.PROMPT_SMILING.content,
        isDefault: 1,
      },
      {
        userId,
        promptName: "PROMPT_CTA",
        promptTemplate: HARDCODED_PROMPTS.PROMPT_CTA.content,
        isDefault: 1,
      },
    ];

    // Insert doar prompturile care nu există
    for (const prompt of defaultPrompts) {
      const exists = existingPrompts.find((p) => p.promptName === prompt.promptName);
      if (!exists) {
        await db.insert(userPrompts).values(prompt);
        console.log(`[Seed] Created default prompt ${prompt.promptName} for user ${userId}`);
      }
    }
  } catch (error) {
    console.error("[Seed] Failed to seed default prompts:", error);
  }
}
