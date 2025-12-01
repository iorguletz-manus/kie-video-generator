import { eq, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, appUsers, InsertAppUser, appSessions, InsertAppSession, userImages, InsertUserImage, userPrompts, InsertUserPrompt, tams, coreBeliefs, InsertCoreBelief, emotionalAngles, InsertEmotionalAngle, ads, InsertAd, characters, InsertCharacter, contextSessions, InsertContextSession } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// App Users helpers
export async function createAppUser(user: InsertAppUser) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  try {
    const result = await db.insert(appUsers).values(user);
    return result;
  } catch (error) {
    console.error("[Database] Failed to create app user:", error);
    throw error;
  }
}

export async function getAppUserByUsername(username: string) {
  const db = await getDb();
  if (!db) {
    return undefined;
  }

  const result = await db.select().from(appUsers).where(eq(appUsers.username, username)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAppUserById(id: number) {
  const db = await getDb();
  if (!db) {
    return undefined;
  }

  const result = await db.select().from(appUsers).where(eq(appUsers.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateAppUser(id: number, data: Partial<InsertAppUser>) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  try {
    await db.update(appUsers).set(data).where(eq(appUsers.id, id));
  } catch (error) {
    console.error("[Database] Failed to update app user:", error);
    throw error;
  }
}

// App Sessions helpers
export async function createAppSession(session: InsertAppSession) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  try {
    const result = await db.insert(appSessions).values(session);
    return result;
  } catch (error) {
    console.error("[Database] Failed to create app session:", error);
    throw error;
  }
}

export async function getAppSessionsByUserId(userId: number) {
  const db = await getDb();
  if (!db) {
    return [];
  }

  const result = await db.select().from(appSessions).where(eq(appSessions.userId, userId));
  return result;
}

export async function updateAppSession(id: number, data: Partial<InsertAppSession>) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  try {
    await db.update(appSessions).set(data).where(eq(appSessions.id, id));
  } catch (error) {
    console.error("[Database] Failed to update app session:", error);
    throw error;
  }
}

export async function deleteAppSession(id: number) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  try {
    await db.delete(appSessions).where(eq(appSessions.id, id));
  } catch (error) {
    console.error("[Database] Failed to delete app session:", error);
    throw error;
  }
}


// User Images Library helpers
export async function createUserImage(image: InsertUserImage) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  try {
    const result = await db.insert(userImages).values(image);
    return result;
  } catch (error) {
    console.error("[Database] Failed to create user image:", error);
    throw error;
  }
}

export async function getUserImagesByUserId(userId: number) {
  const db = await getDb();
  if (!db) {
    return [];
  }

  const result = await db.select().from(userImages).where(eq(userImages.userId, userId)).orderBy(userImages.displayOrder, userImages.id);
  return result;
}

export async function getUserImagesByCharacter(userId: number, characterName: string) {
  const db = await getDb();
  if (!db) {
    return [];
  }

  const result = await db.select().from(userImages)
    .where(and(
      eq(userImages.userId, userId),
      eq(userImages.characterName, characterName)
    ))
    .orderBy(userImages.displayOrder, userImages.id);
  return result;
}

export async function updateUserImage(id: number, data: Partial<InsertUserImage>) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  try {
    await db.update(userImages).set(data).where(eq(userImages.id, id));
  } catch (error) {
    console.error("[Database] Failed to update user image:", error);
    throw error;
  }
}

export async function deleteUserImage(id: number) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  try {
    await db.delete(userImages).where(eq(userImages.id, id));
  } catch (error) {
    console.error("[Database] Failed to delete user image:", error);
    throw error;
  }
}

export async function getUniqueCharacterNames(userId: number): Promise<string[]> {
  const db = await getDb();
  if (!db) {
    return [];
  }

  // Get characters from categoryCharacters table (created from homepage)
  const categoryChars = await db.select({ name: characters.name })
    .from(characters)
    .where(eq(characters.userId, userId));

  // Get characters from userImages table (from uploaded images)
  const imageChars = await db.select({ characterName: userImages.characterName })
    .from(userImages)
    .where(eq(userImages.userId, userId))
    .groupBy(userImages.characterName);
  
  // Combine both sources
  const categoryCharNames = categoryChars.map(c => c.name).filter((name): name is string => name != null && name.trim() !== "");
  const imageCharNames = imageChars.map(r => r.characterName).filter((name): name is string => name != null && name.trim() !== "");
  
  // Merge and remove duplicates
  const allCharNames = [...new Set([...categoryCharNames, ...imageCharNames])];
  
  return allCharNames;
}

// User Prompts Library helpers
export async function createUserPrompt(prompt: InsertUserPrompt) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  try {
    const result = await db.insert(userPrompts).values(prompt);
    return result;
  } catch (error) {
    console.error("[Database] Failed to create user prompt:", error);
    throw error;
  }
}

export async function getUserPromptsByUserId(userId: number) {
  const db = await getDb();
  if (!db) {
    return [];
  }

  const result = await db.select().from(userPrompts).where(eq(userPrompts.userId, userId));
  return result;
}

export async function getUserPromptById(id: number) {
  const db = await getDb();
  if (!db) {
    return undefined;
  }

  const result = await db.select().from(userPrompts).where(eq(userPrompts.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateUserPrompt(id: number, data: Partial<InsertUserPrompt>) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  try {
    await db.update(userPrompts).set(data).where(eq(userPrompts.id, id));
  } catch (error) {
    console.error("[Database] Failed to update user prompt:", error);
    throw error;
  }
}

export async function deleteUserPrompt(id: number) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  try {
    await db.delete(userPrompts).where(eq(userPrompts.id, id));
  } catch (error) {
    console.error("[Database] Failed to delete user prompt:", error);
    throw error;
  }
}

// ============================================================================
// TAMs CRUD
// ============================================================================

export async function createTam(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(tams).values(data);
  return result;
}

export async function getTamsByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(tams).where(eq(tams.userId, userId));
}

