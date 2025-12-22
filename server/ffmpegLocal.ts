import { exec as execCallback } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync } from 'fs';

const exec = promisify(execCallback);

/**
 * Run FFmpeg locally to merge videos with filter_complex
 * This replaces the FFmpeg API which was corrupting videos
 */
export async function mergeVideosLocally(
  videoUrls: string[],
  outputPath: string,
  useLoudnorm: boolean = true
): Promise<void> {
  console.log(`[mergeVideosLocally] Starting local merge of ${videoUrls.length} videos...`);
  console.log(`[mergeVideosLocally] Output: ${outputPath}`);
  console.log(`[mergeVideosLocally] Loudnorm: ${useLoudnorm ? 'ENABLED' : 'DISABLED'}`);
  
  // 1. Create temp directory for downloads
  const tempDir = path.join('/tmp', `ffmpeg_merge_${Date.now()}`);
  await fs.mkdir(tempDir, { recursive: true });
  console.log(`[mergeVideosLocally] Created temp directory: ${tempDir}`);
  
  try {
    // 2. Download all videos to temp directory
    const localPaths: string[] = [];
    
    for (let i = 0; i < videoUrls.length; i++) {
      const url = videoUrls[i];
      const localPath = path.join(tempDir, `input_${i}.mp4`);
      
      console.log(`[mergeVideosLocally] Downloading ${i + 1}/${videoUrls.length}: ${url}`);
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to download video ${i}: ${response.statusText}`);
      }
      
      const buffer = Buffer.from(await response.arrayBuffer());
      await fs.writeFile(localPath, buffer);
      
      console.log(`[mergeVideosLocally] ✅ Downloaded ${buffer.length} bytes to ${localPath}`);
      localPaths.push(localPath);
    }
    
    // 3. Build FFmpeg command
    // Input files: -i input_0.mp4 -i input_1.mp4 ...
    const inputArgs = localPaths.map(p => `-i "${p}"`).join(' ');
    
    // Filter complex: [0:v][0:a][1:v][1:a]concat=n=2:v=1:a=1[v][a0];[a0]loudnorm=I=-14:TP=-1.5:LRA=11[a]
    const inputStreams = localPaths.map((_, i) => `[${i}:v][${i}:a]`).join('');
    const filterComplex = useLoudnorm
      ? `${inputStreams}concat=n=${videoUrls.length}:v=1:a=1[v][a0];[a0]loudnorm=I=-14:TP=-1.5:LRA=11[a]`
      : `${inputStreams}concat=n=${videoUrls.length}:v=1:a=1[v][a]`;
    
    // Output options (same as FFmpeg API)
    const outputOptions = [
      '-map "[v]"',
      '-map "[a]"',
      '-fflags +genpts',
      '-c:v libx264',
      '-crf 18',
      '-preset medium',
      '-c:a aac',
      '-ar 48000',
      '-ac 1',
      '-shortest',
      '-y'
    ].join(' ');
    
    const ffmpegCommand = `ffmpeg ${inputArgs} -filter_complex "${filterComplex}" ${outputOptions} "${outputPath}"`;
    
    console.log(`\n========================================`);
    console.log(`[mergeVideosLocally] 🎬 FFmpeg Command:`);
    console.log(`========================================`);
    console.log(ffmpegCommand);
    console.log(`========================================\n`);
    
    // 4. Execute FFmpeg
    console.log(`[mergeVideosLocally] Executing FFmpeg...`);
    const startTime = Date.now();
    
    const { stdout, stderr } = await exec(ffmpegCommand, {
      maxBuffer: 50 * 1024 * 1024 // 50MB buffer for FFmpeg output
    });
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[mergeVideosLocally] ✅ FFmpeg completed in ${duration}s`);
    
    // Log FFmpeg output (last 50 lines)
    if (stderr) {
      const lines = stderr.split('\n').slice(-50);
      console.log(`[mergeVideosLocally] FFmpeg output (last 50 lines):`);
      lines.forEach(line => console.log(`  ${line}`));
    }
    
    // 5. Verify output file exists
    if (!existsSync(outputPath)) {
      throw new Error(`Output file not created: ${outputPath}`);
    }
    
    const stats = await fs.stat(outputPath);
    console.log(`[mergeVideosLocally] ✅ Output file created: ${outputPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
    
  } finally {
    // 6. Cleanup temp directory
    try {
      console.log(`[mergeVideosLocally] Cleaning up temp directory: ${tempDir}`);
      await fs.rm(tempDir, { recursive: true, force: true });
      console.log(`[mergeVideosLocally] ✅ Cleanup complete`);
    } catch (cleanupError) {
      console.warn(`[mergeVideosLocally] ⚠️ Cleanup failed (non-fatal):`, cleanupError);
    }
  }
}

/**
 * Check if FFmpeg is available on the system
 */
export async function checkFFmpegAvailable(): Promise<boolean> {
  try {
    const { stdout } = await exec('ffmpeg -version');
    const version = stdout.split('\n')[0];
    console.log(`[checkFFmpegAvailable] ✅ FFmpeg found: ${version}`);
    return true;
  } catch (error) {
    console.error(`[checkFFmpegAvailable] ❌ FFmpeg not found:`, error);
    return false;
  }
}
