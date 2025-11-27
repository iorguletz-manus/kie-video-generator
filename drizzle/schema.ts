import { int, json, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * App users table for simple username/password authentication
 * Separate from Manus OAuth users table
 */
export const appUsers = mysqlTable("app_users", {
  id: int("id").autoincrement().primaryKey(),
  username: varchar("username", { length: 64 }).notNull().unique(),
  password: text("password").notNull(), // Plain text per requirement (no hashing)
  profileImageUrl: text("profileImageUrl"), // BunnyCDN URL for profile image
  kieApiKey: text("kieApiKey"), // Kling AI API key per user
  openaiApiKey: text("openaiApiKey"), // OpenAI API key per user
  ffmpegApiKey: text("ffmpegApiKey"), // FFMPEG API key per user
  cleanvoiceApiKey: text("cleanvoiceApiKey"), // CleanVoice API key per user
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AppUser = typeof appUsers.$inferSelect;
export type InsertAppUser = typeof appUsers.$inferInsert;

/**
 * App sessions table for storing user sessions
 * Each session belongs to a user and contains all session data
 */
export const appSessions = mysqlTable("app_sessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // Foreign key to app_users.id
  name: text("name").notNull(), // Session name with timestamp (ex: "Campanie Black Friday - 14 Nov 2025 14:45")
  data: text("data").notNull(), // JSON string containing all session data
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AppSession = typeof appSessions.$inferSelect;
export type InsertAppSession = typeof appSessions.$inferInsert;

/**
 * User images library table
 * Stores images uploaded by users for reuse across sessions
 * Supports character/avatar grouping (e.g., "Alina", "Unnamed")
 */
export const userImages = mysqlTable("user_images", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // Foreign key to app_users.id
  characterName: varchar("characterName", { length: 100 }).notNull().default("Unnamed"), // Character/avatar name (e.g., "Alina", "Unnamed")
  imageName: varchar("imageName", { length: 255 }).notNull(), // User-defined image name (editable)
  imageUrl: text("imageUrl").notNull(), // S3/BunnyCDN public URL
  imageKey: text("imageKey").notNull(), // S3 key for deletion
  displayOrder: int("displayOrder").default(0).notNull(), // Order for display within character (0 = newest/default)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserImage = typeof userImages.$inferSelect;
export type InsertUserImage = typeof userImages.$inferInsert;

/**
 * User prompts library table
 * Stores prompts for video generation (default + custom)
 * Default prompts (PROMPT_NEUTRAL, PROMPT_SMILING, PROMPT_CTA) cannot be deleted
 */
export const userPrompts = mysqlTable("user_prompts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // Foreign key to app_users.id
  promptName: varchar("promptName", { length: 100 }).notNull(), // Prompt name (e.g., "PROMPT_NEUTRAL", "My Custom Prompt")
  promptTemplate: text("promptTemplate").notNull(), // Prompt template text
  isDefault: int("isDefault").notNull().default(0), // 1 for default prompts (cannot be deleted), 0 for custom
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserPrompt = typeof userPrompts.$inferSelect;
export type InsertUserPrompt = typeof userPrompts.$inferInsert;

/**
 * TAM (Target Audience Market) table
 * Top-level parent category before Core Beliefs
 */
export const tams = mysqlTable("tams", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // Foreign key to app_users.id
  name: varchar("name", { length: 255 }).notNull(), // TAM name
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Tam = typeof tams.$inferSelect;
export type InsertTam = typeof tams.$inferInsert;

/**
 * Core Beliefs table
 * Second-level category under TAM
 */
export const coreBeliefs = mysqlTable("core_beliefs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // Foreign key to app_users.id
  tamId: int("tamId").notNull(), // Foreign key to tams.id
  name: varchar("name", { length: 255 }).notNull(), // Core belief name
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CoreBelief = typeof coreBeliefs.$inferSelect;
export type InsertCoreBelief = typeof coreBeliefs.$inferInsert;

/**
 * Emotional Angles table
 * Second-level category under Core Beliefs
 */
export const emotionalAngles = mysqlTable("emotional_angles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // Foreign key to app_users.id
  coreBeliefId: int("coreBeliefId").notNull(), // Foreign key to core_beliefs.id
  name: varchar("name", { length: 255 }).notNull(), // Emotional angle name
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type EmotionalAngle = typeof emotionalAngles.$inferSelect;
export type InsertEmotionalAngle = typeof emotionalAngles.$inferInsert;

/**
 * Ads table
 * Third-level category under Emotional Angles
 */
export const ads = mysqlTable("ads", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // Foreign key to app_users.id
  emotionalAngleId: int("emotionalAngleId").notNull(), // Foreign key to emotional_angles.id
  name: varchar("name", { length: 255 }).notNull(), // Ad name
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Ad = typeof ads.$inferSelect;
export type InsertAd = typeof ads.$inferInsert;

/**
 * Characters table
 * Optional fourth-level category under Ads
 */
export const characters = mysqlTable("characters", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // Foreign key to app_users.id
  name: varchar("name", { length: 255 }).notNull(), // Character name
  thumbnailUrl: text("thumbnailUrl"), // Thumbnail image URL (auto-cropped from first image)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Character = typeof characters.$inferSelect;
export type InsertCharacter = typeof characters.$inferInsert;

/**
 * Context sessions table for storing workflow data per context
 * Each context (TAM + Core Belief + Emotional Angle + Ad + Character) has its own session data
 */
export const contextSessions = mysqlTable("context_sessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  tamId: int("tamId"), // Nullable - may not be set initially
  coreBeliefId: int("coreBeliefId").notNull(),
  emotionalAngleId: int("emotionalAngleId").notNull(),
  adId: int("adId").notNull(),
  characterId: int("characterId").notNull(),
  
  // Workflow data stored as JSON
  currentStep: int("currentStep").default(1).notNull(),
  rawTextAd: text("rawTextAd"),
  processedTextAd: text("processedTextAd"),
  adLines: json("adLines"), // Array of ad lines
  prompts: json("prompts"), // Array of prompts
  images: json("images"), // Array of images
  combinations: json("combinations"), // Array of combinations
  deletedCombinations: json("deletedCombinations"), // Array of deleted combinations
  videoResults: json("videoResults"), // Array of video results
  reviewHistory: json("reviewHistory"), // Array of review history
  hookMergedVideos: json("hookMergedVideos"), // Object: { baseName: cdnUrl }
  bodyMergedVideoUrl: text("bodyMergedVideoUrl"), // CDN URL for merged body video
  finalVideos: json("finalVideos"), // Array of final merged videos (hook + body combinations)
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ContextSession = typeof contextSessions.$inferSelect;
export type InsertContextSession = typeof contextSessions.$inferInsert;