export async function getTamById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const results = await db.select().from(tams).where(eq(tams.id, id));
  return results[0] || null;
}

export async function updateTam(id: number, data: Partial<any>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(tams).set(data).where(eq(tams.id, id));
}

export async function deleteTam(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(tams).where(eq(tams.id, id));
}

// CORE BELIEFS CRUD
// ============================================================================

export async function createCoreBelief(data: InsertCoreBelief) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(coreBeliefs).values(data);
  return result;
}

export async function getCoreBeliefsByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(coreBeliefs).where(eq(coreBeliefs.userId, userId));
}

export async function getCoreBeliefsByTamId(tamId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(coreBeliefs).where(eq(coreBeliefs.tamId, tamId));
}

export async function getCoreBeliefById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(coreBeliefs).where(eq(coreBeliefs.id, id));
  return result[0] || null;
}

export async function updateCoreBelief(id: number, data: Partial<InsertCoreBelief>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.update(coreBeliefs).set(data).where(eq(coreBeliefs.id, id));
}

export async function deleteCoreBelief(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.delete(coreBeliefs).where(eq(coreBeliefs.id, id));
}

// ============================================================================
// EMOTIONAL ANGLES CRUD
// ============================================================================

export async function createEmotionalAngle(data: InsertEmotionalAngle) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(emotionalAngles).values(data);
  return result;
}

export async function getEmotionalAnglesByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(emotionalAngles).where(eq(emotionalAngles.userId, userId));
}

export async function getEmotionalAnglesByCoreBeliefId(coreBeliefId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(emotionalAngles).where(eq(emotionalAngles.coreBeliefId, coreBeliefId));
}

export async function getEmotionalAngleById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(emotionalAngles).where(eq(emotionalAngles.id, id));
  return result[0] || null;
}

export async function updateEmotionalAngle(id: number, data: Partial<InsertEmotionalAngle>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.update(emotionalAngles).set(data).where(eq(emotionalAngles.id, id));
}

export async function deleteEmotionalAngle(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.delete(emotionalAngles).where(eq(emotionalAngles.id, id));
}

// ============================================================================
// ADS CRUD
// ============================================================================

export async function createAd(data: InsertAd) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(ads).values(data);
  return result;
}

export async function getAdsByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(ads).where(eq(ads.userId, userId));
}

export async function getAdsByEmotionalAngleId(emotionalAngleId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(ads).where(eq(ads.emotionalAngleId, emotionalAngleId));
}

export async function getAdById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(ads).where(eq(ads.id, id));
  return result[0] || null;
}

export async function updateAd(id: number, data: Partial<InsertAd>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.update(ads).set(data).where(eq(ads.id, id));
}

export async function deleteAd(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.delete(ads).where(eq(ads.id, id));
}

// ============================================================================
// CHARACTERS CRUD
// ============================================================================

export async function createCharacter(data: InsertCharacter) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(characters).values(data);
  const insertId = result[0].insertId;
  
  // Return the created character
  const created = await db.select().from(characters).where(eq(characters.id, insertId));
  return created[0];
}

export async function getCharactersByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(characters).where(eq(characters.userId, userId));
}

export async function getCharacterById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(characters).where(eq(characters.id, id));
  return result[0] || null;
}

export async function updateCharacter(id: number, data: Partial<InsertCharacter>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.update(characters).set(data).where(eq(characters.id, id));
}

export async function deleteCharacter(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.delete(characters).where(eq(characters.id, id));
}

// ============================================
// Context Sessions
// ============================================

export async function getContextSession(params: {
  userId: number;
  coreBeliefId: number;
  emotionalAngleId: number;
  adId: number;
  characterId: number;
}) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(contextSessions)
    .where(
      and(
        eq(contextSessions.userId, params.userId),
        eq(contextSessions.coreBeliefId, params.coreBeliefId),
        eq(contextSessions.emotionalAngleId, params.emotionalAngleId),
        eq(contextSessions.adId, params.adId),
        eq(contextSessions.characterId, params.characterId)
      )
    )
    .limit(1);

  return result[0] || null;
}

export async function upsertContextSession(session: InsertContextSession) {
  const db = await getDb();
  if (!db) return null;

  // DEBUG: Log overlay settings being saved
  if (session.videoResults) {
    const videosWithOverlay = session.videoResults.filter((v: any) => v.overlaySettings);
    console.log('[DB] 💾 upsertContextSession - Videos with overlay settings:', videosWithOverlay.length);
    videosWithOverlay.forEach((v: any) => {
      console.log(`[DB] 📝 ${v.videoName}:`, v.overlaySettings);
    });
  }

  // Check if session exists
  const existing = await getContextSession({
    userId: session.userId,
    coreBeliefId: session.coreBeliefId,
    emotionalAngleId: session.emotionalAngleId,
    adId: session.adId,
    characterId: session.characterId,
  });

  if (existing) {
    // Update existing session
    await db
      .update(contextSessions)
      .set(session)
      .where(eq(contextSessions.id, existing.id));
    console.log('[DB] ✅ Updated existing session ID:', existing.id);
    return { ...existing, ...session };
  } else {
    // Insert new session
    const result = await db.insert(contextSessions).values(session);
    console.log('[DB] ✅ Inserted new session ID:', result.insertId);
    return { id: Number(result.insertId), ...session };
  }
}

export async function deleteContextSession(id: number) {
  const db = await getDb();
  if (!db) return;

  await db.delete(contextSessions).where(eq(contextSessions.id, id));
}
