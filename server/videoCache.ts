/**
 * In-memory cache pentru stocarea taskId-urilor și statusurilor video
 * Nu folosim baza de date conform cerințelor
 */

interface VideoTask {
  taskId: string;
  prompt: string;
  imageUrl: string;
  status: 'pending' | 'success' | 'failed';
  videoUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Cache simplu în memorie
const videoCache = new Map<string, VideoTask>();

export function saveVideoTask(taskId: string, prompt: string, imageUrl: string): void {
  videoCache.set(taskId, {
    taskId,
    prompt,
    imageUrl,
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

export function getVideoTask(taskId: string): VideoTask | undefined {
  return videoCache.get(taskId);
}

export function updateVideoTask(taskId: string, updates: Partial<VideoTask>): void {
  const task = videoCache.get(taskId);
  if (task) {
    videoCache.set(taskId, {
      ...task,
      ...updates,
      updatedAt: new Date(),
    });
  }
}

export function getAllVideoTasks(): VideoTask[] {
  return Array.from(videoCache.values());
}
