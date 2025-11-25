/**
 * Helper functions for generating BunnyCDN storage paths
 * New hierarchical structure for better organization
 */

/**
 * Sanitize a string to be used in a file path
 * Removes special characters and replaces spaces with hyphens
 */
export function sanitizePathSegment(str: string): string {
  return str
    .trim()
    .replace(/[^a-zA-Z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .toLowerCase();
}

/**
 * Generate path for user library images
 * Pattern: users/{userId}/library/images/{characterName}/{imageName}-{timestamp}.png
 */
export function generateImageLibraryPath(
  userId: number,
  characterName: string,
  imageName: string,
  timestamp: number = Date.now()
): string {
  const sanitizedCharacter = sanitizePathSegment(characterName);
  const sanitizedImageName = sanitizePathSegment(imageName);
  const randomSuffix = Math.random().toString(36).substring(2, 15);
  
  return `users/${userId}/library/images/${sanitizedCharacter}/${sanitizedImageName}-${timestamp}-${randomSuffix}.png`;
}

/**
 * Generate path for campaign-specific files (audio, trimmed videos)
 * Pattern: users/{userId}/campaigns/{TAM}/{CoreBelief}/{EmotionalAngle}/{Ad}/{Character}/{fileType}/{fileName}-{timestamp}.ext
 */
export function generateCampaignFilePath(
  userId: number,
  tamName: string,
  coreBeliefName: string,
  emotionalAngleName: string,
  adName: string,
  characterName: string,
  fileType: 'audio' | 'trimmed-videos' | 'waveforms',
  fileName: string,
  extension: string,
  timestamp: number = Date.now()
): string {
  const sanitizedTam = sanitizePathSegment(tamName);
  const sanitizedCoreBelief = sanitizePathSegment(coreBeliefName);
  const sanitizedEmotionalAngle = sanitizePathSegment(emotionalAngleName);
  const sanitizedAd = sanitizePathSegment(adName);
  const sanitizedCharacter = sanitizePathSegment(characterName);
  const sanitizedFileName = sanitizePathSegment(fileName);
  const randomSuffix = Math.random().toString(36).substring(2, 15);
  
  return `users/${userId}/campaigns/${sanitizedTam}/${sanitizedCoreBelief}/${sanitizedEmotionalAngle}/${sanitizedAd}/${sanitizedCharacter}/${fileType}/${sanitizedFileName}-${timestamp}-${randomSuffix}.${extension}`;
}

/**
 * Generate path for user profile image
 * Pattern: users/{userId}/profile/avatar-{timestamp}.png
 */
export function generateProfileImagePath(
  userId: number,
  timestamp: number = Date.now()
): string {
  const randomSuffix = Math.random().toString(36).substring(2, 15);
  return `users/${userId}/profile/avatar-${timestamp}-${randomSuffix}.png`;
}

/**
 * OLD PATH PATTERNS (for migration reference)
 * - Images: user-{userId}/library/{characterName}/{imageName}-{timestamp}.png
 * - Audio: audio-files/{fileName}.mp3
 * - Trimmed videos: trimmed-videos/{fileName}.mp4
 * - CleanVoice: cleanvoice/{fileName}
 */
