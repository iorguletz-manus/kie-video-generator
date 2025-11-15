import { router, publicProcedure } from '../trpc';
import { z } from 'zod';
import { db } from '../../drizzle/db';
import { tams } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';

export const tamsRouter = router({
  // List all TAMs for a user
  list: publicProcedure
    .input(z.object({
      userId: z.number(),
    }))
    .query(async ({ input }) => {
      const result = await db
        .select()
        .from(tams)
        .where(eq(tams.userId, input.userId));
      return result;
    }),

  // Create a new TAM
  create: publicProcedure
    .input(z.object({
      userId: z.number(),
      name: z.string(),
    }))
    .mutation(async ({ input }) => {
      const [result] = await db
        .insert(tams)
        .values({
          userId: input.userId,
          name: input.name,
        });
      
      // Return the created TAM
      const [created] = await db
        .select()
        .from(tams)
        .where(eq(tams.id, result.insertId));
      
      return created;
    }),
});
