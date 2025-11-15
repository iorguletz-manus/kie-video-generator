import { eq, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, appUsers, InsertAppUser, appSessions, InsertAppSession, userImages, InsertUserImage, userPrompts, InsertUserPrompt } from "../drizzle/schema";
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

  const result = await db.select().from(userImages).where(eq(userImages.userId, userId));
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
    ));
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

  const result = await db.select({ characterName: userImages.characterName })
    .from(userImages)
    .where(eq(userImages.userId, userId))
    .groupBy(userImages.characterName);
  
  return result.map(r => r.characterName);
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
