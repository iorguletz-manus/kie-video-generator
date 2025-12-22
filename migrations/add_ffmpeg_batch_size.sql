-- Migration: Add ffmpegBatchSize column to app_users table
-- Date: 2025-12-22
-- Description: Add FFmpeg batch size setting to user preferences (default: 15)

-- Check if column exists before adding (safe migration)
ALTER TABLE app_users 
ADD COLUMN IF NOT EXISTS ffmpegBatchSize INT NOT NULL DEFAULT 15 
COMMENT 'FFmpeg batch size for processing (default: 15)';

-- Verify migration
SELECT COUNT(*) as users_with_batch_size 
FROM app_users 
WHERE ffmpegBatchSize IS NOT NULL;
