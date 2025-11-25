/**
 * Cleanup script: Remove temporary files from BunnyCDN
 * 
 * Files to remove:
 * - audio-files/* (all audio files)
 * - trimmed-videos/* (all trimmed videos)
 * - cleanvoice/* (all cleanvoice processed files)
 * - Any other temporary files
 * 
 * This script:
 * 1. Lists all files in specified folders
 * 2. Deletes each file
 * 3. Logs progress and errors
 */

// BunnyCDN configuration
const BUNNYCDN_STORAGE_PASSWORD = '4c9257d6-aede-4ff1-bb0f9fc95279-997e-412b';
const BUNNYCDN_STORAGE_ZONE = 'manus-storage';

interface CleanupStats {
  totalFolders: number;
  totalFiles: number;
  deleted: number;
  failed: number;
  errors: Array<{ path: string; error: string }>;
}

/**
 * List files in a BunnyCDN folder
 */
async function listBunnyFolder(folderPath: string): Promise<string[]> {
  const storageUrl = `https://storage.bunnycdn.com/${BUNNYCDN_STORAGE_ZONE}/${folderPath}/`;
  
  try {
    const response = await fetch(storageUrl, {
      method: 'GET',
      headers: {
        'AccessKey': BUNNYCDN_STORAGE_PASSWORD,
      },
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        console.log(`[Cleanup] Folder not found: ${folderPath}`);
        return [];
      }
      throw new Error(`Failed to list folder: ${response.status} ${response.statusText}`);
    }
    
    const files = await response.json();
    
    // BunnyCDN returns array of objects with properties: Guid, ObjectName, Length, IsDirectory, etc.
    return files
      .filter((f: any) => !f.IsDirectory) // Only files, not folders
      .map((f: any) => f.ObjectName);
    
  } catch (error: any) {
    console.error(`[Cleanup] Error listing folder ${folderPath}:`, error.message);
    return [];
  }
}

/**
 * Delete a file from BunnyCDN
 */
async function deleteBunnyFile(filePath: string): Promise<boolean> {
  const storageUrl = `https://storage.bunnycdn.com/${BUNNYCDN_STORAGE_ZONE}/${filePath}`;
  
  try {
    const response = await fetch(storageUrl, {
      method: 'DELETE',
      headers: {
        'AccessKey': BUNNYCDN_STORAGE_PASSWORD,
      },
    });
    
    if (!response.ok && response.status !== 404) {
      throw new Error(`Failed to delete: ${response.status} ${response.statusText}`);
    }
    
    return true;
  } catch (error: any) {
    console.error(`[Cleanup] Error deleting ${filePath}:`, error.message);
    return false;
  }
}

/**
 * Clean up a folder
 */
async function cleanupFolder(folderPath: string, dryRun: boolean): Promise<{ deleted: number; failed: number; errors: Array<{ path: string; error: string }> }> {
  console.log(`\n[Cleanup] Processing folder: ${folderPath}`);
  
  const stats = {
    deleted: 0,
    failed: 0,
    errors: [] as Array<{ path: string; error: string }>,
  };
  
  // List files
  const files = await listBunnyFolder(folderPath);
  console.log(`[Cleanup] Found ${files.length} files in ${folderPath}`);
  
  if (files.length === 0) {
    return stats;
  }
  
  // Delete each file
  for (const fileName of files) {
    const fullPath = `${folderPath}/${fileName}`;
    
    if (dryRun) {
      console.log(`[DRY RUN] Would delete: ${fullPath}`);
      stats.deleted++;
    } else {
      console.log(`[Cleanup] Deleting: ${fullPath}`);
      const success = await deleteBunnyFile(fullPath);
      
      if (success) {
        console.log(`[Cleanup] ✅ Deleted: ${fullPath}`);
        stats.deleted++;
      } else {
        console.log(`[Cleanup] ❌ Failed to delete: ${fullPath}`);
        stats.failed++;
        stats.errors.push({
          path: fullPath,
          error: 'Delete failed',
        });
      }
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return stats;
}

/**
 * Main cleanup function
 */
export async function cleanupBunnyTemp(dryRun: boolean = false): Promise<CleanupStats> {
  console.log('='.repeat(80));
  console.log('BUNNY CDN CLEANUP SCRIPT');
  console.log('='.repeat(80));
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE (will delete files)'}`);
  console.log('');
  
  const stats: CleanupStats = {
    totalFolders: 0,
    totalFiles: 0,
    deleted: 0,
    failed: 0,
    errors: [],
  };
  
  // Folders to clean up
  const foldersToClean = [
    'audio-files',
    'trimmed-videos',
    'cleanvoice',
  ];
  
  stats.totalFolders = foldersToClean.length;
  
  try {
    for (const folder of foldersToClean) {
      const folderStats = await cleanupFolder(folder, dryRun);
      
      stats.totalFiles += folderStats.deleted + folderStats.failed;
      stats.deleted += folderStats.deleted;
      stats.failed += folderStats.failed;
      stats.errors.push(...folderStats.errors);
    }
    
    // Print summary
    console.log('');
    console.log('='.repeat(80));
    console.log('CLEANUP SUMMARY');
    console.log('='.repeat(80));
    console.log(`Folders processed: ${stats.totalFolders}`);
    console.log(`Total files: ${stats.totalFiles}`);
    console.log(`Deleted: ${stats.deleted}`);
    console.log(`Failed: ${stats.failed}`);
    
    if (stats.errors.length > 0) {
      console.log('');
      console.log('ERRORS:');
      stats.errors.forEach(({ path, error }) => {
        console.log(`  - ${path}: ${error}`);
      });
    }
    
    console.log('='.repeat(80));
    
  } catch (error: any) {
    console.error('Fatal error during cleanup:', error);
    throw error;
  }
  
  return stats;
}

// Run cleanup if executed directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  const dryRun = process.argv.includes('--dry-run');
  
  cleanupBunnyTemp(dryRun)
    .then(stats => {
      console.log('Cleanup completed successfully');
      process.exit(stats.failed > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('Cleanup failed:', error);
      process.exit(1);
    });
}
