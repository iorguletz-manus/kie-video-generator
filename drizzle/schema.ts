import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

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
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserImage = typeof userImages.$inferSelect;
export type InsertUserImage = typeof userImages.$inferInsert;
