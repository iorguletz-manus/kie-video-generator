import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import JSZip from 'jszip';
import { useLocation } from "wouter";
import EditProfileModal from '@/components/EditProfileModal';

import { VideoEditorV2 } from '@/components/VideoEditorV2';
import { ProcessingModal } from '@/components/ProcessingModal';
import MergeProgressModal from '@/components/MergeProgressModal';
import { trpc } from '../lib/trpc';
import mammoth from 'mammoth';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Upload, X, Check, Loader2, Video, FileText, Image as ImageIcon, Map as MapIcon, Play, Download, Undo2, ChevronLeft, RefreshCw, Clock, Search, FileEdit, MessageSquare, Images, Grid3x3, Scissors, CheckCircle2, Folder, Settings as SettingsIcon, LogOut, Sparkles, AlertTriangle, ChevronRight } from "lucide-react";

type PromptType = 'PROMPT_NEUTRAL' | 'PROMPT_SMILING' | 'PROMPT_CTA' | 'PROMPT_CUSTOM';
type SectionType = 'HOOKS' | 'MIRROR' | 'DCS' | 'TRANZITION' | 'NEW_CAUSE' | 'MECHANISM' | 'EMOTIONAL_PROOF' | 'TRANSFORMATION' | 'CTA' | 'OTHER';

interface AdLine {
  id: string;
  text: string;
  section: SectionType;
  promptType: PromptType;
  videoName: string;
  categoryNumber: number;
  charCount: number;
  redStart?: number;  // Start index of added text (red)
  redEnd?: number;    // End index of added text (red)
}

interface UploadedPrompt {
  id: string;
  name: string;
  template: string;
  file: File | null; // null pentru prompturi manuale
}

interface UploadedImage {
  id: string;
  url: string;
  file: File | null; // null pentru imagini din library
  fileName: string;
  isCTA: boolean;
  fromLibrary?: boolean; // true pentru imagini din library
}

interface Combination {
  id: string;
  text: string;
  imageUrl: string;
  imageId: string;
  promptType: PromptType;
  videoName: string;
  section: SectionType;
  categoryNumber: number;
  redStart?: number;  // Start index of red text
  redEnd?: number;    // End index of red text
}

interface VideoResult {
  id?: string;
  taskId?: string;
  text: string;
  imageUrl: string;
  status: 'pending' | 'success' | 'failed' | null;
  videoUrl?: string;
  error?: string;
  videoName: string;
  section: SectionType;
  categoryNumber: number;
  reviewStatus: 'pending' | 'accepted' | 'regenerate' | null;
  regenerationNote?: string; // Ex: "⚠️ 3 regenerări cu aceleași setări"
  internalNote?: string; // Internal note added by user in Step 7
  isDuplicate?: boolean; // true dacă e duplicate
  duplicateNumber?: number; // 1, 2, 3, etc.
  originalVideoName?: string; // videoName original (fără _D1, _D2)
  redStart?: number;  // Start index of red text
  redEnd?: number;    // End index of red text
  // Step 8: Video Editing fields
  whisperTranscript?: any;  // Full Whisper API response
  cutPoints?: any;          // Calculated cut points from backend
  words?: any[];            // Whisper word-level timestamps
  editStatus?: 'pending' | 'processed' | 'edited'; // Processing status

  audioUrl?: string;        // Audio download URL from FFmpeg API
  waveformData?: string;    // Waveform JSON data
  editingDebugInfo?: any;   // Debug info from Whisper processing
  cleanvoiceAudioUrl?: string; // CleanVoice processed audio URL
  // Step 9: Trimmed video fields
  trimmedVideoUrl?: string; // Trimmed video URL from Bunny CDN

  recutStatus?: 'accepted' | 'recut' | null; // Review status in Step 9
  step9Note?: string;       // Internal note added by user in Step 9
}

interface HomeProps {
  currentUser: { id: number; username: string; profileImageUrl: string | null; kieApiKey: string | null; openaiApiKey: string | null; ffmpegApiKey: string | null; cleanvoiceApiKey: string | null };
  onLogout: () => void;
}

// ========== HELPER FUNCTIONS FOR DUPLICATE VIDEOS ==========

/**
 * Generează numele pentru un video duplicate
 * Ex: "T1_C1_E1_AD1_CTA1_ALINA" → "T1_C1_E1_AD1_CTA1_ALINA_D1"
 */
function generateDuplicateName(originalName: string, existingVideos: VideoResult[]): string {
  // Găsește toate duplicate-urile existente pentru acest video
  const duplicatePattern = new RegExp(`^${originalName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}_D(\\d+)$`);
  const existingDuplicates = existingVideos
    .map(v => {
      const match = v.videoName.match(duplicatePattern);
      return match ? parseInt(match[1]) : 0;
    })
    .filter(n => n > 0);
  
  // Găsește următorul număr disponibil
  const nextNumber = existingDuplicates.length > 0 
    ? Math.max(...existingDuplicates) + 1 
    : 1;
  
  return `${originalName}_D${nextNumber}`;
}

/**
 * Extrage videoName original din numele duplicate
 * Ex: "T1_C1_E1_AD1_CTA1_ALINA_D1" → "T1_C1_E1_AD1_CTA1_ALINA"
 */
function getOriginalVideoName(videoName: string): string {
  return videoName.replace(/_D\d+$/, '');
}

/**
 * Verifică dacă un videoName este duplicate
 */
function isDuplicateVideo(videoName: string): boolean {
  return /_D\d+$/.test(videoName);
}

/**
 * Extrage numărul duplicate din videoName
 * Ex: "T1_C1_E1_AD1_CTA1_ALINA_D2" → 2
 */
function getDuplicateNumber(videoName: string): number | null {
  const match = videoName.match(/_D(\d+)$/);
  return match ? parseInt(match[1]) : null;
}

export default function Home({ currentUser, onLogout }: HomeProps) {
  const [, setLocation] = useLocation();
  
  // Step 1: Categories
  const [selectedTamId, setSelectedTamId] = useState<number | null>(null);
  const [selectedCoreBeliefId, setSelectedCoreBeliefId] = useState<number | null>(null);
  const [selectedEmotionalAngleId, setSelectedEmotionalAngleId] = useState<number | null>(null);
  const [selectedAdId, setSelectedAdId] = useState<number | null>(() => {
    const saved = localStorage.getItem('selectedAdId');
    return saved ? parseInt(saved) : null;
  });
  const [selectedCharacterId, setSelectedCharacterId] = useState<number | null>(() => {
    const saved = localStorage.getItem('selectedCharacterId');
    return saved ? parseInt(saved) : null;
  });
  const previousCharacterIdRef = useRef<number | null>(null);
  const [textAdMode, setTextAdMode] = useState<'upload' | 'paste' | 'google-doc'>('upload');
  const [rawTextAd, setRawTextAd] = useState<string>('');
  const [processedTextAd, setProcessedTextAd] = useState<string>('');
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  
  // Step 2: Text Ad Document (moved from STEP 1)
  const [adDocument, setAdDocument] = useState<File | null>(null);
  const [adLines, setAdLines] = useState<AdLine[]>([]);
  const [deletedLinesHistory, setDeletedLinesHistory] = useState<AdLine[]>([]);
  
  // Step 2: Prompts (3 prompts)
  const [prompts, setPrompts] = useState<UploadedPrompt[]>([]);
  const [useHardcodedPrompts, setUseHardcodedPrompts] = useState(true);
  
  // Step 3: Images
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  
  // Step 8: Video Editing Processing
  const [showProcessingModal, setShowProcessingModal] = useState(false);
  const [processingProgress, setProcessingProgress] = useState({ 
    ffmpeg: { current: 0, total: 0, status: 'idle' as 'idle' | 'processing' | 'complete', activeVideos: [] as string[] },
    whisper: { current: 0, total: 0, status: 'idle' as 'idle' | 'processing' | 'complete', activeVideos: [] as string[] },
    cleanvoice: { current: 0, total: 0, status: 'idle' as 'idle' | 'processing' | 'complete', activeVideos: [] as string[] },
    currentVideoName: '',
    countdown: 0,
    estimatedMinutes: 0,
    successVideos: [] as string[],
    failedVideos: [] as Array<{ videoName: string; error: string }>,
    // Phase-specific tracking
    ffmpegSuccess: [] as string[],
    ffmpegFailed: [] as Array<{ videoName: string; error: string }>,
    whisperSuccess: [] as string[],
    whisperFailed: [] as Array<{ videoName: string; error: string }>,
    cleanvoiceSuccess: [] as string[],
    cleanvoiceFailed: [] as Array<{ videoName: string; error: string }>
  });
  const [processingStep, setProcessingStep] = useState<'download' | 'extract' | 'whisper' | 'cleanvoice' | 'detect' | 'save' | null>(null);
  
  // Step 4: Mapping
  const [combinations, setCombinations] = useState<Combination[]>([]);
  const [deletedCombinations, setDeletedCombinations] = useState<Combination[]>([]);
  
  // Step 5: Generate
  const [videoResults, setVideoResults] = useState<VideoResult[]>([]);
  const [modifyingVideoIndex, setModifyingVideoIndex] = useState<number | null>(null);
  const [modifyPromptType, setModifyPromptType] = useState<PromptType>('PROMPT_NEUTRAL');
  const [modifyPromptText, setModifyPromptText] = useState('');
  const [modifyDialogueText, setModifyDialogueText] = useState('');
  const [modifyRedStart, setModifyRedStart] = useState<number>(-1);
  const [modifyRedEnd, setModifyRedEnd] = useState<number>(-1);
  const [modifyImageCharacterFilter, setModifyImageCharacterFilter] = useState<string>('all');
  const modifyEditorRef = useRef<HTMLDivElement>(null);
  const skipCountdownRef = useRef(false);
  const cancelSampleMergeRef = useRef(false);
  
  // State pentru custom prompts (fiecare video poate avea propriul custom prompt)
  const [customPrompts, setCustomPrompts] = useState<Record<number, string>>({});
  
  // State pentru filtru STEP 6 (show all / accepted / failed)
  const [videoFilter, setVideoFilter] = useState<'all' | 'accepted' | 'failed'>('all');
  
  // State pentru filtru STEP 5 (show all / accepted / regenerate)
  const [step5Filter, setStep5Filter] = useState<'all' | 'accepted' | 'regenerate'>('all');
  
  // State pentru edit timestamps (când user dă SAVE în Modify & Regenerate)
  const [editTimestamps, setEditTimestamps] = useState<Record<number, number>>({});
  
  const [currentTime, setCurrentTime] = useState(Date.now());
  
  // State pentru tracking modificări (pentru blocare navigare)
  const [hasModifications, setHasModifications] = useState(false);
  
  // Removed lock system - free navigation enabled
  
  // Step 2: Manual prompt textarea
  const [manualPromptText, setManualPromptText] = useState('');
  const [promptMode, setPromptMode] = useState<'hardcoded' | 'custom' | 'manual'>('hardcoded');
  
  // Step 6: Regenerate (advanced)
  const [selectedVideoIndex, setSelectedVideoIndex] = useState<number>(-1);
  const [editingVideoName, setEditingVideoName] = useState<string | null>(null);
  const [editedVideoNameText, setEditedVideoNameText] = useState<string>('');
  const [editingCategory, setEditingCategory] = useState<string>('');
  const [regenerateMultiple, setRegenerateMultiple] = useState(false);
  const [regenerateVariantCount, setRegenerateVariantCount] = useState(1);
  const [regenerateVariants, setRegenerateVariants] = useState<Array<{
    promptType: PromptType | 'custom';
    promptText: string;
    dialogueText: string;
    imageUrl: string;
  }>>([]);
  
  // Step 7: Final Review (check videos)
  const [reviewHistory, setReviewHistory] = useState<Array<{
    videoName: string;
    previousStatus: 'pending' | 'accepted' | 'regenerate' | null;
    newStatus: 'pending' | 'accepted' | 'regenerate' | null;
  }>>([]);
  
  // Step 9: Recut review
  const [step9Filter, setStep9Filter] = useState<'all' | 'accepted' | 'recut'>('all');
  const [recutHistory, setRecutHistory] = useState<Array<{
    videoName: string;
    previousStatus: 'pending' | 'accepted' | 'recut' | null;
    newStatus: 'pending' | 'accepted' | 'recut' | null;
  }>>([]);
  
  // Current step - initialize from database if available to prevent Step 1 flash
  const [currentStep, setCurrentStep] = useState(() => {
    // Try to get currentStep from contextSession on initial mount
    return 1; // Will be updated by useEffect immediately
  });
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  
  // Session management
  const [currentSessionId, setCurrentSessionId] = useState<string>('default');
  
  // Edit Profile modal
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [localCurrentUser, setLocalCurrentUser] = useState(currentUser);
  // Step 8 → Step 9: Trimming modal
  const [isTrimmingModalOpen, setIsTrimmingModalOpen] = useState(false);
  const [trimmingMergedVideoUrl, setTrimmingMergedVideoUrl] = useState<string | null>(null);
  const [trimmingCurrentVideoName, setTrimmingCurrentVideoName] = useState<string>('');
  const [isTrimmingSuccessLogOpen, setIsTrimmingSuccessLogOpen] = useState(false);
  const [isTrimmingFailedLogOpen, setIsTrimmingFailedLogOpen] = useState(false);
  const [trimmingProgress, setTrimmingProgress] = useState<{
    current: number;
    total: number;
    currentVideo: string;
    status: 'idle' | 'processing' | 'merging' | 'complete' | 'partial';
    message: string;
    successVideos: Array<{name: string}>;
    failedVideos: Array<{name: string; error: string; retries: number; status?: 'retrying'}>;
    inProgressVideos: Array<{name: string}>;
    mergedVideos: Array<{name: string; type: 'hooks' | 'body'}>; // Separate list for hooks/body merged
    currentBatch: number;
    totalBatches: number;
    batchSize: number;
    mergeStatus: 'idle' | 'pending' | 'success' | 'failed';
    ffmpegRequestsCurrent: number;
    ffmpegRequestsTotal: number;
    countdown: number;  // Countdown timer in seconds for 65s pause
    cuttingCurrent: number;  // Track cutting progress separately
    cuttingTotal: number;
    mergingCurrent: number;  // Track merging progress separately (hooks + body)
    mergingTotal: number;
  }>({
    current: 0,
    total: 0,
    currentVideo: '',
    status: 'idle',
    message: '',
    successVideos: [],
    failedVideos: [],
    inProgressVideos: [],
    mergedVideos: [],
    currentBatch: 0,
    totalBatches: 0,
    batchSize: 0,
    mergeStatus: 'idle',
    ffmpegRequestsCurrent: 0,
    ffmpegRequestsTotal: 0,
    countdown: 0,
    cuttingCurrent: 0,
    cuttingTotal: 0,
    mergingCurrent: 0,
    mergingTotal: 0
  });
  
  // Auto-open failed list if there are failures
  useEffect(() => {
    if (trimmingProgress.failedVideos.length > 0) {
      setIsTrimmingFailedLogOpen(true);
    }
  }, [trimmingProgress.failedVideos.length]);
  
  // Cut & Merge modal with localStorage persistence
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [mergedVideoUrl, setMergedVideoUrl] = useState<string | null>(() => {
    try {
      return localStorage.getItem('mergedVideoUrl') || null;
    } catch {
      return null;
    }
  });
  const [mergeProgress, setMergeProgress] = useState<string>('');
  const [lastMergedPairHash, setLastMergedPairHash] = useState<string | null>(() => {
    try {
      return localStorage.getItem('lastMergedPairHash') || null;
    } catch {
      return null;
    }
  });
  
  // Persist Cut & Merge cache to localStorage
  useEffect(() => {
    if (mergedVideoUrl) {
      localStorage.setItem('mergedVideoUrl', mergedVideoUrl);
    }
  }, [mergedVideoUrl]);
  
  useEffect(() => {
    if (lastMergedPairHash) {
      localStorage.setItem('lastMergedPairHash', lastMergedPairHash);
    }
  }, [lastMergedPairHash]);
  
  // Sample Merge modal
  const [isSampleMergeModalOpen, setIsSampleMergeModalOpen] = useState(false);
  const [currentPlayingVideoName, setCurrentPlayingVideoName] = useState<string>('');
  // Sample Merge cache with localStorage persistence
  const [sampleMergedVideoUrl, setSampleMergedVideoUrl] = useState<string | null>(() => {
    try {
      return localStorage.getItem('sampleMergedVideoUrl') || null;
    } catch {
      return null;
    }
  });
  const [sampleMergeProgress, setSampleMergeProgress] = useState<string>('');
  const [sampleMergeVideos, setSampleMergeVideos] = useState<Array<{name: string, note: string}>>([]);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState<string>('');
  
  // Last sample video URL (for "Open Last Sample" link)
  const [lastSampleVideoUrl, setLastSampleVideoUrl] = useState<string | null>(() => {
    try {
      return localStorage.getItem('lastSampleVideoUrl') || null;
    } catch {
      return null;
    }
  });

  // Sample Merge countdown timer (58 seconds cooldown)
  const [lastSampleMergeTimestamp, setLastSampleMergeTimestamp] = useState<number | null>(() => {
    try {
      const saved = localStorage.getItem('lastSampleMergeTimestamp');
      return saved ? parseInt(saved, 10) : null;
    } catch {
      return null;
    }
  });
  const [sampleMergeCountdown, setSampleMergeCountdown] = useState<number>(0);
  
  // Persist lastSampleVideoUrl to localStorage
  useEffect(() => {
    if (lastSampleVideoUrl) {
      localStorage.setItem('lastSampleVideoUrl', lastSampleVideoUrl);
    }
  }, [lastSampleVideoUrl]);

  // Persist lastSampleMergeTimestamp to localStorage
  useEffect(() => {
    if (lastSampleMergeTimestamp !== null) {
      localStorage.setItem('lastSampleMergeTimestamp', lastSampleMergeTimestamp.toString());
    }
  }, [lastSampleMergeTimestamp]);

  // Countdown timer effect for Sample Merge
  useEffect(() => {
    if (sampleMergeCountdown > 0) {
      const timer = setTimeout(() => {
        setSampleMergeCountdown(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [sampleMergeCountdown]);
  
  // Sync current video name with playback time (Sample Merge)
  useEffect(() => {
    if (!sampleMergedVideoUrl || sampleMergeVideos.length === 0) return;
    
    const videoElement = document.getElementById('sample-merge-video-player') as HTMLVideoElement;
    if (!videoElement) return;
    
    // Build timeline from video durations
    const timeline: Array<{ startTime: number; endTime: number; name: string }> = [];
    let currentTime = 0;
    
    sampleMergeVideos.forEach((video) => {
      // Find video data to get duration
      const videoData = videoResults.find(v => v.videoName === video.name);
      if (!videoData?.cutPoints) return;
      
      const durationMs = (videoData.cutPoints.endKeep || 0) - (videoData.cutPoints.startKeep || 0);
      const durationSeconds = durationMs / 1000;
      
      timeline.push({
        startTime: currentTime,
        endTime: currentTime + durationSeconds,
        name: video.name,
      });
      
      currentTime += durationSeconds;
    });
    
    console.log('[Sample Merge] Timeline:', timeline);
    
    // Update current video name based on playback time
    const handleTimeUpdate = () => {
      const currentPlaybackTime = videoElement.currentTime;
      
      console.log(`[Video Sync] Current time: ${currentPlaybackTime.toFixed(2)}s`);
      
      const currentSegment = timeline.find(
        seg => currentPlaybackTime >= seg.startTime && currentPlaybackTime < seg.endTime
      );
      
      if (currentSegment) {
        console.log(`[Video Sync] Found segment: ${currentSegment.name} (${currentSegment.startTime.toFixed(2)}s - ${currentSegment.endTime.toFixed(2)}s)`);
        setCurrentPlayingVideoName(currentSegment.name);
      } else {
        console.log(`[Video Sync] ⚠️ No segment found for time ${currentPlaybackTime.toFixed(2)}s`);
      }
    };
    
    videoElement.addEventListener('timeupdate', handleTimeUpdate);
    videoElement.addEventListener('seeked', handleTimeUpdate);  // Update instantly when seeking
    
    // Set initial video name
    if (timeline.length > 0) {
      setCurrentPlayingVideoName(timeline[0].name);
    }
    
    return () => {
      videoElement.removeEventListener('timeupdate', handleTimeUpdate);
      videoElement.removeEventListener('seeked', handleTimeUpdate);
    };
  }, [sampleMergedVideoUrl, sampleMergeVideos, videoResults]);
  
  // Sync current video name with playback time (Trimming Modal)
  useEffect(() => {
    if (!trimmingMergedVideoUrl || trimmingProgress.successVideos.length === 0) return;
    
    const videoElement = document.getElementById('trimming-video-player') as HTMLVideoElement;
    if (!videoElement) return;
    
    // Build timeline from video durations
    const timeline: Array<{ startTime: number; endTime: number; name: string }> = [];
    let currentTime = 0;
    
    trimmingProgress.successVideos.forEach((video) => {
      // Find video data to get duration
      const videoData = videoResults.find(v => v.videoName === video.name);
      if (!videoData?.cutPoints) return;
      
      const durationMs = (videoData.cutPoints.endKeep || 0) - (videoData.cutPoints.startKeep || 0);
      const durationSeconds = durationMs / 1000;
      
      timeline.push({
        startTime: currentTime,
        endTime: currentTime + durationSeconds,
        name: video.name,
      });
      
      currentTime += durationSeconds;
    });
    
    console.log('[Trimming] Timeline:', timeline);
    
    // Update current video name based on playback time
    const handleTimeUpdate = () => {
      const currentPlaybackTime = videoElement.currentTime;
      
      console.log(`[Trimming Sync] Current time: ${currentPlaybackTime.toFixed(2)}s`);
      
      const currentSegment = timeline.find(
        seg => currentPlaybackTime >= seg.startTime && currentPlaybackTime < seg.endTime
      );
      
      if (currentSegment) {
        console.log(`[Trimming Sync] Found segment: ${currentSegment.name} (${currentSegment.startTime.toFixed(2)}s - ${currentSegment.endTime.toFixed(2)}s)`);
        setTrimmingCurrentVideoName(currentSegment.name);
      } else {
        console.log(`[Trimming Sync] ⚠️ No segment found for time ${currentPlaybackTime.toFixed(2)}s`);
      }
    };
    
    videoElement.addEventListener('timeupdate', handleTimeUpdate);
    videoElement.addEventListener('seeked', handleTimeUpdate);  // Update instantly when seeking
    
    // Set initial video name
    if (timeline.length > 0) {
      setTrimmingCurrentVideoName(timeline[0].name);
    }
    
    return () => {
      videoElement.removeEventListener('timeupdate', handleTimeUpdate);
      videoElement.removeEventListener('seeked', handleTimeUpdate);
    };
  }, [trimmingMergedVideoUrl, trimmingProgress.successVideos, videoResults]);
  
  // Download ZIP progress
  const [isDownloadZipModalOpen, setIsDownloadZipModalOpen] = useState(false);
  const [downloadZipProgress, setDownloadZipProgress] = useState<string>('');
  
  // Initial videos hash for smart cache (tracks original marker values from DB)
  const [initialVideosHash, setInitialVideosHash] = useState<string | null>(null);
  const [initialPairHash, setInitialPairHash] = useState<string | null>(null);
  const [lastMergedVideosHash, setLastMergedVideosHash] = useState<string | null>(() => {
    try {
      return localStorage.getItem('lastMergedVideosHash') || null;
    } catch {
      return null;
    }
  });
  
  // Step 10: Merge Videos
  const [selectedHooks, setSelectedHooks] = useState<string[]>([]);
  const [selectedBody, setSelectedBody] = useState<string | null>(null);
  const [isMergingStep10, setIsMergingStep10] = useState(false);
  const [mergeStep10Progress, setMergeStep10Progress] = useState<{
    status: 'countdown' | 'processing' | 'complete' | 'partial' | 'error';
    message: string;
    countdown?: number;
    totalFinalVideos: number;
    currentFinalVideo: number;
    currentBatch: number;
    totalBatches: number;
    // HOOKS tracking
    hooksSuccess: Array<{ name: string; videoCount: number; videoNames: string[] }>;
    hooksFailed: Array<{ name: string; error: string }>;
    hooksInProgress: Array<{ name: string }>;
    // BODY tracking
    bodySuccess: Array<{ name: string }>;
    bodyFailed: Array<{ name: string; error: string }>;
    bodyInProgress: Array<{ name: string }>;
    // Callbacks
    onSkipCountdown?: () => void;
  }>({ 
    status: 'countdown', 
    message: '',
    totalFinalVideos: 0,
    currentFinalVideo: 0,
    currentBatch: 0,
    totalBatches: 0,
    hooksSuccess: [],
    hooksFailed: [],
    hooksInProgress: [],
    bodySuccess: [],
    bodyFailed: [],
    bodyInProgress: [],
  });
  const [bodyMergedVideoUrl, setBodyMergedVideoUrl] = useState<string | null>(null);
  const [hookMergedVideos, setHookMergedVideos] = useState<Record<string, string>>({});
  
  // Step 11: Final Videos
  const [isMergingFinalVideos, setIsMergingFinalVideos] = useState(false);
  const [mergeFinalProgress, setMergeFinalProgress] = useState<{
    current: number;
    total: number;
    currentVideo: string;
    status: 'idle' | 'processing' | 'complete';
  }>({
    current: 0,
    total: 0,
    currentVideo: '',
    status: 'idle'
  });
  const [finalVideos, setFinalVideos] = useState<Array<{
    videoName: string;
    cdnUrl: string;
    hookName: string;
    bodyName: string;
  }>>([]);
  
  // Persist cache to localStorage whenever it changes
  useEffect(() => {
    if (sampleMergedVideoUrl) {
      localStorage.setItem('sampleMergedVideoUrl', sampleMergedVideoUrl);
    }
  }, [sampleMergedVideoUrl]);
  
  useEffect(() => {
    if (lastMergedVideosHash) {
      localStorage.setItem('lastMergedVideosHash', lastMergedVideosHash);
    }
  }, [lastMergedVideosHash]);
  
  // Images Library modal
  const [isImagesLibraryOpen, setIsImagesLibraryOpen] = useState(false);
  const [librarySearchQuery, setLibrarySearchQuery] = useState("");
  const [libraryCharacterFilter, setLibraryCharacterFilter] = useState<string>("all");
  const [selectedLibraryImages, setSelectedLibraryImages] = useState<number[]>([]);
  
  // Step 4: Tabs
  const [step4ActiveTab, setStep4ActiveTab] = useState<'upload' | 'library'>('library');
  
  // Step 7: Internal Notes
  const [editingNoteVideoName, setEditingNoteVideoName] = useState<string | null>(null);
  const [noteText, setNoteText] = useState<string>('');
  
  // Step 8: Filter
  const [step8Filter, setStep8Filter] = useState<'all' | 'accepted' | 'recut' | 'unlocked' | 'problems' | 'with_notes'>('all');
  
  // Step 9: Internal Notes
  const [editingStep9NoteVideoName, setEditingStep9NoteVideoName] = useState<string | null>(null);
  const [step9NoteText, setStep9NoteText] = useState<string>('');
  
  // WYSIWYG Editor for STEP 2
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [editingLineText, setEditingLineText] = useState<string>('');
  const [editingLineRedStart, setEditingLineRedStart] = useState<number>(-1);
  const [editingLineRedEnd, setEditingLineRedEnd] = useState<number>(-1);

  // Queries
  const { data: libraryImages = [] } = trpc.imageLibrary.list.useQuery({
    userId: localCurrentUser.id,
  });
  const { data: libraryCharacters = [] } = trpc.imageLibrary.getCharacters.useQuery({
    userId: localCurrentUser.id,
  });

  // Video Editing mutations (Step 8)
  const processVideoForEditingMutation = trpc.videoEditing.processVideoForEditing.useMutation();
  const extractWAVFromVideoMutation = trpc.videoEditing.extractWAVFromVideo.useMutation();
  const processAudioWithWhisperCleanVoiceMutation = trpc.videoEditing.processAudioWithWhisperCleanVoice.useMutation();
  const createDirectoryMutation = trpc.videoEditing.createDirectory.useMutation();
  const cutVideoMutation = trpc.videoEditing.cutVideo.useMutation();
  const cutAndMergeMutation = trpc.videoEditing.cutAndMergeVideos.useMutation();
  const cutAndMergeAllMutation = trpc.videoEditing.cutAndMergeAllVideos.useMutation();
  const saveVideoEditing = trpc.videoEditing.save.useMutation();
  
  // Step 10: Merge Videos mutation
  const mergeVideosMutation = trpc.videoEditing.mergeVideos.useMutation();
  
  // Prompt Library query - load all prompts from database
  const { data: promptLibrary = [] } = trpc.promptLibrary.list.useQuery({
    userId: localCurrentUser.id,
  });
  
  // Category queries
  const { data: tams = [], refetch: refetchTams } = trpc.tams.list.useQuery({
    userId: localCurrentUser.id,
  });
  const { data: coreBeliefs = [], refetch: refetchCoreBeliefs } = trpc.coreBeliefs.listByTamId.useQuery(
    { tamId: selectedTamId! },
    { enabled: !!selectedTamId }
  );
  const { data: emotionalAngles = [], refetch: refetchEmotionalAngles } = trpc.emotionalAngles.listByCoreBeliefId.useQuery(
    { coreBeliefId: selectedCoreBeliefId! },
    { enabled: !!selectedCoreBeliefId }
  );
  const { data: ads = [], refetch: refetchAds } = trpc.ads.listByEmotionalAngleId.useQuery(
    { emotionalAngleId: selectedEmotionalAngleId! },
    { enabled: !!selectedEmotionalAngleId }
  );
  const { data: categoryCharacters = [], refetch: refetchCharacters } = trpc.categoryCharacters.list.useQuery({
    userId: localCurrentUser.id,
  });

  // Get all context sessions to determine UNUSED vs USED characters
  const { data: allContextSessions = [] } = trpc.contextSessions.listByUser.useQuery({
    userId: localCurrentUser.id,
  });

  // Context session query - load workflow data for selected context
  const { data: contextSession, refetch: refetchContextSession } = trpc.contextSessions.get.useQuery(
    {
      userId: localCurrentUser.id,
      coreBeliefId: selectedCoreBeliefId!,
      emotionalAngleId: selectedEmotionalAngleId!,
      adId: selectedAdId!,
      characterId: selectedCharacterId!,
    },
    {
      enabled: !!(selectedTamId && selectedCoreBeliefId && selectedEmotionalAngleId && selectedAdId && selectedCharacterId),
    }
  );

  // Sort characters: UNUSED first, USED last
  // USED = character has generated videos (status: success/pending/failed) IN CURRENT AD
  const sortedCategoryCharacters = useMemo(() => {
    // Track which characters have generated videos IN CURRENT AD
    const charactersWithVideos = new Set<number>();
    
    // Filter sessions for current AD only
    const currentAdSessions = allContextSessions.filter(session => 
      session.adId === selectedAdId
    );
    
    currentAdSessions.forEach(session => {
      if (session.characterId && session.videoResults) {
        try {
          const videos = typeof session.videoResults === 'string' 
            ? JSON.parse(session.videoResults) 
            : session.videoResults;
          
          // Check if this session has any generated videos
          const hasGeneratedVideos = Array.isArray(videos) && videos.some(
            (v: any) => v.status === 'success' || v.status === 'pending' || v.status === 'failed'
          );
          
          if (hasGeneratedVideos) {
            charactersWithVideos.add(session.characterId);
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    });
    
    // Separate UNUSED and USED characters
    const unused = categoryCharacters.filter(char => !charactersWithVideos.has(char.id));
    const used = categoryCharacters.filter(char => charactersWithVideos.has(char.id));
    
    // Sort each group alphabetically
    unused.sort((a, b) => a.name.localeCompare(b.name));
    used.sort((a, b) => a.name.localeCompare(b.name));
    
    return { unused, used, all: [...unused, ...used] };
  }, [categoryCharacters, allContextSessions, selectedAdId]);

  // Mutations
  const parseAdMutation = trpc.video.parseAdDocument.useMutation();
  const parsePromptMutation = trpc.video.parsePromptDocument.useMutation();
  const uploadImageMutation = trpc.video.uploadImage.useMutation();
  const generateBatchMutation = trpc.video.generateBatchVideos.useMutation();
  const generateMultipleVariantsMutation = trpc.video.generateMultipleVariants.useMutation();
  
  // Category mutations
  const createTamMutation = trpc.tams.create.useMutation();
  const createCoreBeliefMutation = trpc.coreBeliefs.create.useMutation();
  const createEmotionalAngleMutation = trpc.emotionalAngles.create.useMutation();
  const createAdMutation = trpc.ads.create.useMutation();
  const createCharacterMutation = trpc.categoryCharacters.create.useMutation();
  
  // Text processing mutation
  const processTextAdMutation = trpc.video.processTextAd.useMutation();
  
  // Images Library mutation
  const uploadLibraryImageMutation = trpc.imageLibrary.upload.useMutation();
  
  // Prompt Library mutation
  const createPromptMutation = trpc.promptLibrary.create.useMutation();
  
  // Context session mutation
  const upsertContextSessionMutation = trpc.contextSessions.upsert.useMutation();
  
  // Session mutations
  const createSessionMutation = trpc.appSession.create.useMutation();
  const updateSessionMutation = trpc.appSession.update.useMutation();
  const deleteSessionMutation = trpc.appSession.delete.useMutation();
  
  // Query sessions for current user
  const { data: dbSessions, refetch: refetchSessions } = trpc.appSession.getByUserId.useQuery(
    { userId: currentUser.id },
    { enabled: true }
  );
  
  // Session management functions
  interface SavedSession {
    id: string; // Session ID (string pentru compatibilitate cu localStorage vechi)
    dbId?: number; // Database ID (pentru sesiuni salvate în database)
    name: string;
    currentStep: number;
    adLines?: AdLine[];
    prompts?: UploadedPrompt[];
    images?: UploadedImage[];
    combinations?: Combination[];
    deletedCombinations?: Combination[];
    videoResults?: VideoResult[];
    reviewHistory?: Array<{
      videoName: string;
      previousStatus: 'pending' | 'accepted' | 'regenerate' | null;
      newStatus: 'pending' | 'accepted' | 'regenerate' | null;
    }>;
    selectedVideoIndex?: number;
    regenerateMultiple?: boolean;
    regenerateVariantCount?: number;
    regenerateVariants?: Array<{
      promptType: PromptType | 'custom';
      promptText: string;
      dialogueText: string;
      imageUrl: string;
    }>;
    videoCount: number;
    timestamp: string;
  }
  
  // Update currentTime la fiecare secundă pentru "Edited X min/sec ago"
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000); // Update la fiecare secundă
    
    return () => clearInterval(interval);
  }, []);
  

  
  const getSavedSessions = (): SavedSession[] => {
    // Return sessions from database
    if (!dbSessions) return [];
    
    return dbSessions.map(session => {
      try {
        const data = JSON.parse(session.data);
        return {
          ...data,
          id: session.id.toString(), // Convert DB ID to string for compatibility
          dbId: session.id, // Store DB ID for updates/deletes
          name: session.name,
        };
      } catch (error) {
        console.error('Eroare la parse sesiune:', error);
        return {
          id: session.id.toString(),
          dbId: session.id,
          name: session.name,
          currentStep: 1,
          videoCount: 0,
          timestamp: session.createdAt?.toISOString() || new Date().toISOString(),
        };
      }
    });
  };
  
  const saveSession = async (name: string) => {
    try {
      const sessionData = {
        currentStep,
        adLines,
        prompts: prompts.map(p => ({ ...p, file: null })),
        images,
        combinations,
        deletedCombinations,
        videoResults,
        reviewHistory,
        selectedVideoIndex,
        regenerateMultiple,
        regenerateVariantCount,
        regenerateVariants,
        videoCount: videoResults.length,
        timestamp: new Date().toISOString(),
      };
      
      // Format: "{nume} - {14 Nov 2025 14:45}"
      const now = new Date();
      const formattedDate = now.toLocaleDateString('ro-RO', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
      const sessionName = `${name} - ${formattedDate}`;
      
      // Check if session exists in database
      const sessions = getSavedSessions();
      const existingSession = sessions.find(s => s.id === currentSessionId);
      
      if (existingSession && existingSession.dbId) {
        // Update existing session
        await updateSessionMutation.mutateAsync({
          sessionId: existingSession.dbId,
          name: sessionName,
          data: JSON.stringify(sessionData),
        });
      } else {
        // Create new session
        await createSessionMutation.mutateAsync({
          userId: currentUser.id,
          name: sessionName,
          data: JSON.stringify(sessionData),
        });
      }
      
      // Refetch sessions to update UI
      await refetchSessions();
      toast.success('Sesiune salvată!');
    } catch (error) {
      console.error('Eroare la salvare sesiune:', error);
      toast.error('Eroare la salvare sesiune');
    }
  };
  
  const loadSession = (sessionId: string) => {
    try {
      const sessions = getSavedSessions();
      const session = sessions.find(s => s.id === sessionId);
      
      if (!session) {
        toast.error('Sesiune negăsită');
        return;
      }
      
      // Restore state-uri
      if (session.currentStep) setCurrentStep(session.currentStep);
      if (session.adLines) setAdLines(session.adLines);
      if (session.prompts) setPrompts(session.prompts);
      if (session.images) setImages(session.images);
      if (session.combinations) setCombinations(session.combinations);
      if (session.deletedCombinations) setDeletedCombinations(session.deletedCombinations);
      if (session.videoResults) {
        setVideoResults(session.videoResults);
        
        // Set initial hash for smart cache
        const approvedVideos = session.videoResults.filter(v => 
          v.reviewStatus === 'accepted' && 
          v.status === 'success' && 
          v.videoUrl
        );
        const hash = JSON.stringify(approvedVideos.map(v => ({
          name: v.videoName,
          startMs: Math.round(v.cutPoints?.startKeep || 0),
          endMs: Math.round(v.cutPoints?.endKeep || 0),
        })));
        setInitialVideosHash(hash);
        console.log('[Cache] Initial videos hash set:', hash);
      }
      if (session.reviewHistory) setReviewHistory(session.reviewHistory);
      if (session.selectedVideoIndex !== undefined) setSelectedVideoIndex(session.selectedVideoIndex);
      if (session.regenerateMultiple !== undefined) setRegenerateMultiple(session.regenerateMultiple);
      if (session.regenerateVariantCount) setRegenerateVariantCount(session.regenerateVariantCount);
      if (session.regenerateVariants) setRegenerateVariants(session.regenerateVariants);
      
      // Actualizează currentSessionId pentru a sincroniza selector-ul
      setCurrentSessionId(sessionId);
      
      toast.success(`Sesiune "${session.name}" încărcată!`);
    } catch (error) {
      console.error('Eroare la încărcare sesiune:', error);
      toast.error('Eroare la încărcare sesiune');
    }
  };
  
  const deleteSession = async (sessionId: string) => {
    try {
      const sessions = getSavedSessions();
      const session = sessions.find(s => s.id === sessionId);
      
      if (session && session.dbId) {
        // Delete from database
        await deleteSessionMutation.mutateAsync({
          sessionId: session.dbId,
        });
        
        // Refetch sessions to update UI
        await refetchSessions();
      }
      
      // Reset la default session
      setCurrentSessionId('default');
      setCurrentStep(1);
      setAdLines([]);
      setPrompts([]);
      setImages([]);
      setCombinations([]);
      setDeletedCombinations([]);
      setVideoResults([]);
      setReviewHistory([]);
      setSelectedVideoIndex(-1);
      setRegenerateMultiple(false);
      setRegenerateVariantCount(1);
      setRegenerateVariants([]);
      
      toast.success('Sesiune ștearsă!');
    } catch (error) {
      console.error('Eroare la ștergere sesiune:', error);
      toast.error('Eroare la ștergere sesiune');
    }
  };
  
  // Load data from context session when context changes
  useEffect(() => {
    console.log('[Context Session] useEffect triggered with:', {
      contextSession: contextSession ? 'EXISTS' : 'NULL',
      selectedAdId,
      selectedEmotionalAngleId,
      selectedCharacterId,
      contextSessionIds: contextSession ? {
        adId: contextSession.adId,
        emotionalAngleId: contextSession.emotionalAngleId,
        characterId: contextSession.characterId,
      } : null,
      MATCH: contextSession ? (
        contextSession.adId === selectedAdId &&
        contextSession.emotionalAngleId === selectedEmotionalAngleId &&
        contextSession.characterId === selectedCharacterId
      ) : 'N/A',
    });
    
    if (contextSession) {
      console.log('[Context Session] Loading data from database:', contextSession);
      
      // Parse all JSON fields - ensure they're always arrays
      const parseJsonField = (field: any) => {
        if (!field) return [];
        const parsed = typeof field === 'string' ? JSON.parse(field) : field;
        return Array.isArray(parsed) ? parsed : [];
      };
      
      // Load all workflow data from context session (database)
      // ONE SOURCE OF TRUTH: Use currentStep from database (no auto-detection)
      const loadedVideoResults = parseJsonField(contextSession.videoResults);
      
      const restoredStep = contextSession.currentStep || 1;
      console.log('[Context Session] 📦 Restoring step from database:', restoredStep);
      
      setCurrentStep(restoredStep);
      // Set isRestoringSession to false AFTER a microtask to ensure currentStep is rendered first
      setTimeout(() => setIsRestoringSession(false), 0);
      if (contextSession.rawTextAd) setRawTextAd(contextSession.rawTextAd);
      if (contextSession.processedTextAd) setProcessedTextAd(contextSession.processedTextAd);
      
      setAdLines(parseJsonField(contextSession.adLines));
      setPrompts(parseJsonField(contextSession.prompts));
      setImages(parseJsonField(contextSession.images));
      setCombinations(parseJsonField(contextSession.combinations));
      setDeletedCombinations(parseJsonField(contextSession.deletedCombinations));
      
      // Only load videoResults if they are empty (first load)
      // Don't reload if videoResults already exist - this prevents overwriting manual marker changes
      // Note: loadedVideoResults already parsed above for smart step detection
      if (videoResults.length === 0) {
        console.log('[Context Session] 📥 LOADING videoResults from DB (first load)', {
          count: loadedVideoResults.length
        });
        // Log each video's cutPoints separately to avoid truncation
        loadedVideoResults.forEach(v => {
          if (v.cutPoints) {
            console.log(`  ⬅️ ${v.videoName}: start=${v.cutPoints.startKeep} end=${v.cutPoints.endKeep}`);
          }
        });
        setVideoResults(loadedVideoResults);
      } else {
        console.log('[Context Session] ⏭️ SKIPPING videoResults reload - already loaded', {
          currentCount: videoResults.length,
          dbCount: loadedVideoResults.length
        });
      }
      
      setReviewHistory(parseJsonField(contextSession.reviewHistory));
      
      // Load merged videos from database
      if (contextSession.hookMergedVideos) {
        const parsedHookMerged = typeof contextSession.hookMergedVideos === 'string' 
          ? JSON.parse(contextSession.hookMergedVideos) 
          : contextSession.hookMergedVideos;
        setHookMergedVideos(parsedHookMerged || {});
        console.log('[Context Session] 📥 Loaded hookMergedVideos:', parsedHookMerged);
      }
      
      if (contextSession.bodyMergedVideoUrl) {
        setBodyMergedVideoUrl(contextSession.bodyMergedVideoUrl);
        console.log('[Context Session] 📥 Loaded bodyMergedVideoUrl:', contextSession.bodyMergedVideoUrl);
      }
      
      console.log('[Context Session] 🔍 Checking finalVideos in DB:', contextSession.finalVideos ? 'EXISTS' : 'NULL');
      if (contextSession.finalVideos) {
        const parsedFinalVideos = typeof contextSession.finalVideos === 'string' 
          ? JSON.parse(contextSession.finalVideos) 
          : contextSession.finalVideos;
        setFinalVideos(parsedFinalVideos || []);
        console.log('[Context Session] 📥 Loaded finalVideos:', parsedFinalVideos);
      } else {
        console.log('[Context Session] ⚠️ finalVideos is NULL in database!');
      }
      
      // Update previousCharacterIdRef to track initial character
      if (selectedCharacterId) {
        previousCharacterIdRef.current = selectedCharacterId;
      }
      
      // toast.success('Context data loaded from database!'); // Hidden per user request
    } else {
      // No context session in database - reset to empty state
      console.log('[Context Session] No database session found, resetting to empty state');
      setCurrentStep(1);
      setIsRestoringSession(false);
      setRawTextAd('');
      setProcessedTextAd('');
      setAdLines([]);
      setPrompts([]);
      setImages([]);
      setCombinations([]);
      setDeletedCombinations([]);
      setVideoResults([]);
      setReviewHistory([]);
    }
  }, [contextSession]);
  
  // DISABLED: localStorage save - using database as single source of truth
  // Auto-save session la fiecare schimbare (debounced)
  useEffect(() => {
    // DISABLED: No longer saving to localStorage
    // Database is the only source of truth
    return;
  }, [
    currentStep,
    adLines,
    prompts,
    images,
    combinations,
    deletedCombinations,
    videoResults,
    reviewHistory,
    selectedVideoIndex,
    regenerateMultiple,
    regenerateVariantCount,
    regenerateVariants,
    isRestoringSession,
  ]);
  
  // AUTO-SAVE REMOVED: Explicit saves added to Next buttons and major actions
  // This eliminates race conditions when loading data from database
  
  // Auto-select first TAM when TAMs are loaded
  useEffect(() => {
    if (tams.length > 0 && !selectedTamId) {
      console.log('[Auto-select] Setting first TAM:', tams[0].name);
      setSelectedTamId(tams[0].id);
    }
  }, [tams, selectedTamId]);
  
  // Auto-select first Core Belief when Core Beliefs are loaded
  useEffect(() => {
    if (coreBeliefs.length > 0 && !selectedCoreBeliefId) {
      console.log('[Auto-select] Setting first Core Belief:', coreBeliefs[0].name);
      setSelectedCoreBeliefId(coreBeliefs[0].id);
    }
  }, [coreBeliefs, selectedCoreBeliefId]);
  
  // Auto-select first Emotional Angle when Emotional Angles are loaded
  useEffect(() => {
    if (emotionalAngles.length > 0 && !selectedEmotionalAngleId) {
      console.log('[Auto-select] Setting first Emotional Angle:', emotionalAngles[0].name);
      setSelectedEmotionalAngleId(emotionalAngles[0].id);
    }
  }, [emotionalAngles, selectedEmotionalAngleId]);
  
  // Auto-select first Ad when Ads are loaded
  useEffect(() => {
    if (ads.length > 0 && !selectedAdId) {
      console.log('[Auto-select] Setting first Ad:', ads[0].name);
      setSelectedAdId(ads[0].id);
    }
  }, [ads, selectedAdId]);
  
  // Auto-filter library images by selected character in Step 4
  useEffect(() => {
    if (currentStep === 4 && selectedCharacterId && categoryCharacters) {
      const characterName = categoryCharacters.find(c => c.id === selectedCharacterId)?.name;
      if (characterName) {
        setLibraryCharacterFilter(characterName);
        console.log('[Step 4] Auto-filtering library by character:', characterName);
      }
    }
  }, [currentStep, selectedCharacterId, categoryCharacters]);
  
  // Auto-preselect character ONLY if there's exactly ONE character with generated videos for this AD
  useEffect(() => {
    if (!selectedAdId || selectedCharacterId) return;
    
    // Find all unique characters with generated videos for this AD
    const charactersWithVideos = new Set<number>();
    
    const sessionsForAd = allContextSessions.filter(session => 
      session.adId === selectedAdId && session.characterId
    );
    
    for (const session of sessionsForAd) {
      if (session.videoResults) {
        try {
          const videos = typeof session.videoResults === 'string' 
            ? JSON.parse(session.videoResults) 
            : session.videoResults;
          
          const hasGeneratedVideos = Array.isArray(videos) && videos.some(
            (v: any) => v.status === 'success' || v.status === 'pending' || v.status === 'failed'
          );
          
          if (hasGeneratedVideos && session.characterId) {
            charactersWithVideos.add(session.characterId);
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    }
    
    // Auto-select ONLY if there's exactly ONE character with videos
    if (charactersWithVideos.size === 1) {
      const singleCharacterId = Array.from(charactersWithVideos)[0];
      console.log('[Auto-select] Setting SINGLE character with videos for AD:', singleCharacterId);
      setSelectedCharacterId(singleCharacterId);
    } else if (charactersWithVideos.size > 1) {
      console.log('[Auto-select] Multiple characters with videos found, not auto-selecting');
    } else {
      console.log('[Auto-select] No characters with videos found, leaving as "Select Character"');
    }
  }, [selectedAdId, selectedCharacterId, allContextSessions]);

  // Save all selection IDs to localStorage for persistence across refresh
  // TAM, CoreBelief, EmotionalAngle are NOT saved to localStorage
  // They are auto-selected on page load based on available data

  useEffect(() => {
    if (selectedAdId) {
      localStorage.setItem('selectedAdId', selectedAdId.toString());
    } else {
      localStorage.removeItem('selectedAdId');
    }
  }, [selectedAdId]);

  useEffect(() => {
    if (selectedCharacterId) {
      localStorage.setItem('selectedCharacterId', selectedCharacterId.toString());
    } else {
      localStorage.removeItem('selectedCharacterId');
    }
  }, [selectedCharacterId]);
  
  // Clear videoResults when Character changes (context switch)
  // This forces re-loading from database for the new context
  useEffect(() => {
    // Skip on initial mount (previousCharacterIdRef is null)
    if (previousCharacterIdRef.current === null) {
      return;
    }
    
    // If character changed, clear videoResults to force reload
    if (selectedCharacterId && selectedCharacterId !== previousCharacterIdRef.current) {
      console.log('[Context Switch] Character changed from', previousCharacterIdRef.current, 'to', selectedCharacterId, '- clearing videoResults');
      setVideoResults([]);
      setCurrentStep(1); // Reset to step 1 when switching context
    }
  }, [selectedCharacterId]);

  // Lock system removed - free navigation enabled

  // ========== COMPUTED VALUES (MEMOIZED) ==========
  // Filtered video lists (evită re-compute la fiecare render)
  const failedVideos = useMemo(
    () => videoResults.filter(v => v.status === 'failed'),
    [videoResults]
  );
  
  const acceptedVideos = useMemo(
    () => videoResults.filter(v => v.reviewStatus === 'accepted'),
    [videoResults]
  );
  
  // Step 10: Pre-select all hooks and body when entering Step 10
  useEffect(() => {
    if (currentStep === 10) {
      // Pre-select all hooks (exclude base hooks if merged version exists)
      const hookVideos = videoResults.filter(v => 
        v.trimmedVideoUrl && 
        v.videoName.toLowerCase().includes('hook')
      );
      
      // Filter out variations and base hooks that have merged versions
      const displayHooks = hookVideos.filter(v => {
        // Hide variations (HOOK3A, HOOK3B, etc.)
        const hasVariation = /HOOK\d+[A-Z]_/.test(v.videoName);
        if (hasVariation) return false;
        
        // Hide base hook if merged exists
        const isBaseHook = /HOOK\d+_/.test(v.videoName) && !/HOOK\d+[A-Z]_/.test(v.videoName);
        if (isBaseHook) {
          const baseName = v.videoName.replace(/_TEST$/, '');
          return !hookMergedVideos[baseName + '_TEST'];
        }
        
        return true;
      });
      
      // Add merged hooks
      const mergedHookNames = Object.keys(hookMergedVideos).map(baseName => 
        baseName.replace(/(HOOK\d+)/, '$1M')
      );
      
      const allHookNames = [...displayHooks.map(v => v.videoName), ...mergedHookNames];
      setSelectedHooks(allHookNames);
      
      // Pre-select body (first body video or merged body)
      if (bodyMergedVideoUrl) {
        setSelectedBody('body_merged');
      } else {
        const bodyVideos = videoResults.filter(v => 
          v.trimmedVideoUrl && 
          !v.videoName.toLowerCase().includes('hook')
        );
        if (bodyVideos.length > 0) {
          // Prioritize videos with "BODY" in name, then others
          const bodyWithName = bodyVideos.find(v => v.videoName.toLowerCase().includes('body'));
          setSelectedBody(bodyWithName ? bodyWithName.videoName : bodyVideos[0].videoName);
        }
      }
    }
  }, [currentStep, videoResults, bodyMergedVideoUrl]);
  
  // Auto-save currentStep to database whenever it changes
  useEffect(() => {
    // Skip if no context selected or user not loaded
    if (!selectedTamId || !selectedCoreBeliefId || !selectedEmotionalAngleId || !selectedAdId || !selectedCharacterId) {
      return;
    }
    if (!localCurrentUser?.id) return;
    
    // Debounce save to avoid too many DB writes
    const saveTimeout = setTimeout(async () => {
      try {
        console.log('[Auto-save] Saving currentStep to database:', currentStep);
        await upsertContextSessionMutation.mutateAsync({
          userId: localCurrentUser.id,
          tamId: selectedTamId,
          coreBeliefId: selectedCoreBeliefId,
          emotionalAngleId: selectedEmotionalAngleId,
          adId: selectedAdId,
          characterId: selectedCharacterId,
          currentStep,
          rawTextAd,
          processedTextAd,
          adLines,
          prompts,
          images,
          combinations,
          deletedCombinations,
          videoResults,
          reviewHistory,
          hookMergedVideos,
          bodyMergedVideoUrl,
          finalVideos,
        });
        console.log('[Auto-save] ✅ currentStep saved successfully');
      } catch (error) {
        console.error('[Auto-save] ❌ Failed to save currentStep:', error);
      }
    }, 0); // 0ms = instant save to prevent currentStep jumping
    
    return () => clearTimeout(saveTimeout);
  }, [currentStep, selectedTamId, selectedCoreBeliefId, selectedEmotionalAngleId, selectedAdId, selectedCharacterId, localCurrentUser, videoResults, hookMergedVideos, bodyMergedVideoUrl, finalVideos]);
  
  const regenerateVideos = useMemo(
    () => videoResults.filter(v => 
      // Include toate video cardurile cu probleme (toate în afară de Generated)
      v.reviewStatus === 'regenerate' || // Marcate pentru regenerare
      v.status === 'failed' ||            // Failed
      v.status === 'pending' ||           // În curs de generare
      v.status === null                   // Not Generated Yet (duplicate-uri)
    ),
    [videoResults]
  );
  
  const pendingVideos = useMemo(
    () => videoResults.filter(v => v.status === 'pending'),
    [videoResults]
  );
  
  const successVideos = useMemo(
    () => videoResults.filter(v => v.status === 'success'),
    [videoResults]
  );
  
  // Counter-uri (evită re-compute la fiecare render)
  const failedCount = useMemo(() => failedVideos.length, [failedVideos]);
  const acceptedCount = useMemo(() => acceptedVideos.length, [acceptedVideos]);
  const regenerateCount = useMemo(() => regenerateVideos.length, [regenerateVideos]);
  const pendingCount = useMemo(() => pendingVideos.length, [pendingVideos]);
  const successCount = useMemo(() => successVideos.length, [successVideos]);
  
  // Filtered lists pentru STEP 5 (based on step5Filter)
  const step5FilteredVideos = useMemo(() => {
    if (step5Filter === 'all') return videoResults;
    if (step5Filter === 'accepted') return acceptedVideos;
    if (step5Filter === 'regenerate') return regenerateVideos;
    return videoResults;
  }, [step5Filter, videoResults, acceptedVideos, regenerateVideos]);
  
  // Filtered lists pentru STEP 6 (based on videoFilter)
  // NOTE: videoResults added to dependencies to update UI immediately after Accept/Regenerate
  // Auto-remove is prevented by keeping filter value constant until user changes it
  const step6FilteredVideos = useMemo(() => {
    if (videoFilter === 'all') return videoResults;
    if (videoFilter === 'accepted') return acceptedVideos;
    if (videoFilter === 'failed') return failedVideos;
    if (videoFilter === 'no_decision') return videoResults.filter(v => !v.reviewStatus);
    return videoResults;
  }, [videoFilter, videoResults, acceptedVideos, failedVideos]);
  
  // Videos fără decizie (pentru statistici STEP 6)
  const videosWithoutDecision = useMemo(
    () => videoResults.filter(v => !v.reviewStatus),
    [videoResults]
  );
  const videosWithoutDecisionCount = useMemo(() => videosWithoutDecision.length, [videosWithoutDecision]);
  
  // Accepted videos cu videoUrl (pentru download)
  const acceptedVideosWithUrl = useMemo(
    () => videoResults.filter(v => v.reviewStatus === 'accepted' && v.videoUrl),
    [videoResults]
  );
  
  // ========== STEP 1: Process text ad ==========
  const processText = async () => {
    if (!rawTextAd || rawTextAd.trim().length === 0) {
      toast.error('Please enter or upload text first!');
      return;
    }

    try {
      // RESET: Clear all previous data before processing
      setAdLines([]);
      setAdDocument(null);
      setProcessedTextAd('');
      setCombinations([]);
      setVideoResults([]);
      setPrompts([]);
      setImages([]);
      setDeletedCombinations([]);
      setReviewHistory([]);
      
      // Lock system removed - no reset needed
      
      // Clear database immediately to prevent old data from being loaded
      console.log('[Process Text] Clearing database before processing new document');
      await upsertContextSessionMutation.mutateAsync({
        userId: localCurrentUser.id,
        tamId: selectedTamId,
        coreBeliefId: selectedCoreBeliefId!,
        emotionalAngleId: selectedEmotionalAngleId!,
        adId: selectedAdId!,
        characterId: selectedCharacterId!,
        currentStep: 1,
        rawTextAd,
        processedTextAd: '',
        adLines: [],
        prompts: [],
        images: [],
        combinations: [],
        deletedCombinations: [],
        videoResults: [],
        reviewHistory: [],
      });
      console.log('[Process Text] Database cleared successfully');
      
      const result = await processTextAdMutation.mutateAsync({
        rawText: rawTextAd,
      });
      
      // Convert processedLines array to string for display
      const processedText = result.processedLines
        .map((line: any) => {
          if (line.type === 'label') {
            return line.text;
          } else {
            return line.text + ` (${line.charCount} chars)`;
          }
        })
        .join('\n');
      
      setProcessedTextAd(processedText);
      
      // Convert processedLines to AdLine[] format for STEP 2
      // Keep track of current section from labels
      let currentSection: SectionType = 'OTHER';
      let lineCounter = 0;
      
      // Section-specific line counters for video naming
      const sectionCounters: Record<string, number> = {};
      
      // Label-specific line counters for multi-line suffix (B, C, D)
      const labelLineCounters: Record<string, number> = {};
      let currentLabel = '';
      
      // Track section name and line number for each label (to preserve across multiple lines)
      const labelSectionNames: Record<string, string> = {};
      const labelSectionLineNums: Record<string, string> = {};
      
      const extractedLines: AdLine[] = [];
      
      // Get context for video naming
      // Format: T{tamNum}_C{cbNum}_E{eaNum}_AD{adNum}_{SECTION}{lineNum}_{CHARACTER}
      // Use position/counter (1, 2, 3...) NOT database IDs!
      
      // Find position of selected items in their respective lists
      const tamNum = tams.findIndex(t => t.id === selectedTamId) + 1 || 1;
      const cbNum = coreBeliefs.findIndex(cb => cb.id === selectedCoreBeliefId) + 1 || 1;
      const eaNum = emotionalAngles.findIndex(ea => ea.id === selectedEmotionalAngleId) + 1 || 1;
      const adNum = ads.findIndex(ad => ad.id === selectedAdId) + 1 || 1;
      
      const characterName = selectedCharacterId ? 
        (categoryCharacters?.find(c => c.id === selectedCharacterId)?.name || 'UNKNOWN').toUpperCase() : 
        'UNKNOWN';
      
      for (const line of result.processedLines) {
        if (line.type === 'label') {
          // Backend now provides normalized category info
          const category = line.category || 'OTHER';
          const displayName = line.displayName || line.text;
          
          // Map backend category to frontend SectionType
          const categoryToSection: Record<string, SectionType> = {
            'HOOKS': 'HOOKS',
            'MIRROR': 'MIRROR',
            'DCS': 'DCS',
            'TRANZITION': 'TRANZITION',
            'NEW CAUSE': 'NEW_CAUSE',
            'NEW-CAUSE': 'NEW_CAUSE',  // Backend sends hyphenated version
            'MECHANISM': 'MECHANISM',
            'EMOTIONAL PROOF': 'EMOTIONAL_PROOF',
            'EMOTIONAL-PROOF': 'EMOTIONAL_PROOF',  // Backend sends hyphenated version
            'TRANSFORMATION': 'TRANSFORMATION',
            'CTA': 'CTA',
          };
          
          currentSection = categoryToSection[category] || 'OTHER';
          
          // Track current label for multi-line suffix
          currentLabel = displayName; // e.g., "H1", "H2", "MIRROR", "CTA"
          labelLineCounters[currentLabel] = 0; // Reset counter for this label
          
          // Add label as a marker line (will be displayed as section header)
          extractedLines.push({
            id: `label-${Date.now()}-${extractedLines.length}`,
            text: displayName, // Use normalized display name (e.g., "H1", "MIRROR", "CTA")
            section: currentSection,
            promptType: 'PROMPT_NEUTRAL' as PromptType,
            videoName: '', // Empty for labels
            categoryNumber: 0, // 0 indicates this is a label, not a content line
            charCount: 0,
          });
        } else if (line.type === 'text') {
          // Add text line under current section
          lineCounter++;
          
          // Generate video name based on section and context
          // Format: T{tamNum}_C{cbNum}_E{eaNum}_AD{adNum}_{SECTION}{lineNum}_{CHARACTER}
          
          let sectionName = '';
          let sectionLineNum = '';
          
          // Check if we already have a section name for this label (for 2nd, 3rd lines)
          if (labelSectionNames[currentLabel]) {
            // Reuse the section name and line number from first line
            sectionName = labelSectionNames[currentLabel];
            sectionLineNum = labelSectionLineNums[currentLabel];
          } else {
            // First line under this label - determine section name
            // Normalize section name: remove underscores only (keep hyphens)
            // EMOTIONAL_PROOF → EMOTIONAL-PROOF, NEW_CAUSE → NEW-CAUSE
            sectionName = currentSection.replace(/_/g, '-');
            
            // Get the label that precedes this line (to handle H1, H2, etc.)
            const precedingLabel = extractedLines.length > 0 ? extractedLines[extractedLines.length - 1] : null;
            
            // EXCEPTION: For HOOKS subcategories (H1, H2, H3, etc.) → use HOOK1, HOOK2, HOOK3
            if (currentSection === 'HOOKS' && precedingLabel && precedingLabel.categoryNumber === 0) {
              const labelText = precedingLabel.text; // e.g., "H1", "H2", "H3"
              const hookMatch = labelText.match(/^H(\d+)$/);
              if (hookMatch) {
                // H1 → HOOK1 (number already included in sectionName)
                sectionName = `HOOK${hookMatch[1]}`;
                sectionLineNum = ''; // Don't add line number for HOOKS (already in HOOK1, HOOK2, etc.)
              }
            } else {
              // For other sections, use line number under current label
              // First line of MIRROR → MIRROR1, second line → MIRROR1B (with suffix B)
              sectionLineNum = '1'; // Always 1 for first line of a label
            }
            
            // Save section name and line number for this label (for subsequent lines)
            labelSectionNames[currentLabel] = sectionName;
            labelSectionLineNums[currentLabel] = sectionLineNum;
          }
          
          // Multi-line suffix: If a label has multiple lines, add B, C, D suffix
          // Increment line counter for current label
          labelLineCounters[currentLabel]++;
          const lineNumberUnderLabel = labelLineCounters[currentLabel];
          
          // Generate suffix for 2nd, 3rd, 4th lines (B, C, D)
          let suffix = '';
          if (lineNumberUnderLabel > 1) {
            // lineNumberUnderLabel = 2 → B (66), 3 → C (67), 4 → D (68)
            suffix = String.fromCharCode(66 + lineNumberUnderLabel - 2);
          }
          
          const videoName = `T${tamNum}_C${cbNum}_E${eaNum}_AD${adNum}_${sectionName}${sectionLineNum}${suffix}_${characterName}`;
          
          // Intelligent prompt type mapping based on section
          let promptType: PromptType = 'PROMPT_NEUTRAL';
          
          if (currentSection === 'TRANSFORMATION' || currentSection === 'CTA') {
            // Check if CTA line contains "carte" keyword
            const lowerText = line.text.toLowerCase();
            const ctaKeywords = ['carte', 'cartea', 'rescrie', 'lacrimi', 'lacrami'];
            const hasCTAKeyword = ctaKeywords.some(keyword => lowerText.includes(keyword));
            
            if (currentSection === 'CTA' && hasCTAKeyword) {
              promptType = 'PROMPT_CTA';
            } else {
              promptType = 'PROMPT_SMILING';
            }
          }
          
          extractedLines.push({
            id: `line-${Date.now()}-${extractedLines.length}`,
            text: line.text,
            section: currentSection,
            promptType: promptType,
            videoName: videoName,
            categoryNumber: lineCounter,
            charCount: line.charCount || line.text.length,
            redStart: line.redStart,  // Include red text markers from backend
            redEnd: line.redEnd,
          });
        }
      }
      
      setAdLines(extractedLines);
      const contentLineCount = extractedLines.filter(l => l.categoryNumber > 0).length;
      toast.success(`Text processed successfully! ${contentLineCount} lines extracted.`);
      setCurrentStep(2);
    } catch (error: any) {
      toast.error(`Error processing text: ${error.message}`);
    }
  };

  const handleTextFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.name.endsWith('.txt')) {
        const text = await file.text();
        setRawTextAd(text);
        setUploadedFileName(file.name);
        toast.success('Text file loaded!');
      } else if (file.name.endsWith('.docx') || file.name.endsWith('.doc')) {
        try {
          const arrayBuffer = await file.arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer });
          setRawTextAd(result.value);
          setUploadedFileName(file.name);
          toast.success('Word document loaded!');
        } catch (error: any) {
          toast.error(`Error reading Word document: ${error.message}`);
        }
      } else {
        toast.error('Please upload a .txt, .doc, or .docx file.');
      }
    }
  };

  const handleTextFileDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      if (file.name.endsWith('.txt')) {
        const text = await file.text();
        setRawTextAd(text);
        setUploadedFileName(file.name);
        toast.success('Text file loaded!');
      } else if (file.name.endsWith('.docx') || file.name.endsWith('.doc')) {
        try {
          const arrayBuffer = await file.arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer });
          setRawTextAd(result.value);
          setUploadedFileName(file.name);
          toast.success('Word document loaded!');
        } catch (error: any) {
          toast.error(`Error reading Word document: ${error.message}`);
        }
      } else {
        toast.error('Please upload a .txt, .doc, or .docx file.');
      }
    }
  };

  const handleTextFileDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  // ========== STEP 2: Handle ad document upload ==========
  const handleAdDocumentDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.docx') || file.name.endsWith('.doc'))) {
      setAdDocument(file);
      await parseAdDocument(file);
    } else {
      toast.error("Te rog încarcă un document .docx");
    }
  };

  const handleAdDocumentSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAdDocument(file);
      await parseAdDocument(file);
    }
  };

  const parseAdDocument = async (file: File) => {
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        const result = await parseAdMutation.mutateAsync({ documentData: base64 });
        
        const lines: AdLine[] = result.lines.map((line: any, index: number) => ({
          id: `line-${index}`,
          text: line.text,
          section: line.section,
          promptType: line.promptType,
          videoName: line.videoName,
          categoryNumber: line.categoryNumber,
          charCount: line.text.length,
        }));
        
        setAdLines(lines);
        toast.success(`${lines.length} linii extrase din document`);
      };
      reader.readAsDataURL(file);
    } catch (error: any) {
      toast.error(`Eroare la parsarea documentului: ${error.message}`);
    }
  };

  // Step 2: Handle prompt documents upload (3 prompts)
  const handlePromptDocumentDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    await uploadPrompts(files);
  };

  const handlePromptDocumentSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    await uploadPrompts(files);
  };

  const uploadPrompts = async (files: File[]) => {
    const docFiles = files.filter(file => file.name.endsWith('.docx') || file.name.endsWith('.doc'));
    
    for (const file of docFiles) {
      try {
        const reader = new FileReader();
        reader.onload = async (event) => {
          const base64 = event.target?.result as string;
          const result = await parsePromptMutation.mutateAsync({ documentData: base64 });
          
          const newPrompt: UploadedPrompt = {
            id: `prompt-${Date.now()}-${Math.random()}`,
            name: file.name.replace(/\.(docx|doc)$/i, ''),
            template: result.promptTemplate,
            file: file,
          };
          
          setPrompts(prev => [...prev, newPrompt]);
          toast.success(`Prompt "${newPrompt.name}" încărcat`);
        };
        reader.readAsDataURL(file);
      } catch (error: any) {
        toast.error(`Eroare la parsarea promptului ${file.name}: ${error.message}`);
      }
    }
  };

  const removePrompt = (id: string) => {
    setPrompts(prev => prev.filter(p => p.id !== id));
  };

  // Step 3: Handle image upload
  const handleImageDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    await uploadImages(files);
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    await uploadImages(files);
  };

  const uploadImages = async (files: File[]) => {
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length === 0) {
      toast.error('Niciun fișier imagine valid selectat');
      return;
    }
    
    // Validate character selection
    if (!selectedCharacterId) {
      toast.error('Te rog selectează un caracter înainte de a încărca imagini');
      return;
    }
    
    // Check for duplicates in library
    const characterName = selectedCharacterId ? 
      (categoryCharacters?.find(c => c.id === selectedCharacterId)?.name || 'Unnamed') : 
      'Unnamed';
    
    const duplicates: string[] = [];
    for (const file of imageFiles) {
      const imageName = file.name.replace(/\.[^/.]+$/, ''); // Remove extension
      const existing = libraryImages.find(
        img => img.imageName === imageName && img.characterName === characterName
      );
      if (existing) {
        duplicates.push(file.name);
      }
    }
    
    if (duplicates.length > 0) {
      toast.error(`Imaginile următoare există deja în library pentru ${characterName}: ${duplicates.join(', ')}`);
      return;
    }
    
    try {
      setUploadingFiles(imageFiles);
      setUploadProgress(0);
      
      const uploadPromises = imageFiles.map(async (file, index) => {
        return new Promise<UploadedImage>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = async (event) => {
            try {
              const base64 = event.target?.result as string;
              const result = await uploadImageMutation.mutateAsync({
                imageData: base64,
                fileName: file.name,
                userId: currentUser.id, // Transmitere userId pentru organizare per user
                sessionId: currentSessionId, // Transmitere sessionId pentru organizare per sesiune
              });
              
              const isCTA = file.name.toUpperCase().includes('CTA');
              
              const newImage: UploadedImage = {
                id: `img-${Date.now()}-${Math.random()}`,
                url: result.imageUrl,
                file: file,
                fileName: file.name,
                isCTA: isCTA,
              };
              
              // Auto-save to Images Library
              try {
                await uploadLibraryImageMutation.mutateAsync({
                  userId: currentUser.id,
                  characterName: selectedCharacterId ? 
                    (categoryCharacters?.find(c => c.id === selectedCharacterId)?.name || 'Unnamed') : 
                    'Unnamed',
                  imageName: file.name.replace(/\.[^/.]+$/, ''), // Remove extension
                  imageData: base64,
                });
                console.log('[Auto-save] Image saved to library:', file.name);
              } catch (libError) {
                console.error('[Auto-save] Failed to save to library:', libError);
                // Don't fail the upload if library save fails
              }
              
              resolve(newImage);
            } catch (error: any) {
              reject(error);
            }
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      });
      
      const uploadedImages = await Promise.all(uploadPromises);
      const sortedImages = sortImagesByPairs(uploadedImages);
      setImages(prev => [...prev, ...sortedImages]);
      setUploadingFiles([]);
      setUploadProgress(0);
      toast.success(`${uploadedImages.length} imagini încărcate`);
    } catch (error: any) {
      setUploadingFiles([]);
      setUploadProgress(0);
      toast.error(`Eroare la încărcarea imaginilor: ${error.message}`);
    }
  };
  
  // Funcție pentru ordonare poze în perechi: normale + CTA
  const sortImagesByPairs = (images: UploadedImage[]): UploadedImage[] => {
    const pairs: Record<string, { normal?: UploadedImage; cta?: UploadedImage }> = {};
    
    // Grupează după prefix (numele fără CTA)
    images.forEach(img => {
      const prefix = img.fileName.replace(/CTA/gi, '').replace(/[_-]$/,'').trim();
      
      if (!pairs[prefix]) {
        pairs[prefix] = {};
      }
      
      if (img.isCTA) {
        pairs[prefix].cta = img;
      } else {
        pairs[prefix].normal = img;
      }
    });
    
    // Construiește lista ordonată: normal, CTA, normal, CTA...
    const sorted: UploadedImage[] = [];
    Object.values(pairs).forEach(pair => {
      if (pair.normal) sorted.push(pair.normal);
      if (pair.cta) sorted.push(pair.cta);
    });
    
    return sorted;
  };

  const removeImage = (id: string) => {
    setImages(prev => prev.filter(img => img.id !== id));
  };
  // Step 8: Batch process videos with FFmpeg batch (10 per batch, 61s pause) + Whisper + CleanVoice
  const batchProcessVideosWithWhisper = async (videos: VideoResult[]) => {
  const batchStartTime = Date.now();
  console.log('[Batch Processing] ⏱️ BATCH START at', new Date().toISOString());
  console.log('[Batch Processing] 🚀 Starting FFmpeg batch processing with', videos.length, 'videos');
  
  const BATCH_SIZE = 10;
  const DELAY_BETWEEN_BATCHES = 61000; // 61 seconds
  
  // Calculate total batches
  const totalBatches = Math.ceil(videos.length / BATCH_SIZE);
  
  // Calculate estimated time
  const estimatedSeconds = 30 + ((totalBatches - 1) * (61 + 30));
  const estimatedMinutes = Math.ceil(estimatedSeconds / 60);
  
  // Initialize progress with SEPARATE counters
  setProcessingProgress({
    ffmpeg: { current: 0, total: videos.length, status: 'processing', activeVideos: [] },
    whisper: { current: 0, total: videos.length, status: 'idle', activeVideos: [] },
    cleanvoice: { current: 0, total: videos.length, status: 'idle', activeVideos: [] },
    currentVideoName: '',
    countdown: 0,
    estimatedMinutes,
    successVideos: [],
    failedVideos: [],
    ffmpegSuccess: [],
    ffmpegFailed: [],
    whisperSuccess: [],
    whisperFailed: [],
    cleanvoiceSuccess: [],
    cleanvoiceFailed: []
  });
  
  // Track results
  const resultsMap = new Map<string, any>();
  const failedVideos: Array<{ videoName: string; error: string; step: 'ffmpeg' | 'whisper' | 'cleanvoice' }> = [];
  
  // Collect all Whisper+CleanVoice promises to wait for at the end
  const allAudioProcessingPromises: Promise<void>[] = [];
  
  // Process videos in batches for FFmpeg
  let currentIndex = 0;
  let batchNumber = 1;
  
  while (currentIndex < videos.length) {
    const batchEnd = Math.min(currentIndex + BATCH_SIZE, videos.length);
    const batchVideos = videos.slice(currentIndex, batchEnd);
    
    console.log(`[Batch Processing] 📦 FFmpeg Batch ${batchNumber}/${totalBatches}: Processing ${batchVideos.length} videos (${currentIndex + 1}-${batchEnd})...`);
    
    setProcessingProgress(prev => ({
      ...prev,
      currentVideoName: `📦 Batch ${batchNumber}/${totalBatches}: Processing ${batchVideos.length} videos...`
    }));
    
    // STEP 1: FFmpeg batch - Extract WAV from all videos in this batch (PARALLEL)
    const ffmpegPromises = batchVideos.map(async (video) => {
      try {
        // SMART SKIP: Check if FFmpeg already done (video has audioUrl)
        if (video.audioUrl && video.waveformData) {
          console.log(`[Batch Processing] ⏭️ FFmpeg SKIP for ${video.videoName} (audioUrl exists)`);
          
          setProcessingProgress(prev => ({
            ...prev,
            ffmpeg: {
              current: prev.ffmpeg.current + 1,
              total: videos.length,
              status: prev.ffmpeg.current + 1 === videos.length ? 'complete' : 'processing',
              activeVideos: prev.ffmpeg.activeVideos
            },
            ffmpegSuccess: [...prev.ffmpegSuccess, video.videoName]
          }));
          
          return {
            video,
            wavUrl: video.audioUrl,  // Use existing WAV
            waveformJson: video.waveformData,  // Use existing waveform
            success: true,
            skipped: true,
          };
        }
        
        console.log(`[Batch Processing] 🎬 FFmpeg START for ${video.videoName}`);
        
        setProcessingProgress(prev => ({
          ...prev,
          ffmpeg: {
            ...prev.ffmpeg,
            status: 'processing',
            activeVideos: [...prev.ffmpeg.activeVideos, video.videoName]
          }
        }));
        
        const wavResult = await extractWAVFromVideoMutation.mutateAsync({
          videoUrl: video.videoUrl!,
          videoId: parseInt(video.id || '0'),
          videoName: video.videoName,
          ffmpegApiKey: localCurrentUser.ffmpegApiKey || '',
          userId: localCurrentUser.id,
        });
        
        console.log(`[Batch Processing] ✅ FFmpeg SUCCESS for ${video.videoName}`);
        
        setProcessingProgress(prev => ({
          ...prev,
          ffmpeg: {
            current: prev.ffmpeg.current + 1,
            total: videos.length,
            status: prev.ffmpeg.current + 1 === videos.length ? 'complete' : 'processing',
            activeVideos: prev.ffmpeg.activeVideos.filter(v => v !== video.videoName)
          },
          ffmpegSuccess: [...prev.ffmpegSuccess, video.videoName]
        }));
        
        return {
          video,
          wavUrl: wavResult.wavUrl,
          waveformJson: wavResult.waveformJson,
          success: true,
        };
      } catch (error: any) {
        console.error(`[Batch Processing] ❌ FFmpeg FAILED for ${video.videoName}:`, error);
        
        setProcessingProgress(prev => ({
          ...prev,
          ffmpeg: {
            current: prev.ffmpeg.current + 1,
            total: videos.length,
            status: 'processing',
            activeVideos: prev.ffmpeg.activeVideos.filter(v => v !== video.videoName)
          },
          ffmpegFailed: [...prev.ffmpegFailed, { videoName: video.videoName, error: error.message }],
          failedVideos: [...prev.failedVideos, { videoName: video.videoName, error: `FFmpeg: ${error.message}` }]
        }));
        
        failedVideos.push({ videoName: video.videoName, error: error.message, step: 'ffmpeg' });
        
        return {
          video,
          success: false,
          error: error.message,
        };
      }
    });
    
    const ffmpegResults = await Promise.all(ffmpegPromises);
    
    console.log(`[Batch Processing] ✅ FFmpeg Batch ${batchNumber} complete!`);
    
    // SAVE TO DB after FFmpeg batch
    try {
      const updatedVideosAfterFFmpeg = videos.map(video => {
        const result = ffmpegResults.find(r => r.video.videoName === video.videoName);
        if (!result || !result.success) return video;
        
        return {
          ...video,
          audioUrl: result.wavUrl,
          waveformData: result.waveformJson,
        };
      });
      
      await upsertContextSessionMutation.mutateAsync({
        userId: localCurrentUser.id,
        sessionId: contextSessionId,
        videoResults: updatedVideosAfterFFmpeg,
      });
      
      console.log(`[Batch Processing] 💾 DB saved after FFmpeg batch ${batchNumber}`);
    } catch (error) {
      console.error(`[Batch Processing] ❌ Failed to save to DB after FFmpeg batch ${batchNumber}:`, error);
    }
    
    // STEP 2: Start Whisper+CleanVoice for successful FFmpeg results (NO LIMIT, PARALLEL)
    const audioProcessingPromises = ffmpegResults
      .filter(r => r.success)
      .map(async (ffmpegResult) => {
        const { video, wavUrl, waveformJson } = ffmpegResult;
        
        try {
          console.log(`[Batch Processing] 🎵 Whisper+CleanVoice START for ${video.videoName}`);
          
          setProcessingProgress(prev => ({
            ...prev,
            whisper: {
              ...prev.whisper,
              status: 'processing',
              activeVideos: [...prev.whisper.activeVideos, video.videoName]
            },
            cleanvoice: {
              ...prev.cleanvoice,
              status: 'processing',
              activeVideos: [...prev.cleanvoice.activeVideos, video.videoName]
            }
          }));
          
          const hasRedText = video.redStart !== undefined && 
                            video.redEnd !== undefined && 
                            video.redStart >= 0 && 
                            video.redEnd > video.redStart;
          
          const redText = hasRedText
            ? video.text.substring(video.redStart, video.redEnd)
            : '';
          
          const textLength = video.text.length;
          const redTextPosition: 'START' | 'END' | undefined = hasRedText
            ? ((video.redEnd || 0) >= textLength - 10 ? 'END' : 'START')
            : undefined;
          
          const audioResult = await processAudioWithWhisperCleanVoiceMutation.mutateAsync({
            wavUrl: wavUrl!,
            videoId: parseInt(video.id || '0'),
            videoName: video.videoName,
            fullText: video.text,
            redText: redText,
            redTextPosition: redTextPosition,
            marginMs: 50,
            userApiKey: localCurrentUser.openaiApiKey || undefined,
            cleanvoiceApiKey: localCurrentUser.cleanvoiceApiKey || undefined,
            userId: localCurrentUser.id,
          });
          
          console.log(`[Batch Processing] ✅ Whisper+CleanVoice SUCCESS for ${video.videoName}`);
          
          setProcessingProgress(prev => ({
            ...prev,
            whisper: {
              current: prev.whisper.current + 1,
              total: videos.length,
              status: prev.whisper.current + 1 === videos.length ? 'complete' : 'processing',
              activeVideos: prev.whisper.activeVideos.filter(v => v !== video.videoName)
            },
            cleanvoice: {
              current: prev.cleanvoice.current + 1,
              total: videos.length,
              status: prev.cleanvoice.current + 1 === videos.length ? 'complete' : 'processing',
              activeVideos: prev.cleanvoice.activeVideos.filter(v => v !== video.videoName)
            },
            whisperSuccess: [...prev.whisperSuccess, video.videoName],
            cleanvoiceSuccess: [...prev.cleanvoiceSuccess, video.videoName],
            successVideos: [...prev.successVideos, video.videoName]
          }));
          
          resultsMap.set(video.videoName, {
            videoName: video.videoName,
            success: true,
            result: {
              whisperTranscript: audioResult.whisperTranscript,
              cutPoints: audioResult.cutPoints,
              words: audioResult.words,
              audioUrl: wavUrl,
              waveformData: waveformJson,
              editingDebugInfo: audioResult.editingDebugInfo,
              cleanvoiceAudioUrl: audioResult.cleanvoiceAudioUrl,
              noCutNeeded: false,
            }
          });
          
        } catch (error: any) {
          console.error(`[Batch Processing] ❌ Whisper+CleanVoice FAILED for ${video.videoName}:`, error);
          
          // Parse error to determine which phase failed
          const errorMsg = error.message || String(error);
          const isCleanVoiceError = errorMsg.includes('CleanVoice failed');
          const isWhisperError = errorMsg.includes('Whisper failed');
          
          setProcessingProgress(prev => ({
            ...prev,
            whisper: {
              current: prev.whisper.current + 1,
              total: videos.length,
              status: 'processing',
              activeVideos: prev.whisper.activeVideos.filter(v => v !== video.videoName)
            },
            cleanvoice: {
              current: prev.cleanvoice.current + 1,
              total: videos.length,
              status: 'processing',
              activeVideos: prev.cleanvoice.activeVideos.filter(v => v !== video.videoName)
            },
            // Only add to the specific failed array based on error message
            whisperFailed: isWhisperError || (!isCleanVoiceError && !isWhisperError) 
              ? [...prev.whisperFailed, { videoName: video.videoName, error: error.message }]
              : prev.whisperFailed,
            cleanvoiceFailed: isCleanVoiceError || (!isCleanVoiceError && !isWhisperError)
              ? [...prev.cleanvoiceFailed, { videoName: video.videoName, error: error.message }]
              : prev.cleanvoiceFailed,
            failedVideos: [...prev.failedVideos, { videoName: video.videoName, error: `Whisper/CleanVoice: ${error.message}` }]
          }));
          
          failedVideos.push({ videoName: video.videoName, error: error.message, step: 'whisper' });
          
          resultsMap.set(video.videoName, {
            videoName: video.videoName,
            success: false,
            error: error.message,
          });
        }
      });
    
    // Collect all audio processing promises (don't wait yet)
    allAudioProcessingPromises.push(...audioProcessingPromises);
    
    // Move to next batch
    currentIndex = batchEnd;
    batchNumber++;
    
    // Wait 61s before next FFmpeg batch (if there are more videos)
    if (currentIndex < videos.length) {
      console.log(`[Batch Processing] ⏳ Waiting 61 seconds before FFmpeg batch ${batchNumber}...`);
      
      for (let countdown = 61; countdown > 0; countdown--) {
        setProcessingProgress(prev => ({
          ...prev,
          countdown,
          currentVideoName: `⏳ FFmpeg rate limit: waiting ${countdown}s before batch ${batchNumber}/${totalBatches}...`
        }));
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      setProcessingProgress(prev => ({
        ...prev,
        countdown: 0
      }));
    }
  }
  
  console.log('[Batch Processing] 🎉 All FFmpeg batches processed! Waiting for Whisper+CleanVoice to finish...');
  
  setProcessingProgress(prev => ({
    ...prev,
    currentVideoName: '⏳ Waiting for Whisper + CleanVoice to finish...'
  }));
  
  // Wait for ALL Whisper+CleanVoice processing to complete
  await Promise.all(allAudioProcessingPromises);
  
  console.log('[Batch Processing] 🎉 All Whisper+CleanVoice processing complete!');
  
  // SAVE TO DB after all Whisper+CleanVoice
  const updatedResults = videos.map(video => {
    const result = resultsMap.get(video.videoName);
    if (!result || !result.success) {
      return { ...video, status: 'failed' as const };
    }
    
    return {
      ...video,
      status: 'success' as const,
      audioUrl: result.result.audioUrl,
      waveformData: result.result.waveformData,
      cutPoints: result.result.cutPoints,
      isStartLocked: true,
      isEndLocked: true,
      whisperTranscript: result.result.whisperTranscript,
      editingDebugInfo: result.result.editingDebugInfo,
      cleanvoiceAudioUrl: result.result.cleanvoiceAudioUrl,
    };
  });
  
  // Capture new state before database save
  const currentVideoResults = await new Promise<typeof videoResults>((resolve) => {
    setVideoResults(prev => {
      const newResults = [...prev];
      updatedResults.forEach(updated => {
        const index = newResults.findIndex(v => v.videoName === updated.videoName);
        if (index !== -1) {
          newResults[index] = updated;
        }
      });
      resolve(newResults);
      return newResults;
    });
  });
  
  try {
    await upsertContextSessionMutation.mutateAsync({
      userId: localCurrentUser.id,
      sessionId: contextSessionId,
      videoResults: currentVideoResults,
    });
    console.log('[Batch Processing] 💾 Final DB save complete');
  } catch (error) {
    console.error('[Batch Processing] ❌ Failed to save final results to database:', error);
  }
  
  const batchDuration = Date.now() - batchStartTime;
  const successCount = videos.length - failedVideos.length;
  
  console.log(`[Batch Processing] ⏱️ BATCH COMPLETE in ${batchDuration}ms (${(batchDuration/1000).toFixed(2)}s)`);
  console.log(`[Batch Processing] 📊 Success: ${successCount}, Failed: ${failedVideos.length}`);
  
  setProcessingProgress(prev => ({
    ...prev,
    ffmpeg: { ...prev.ffmpeg, status: 'complete' },
    whisper: { ...prev.whisper, status: 'complete' },
    cleanvoice: { ...prev.cleanvoice, status: 'complete' },
    currentVideoName: successCount === videos.length 
      ? '✅ All videos processed successfully!' 
      : `✅ Complete: ${successCount} success, ${failedVideos.length} failed`,
    countdown: 0,
    estimatedMinutes: 0
  }));
  
  if (failedVideos.length > 0) {
    toast.warning(`⚠️ Processing complete: ${successCount} success, ${failedVideos.length} failed`);
  } else {
    toast.success(`✅ All ${successCount} videos processed successfully!`);
  }
  
  return resultsMap;
};

  // Retry failed merge groups
  const handleRetryFailedMerges = async () => {
    const failedResults = mergeStep10Progress.results?.filter(r => r.status === 'failed') || [];
    
    if (failedResults.length === 0) {
      toast.info('No failed merges to retry');
      return;
    }
    
    console.log('[Merge Retry] 🔄 Retrying', failedResults.length, 'failed groups...');
    
    // Mark all failed as retrying
    setMergeStep10Progress(prev => ({
      ...prev,
      status: 'processing',
      message: `Retrying ${failedResults.length} failed groups...`,
      results: prev.results?.map(r => 
        r.status === 'failed' 
          ? { ...r, status: 'retrying' as any, error: undefined }
          : r
      )
    }));
    
    const trimmedVideos = videoResults.filter(v => 
      v.reviewStatus === 'accepted' && 
      v.status === 'success' && 
      v.trimmedVideoUrl &&
      v.recutStatus === 'accepted'
    );
    
    for (const failedResult of failedResults) {
      console.log(`[Merge Retry] 🔄 Retrying ${failedResult.name}...`);
      
      setMergeStep10Progress(prev => ({
        ...prev,
        message: `Retrying ${failedResult.name}...`
      }));
      
      try {
        if (failedResult.type === 'hook') {
          // Find hook group videos
          const hookVideos = trimmedVideos.filter(v => {
            const hookMatch = v.videoName.match(/(.*)(HOOK\d+)[A-Z]?(.*)/);
            if (hookMatch) {
              const prefix = hookMatch[1];
              const hookBase = hookMatch[2];
              const suffix = hookMatch[3];
              const groupKey = `${prefix}${hookBase}${suffix}`;
              return groupKey === failedResult.name;
            }
            return false;
          });
          
          if (hookVideos.length === 0) {
            throw new Error('Hook videos not found');
          }
          
          const sortedVideos = hookVideos.sort((a, b) => a.videoName.localeCompare(b.videoName));
          const videoUrls = sortedVideos.map(v => v.trimmedVideoUrl!).filter(Boolean);
          const outputName = failedResult.name.replace(/(HOOK\d+)/, '$1M');
          
          const result = await mergeVideosMutation.mutateAsync({
            videoUrls,
            outputVideoName: outputName,
            ffmpegApiKey: localCurrentUser.ffmpegApiKey || '',
            userId: localCurrentUser.id,
          });
          
          console.log(`[Merge Retry] ✅ ${failedResult.name} SUCCESS:`, result.cdnUrl);
          
          // Update result to success
          setMergeStep10Progress(prev => ({
            ...prev,
            results: prev.results?.map(r =>
              r.name === failedResult.name
                ? { ...r, status: 'success', cdnUrl: result.cdnUrl, error: undefined }
                : r
            )
          }));
          
          setHookMergedVideos(prev => ({ ...prev, [failedResult.name]: result.cdnUrl }));
          
        } else if (failedResult.type === 'body') {
          // Find body videos
          const bodyVideos = trimmedVideos.filter(v => !v.videoName.match(/HOOK\d+[A-Z]?/));
          
          if (bodyVideos.length === 0) {
            throw new Error('Body videos not found');
          }
          
          const bodyVideoUrls = bodyVideos.map(v => v.trimmedVideoUrl!).filter(Boolean);
          const firstVideoName = bodyVideos[0].videoName;
          const contextMatch = firstVideoName.match(/^(T\d+_C\d+_E\d+_AD\d+)/);
          const context = contextMatch ? contextMatch[1] : 'MERGED';
          const characterMatch = firstVideoName.match(/_([^_]+)$/);
          const characterName = characterMatch ? characterMatch[1] : 'TEST';
          const outputName = `${context}_BODY_${characterName}`;
          
          const result = await mergeVideosMutation.mutateAsync({
            videoUrls: bodyVideoUrls,
            outputVideoName: outputName,
            ffmpegApiKey: localCurrentUser.ffmpegApiKey || '',
            userId: localCurrentUser.id,
          });
          
          console.log('[Merge Retry] ✅ BODY SUCCESS:', result.cdnUrl);
          
          setMergeStep10Progress(prev => ({
            ...prev,
            results: prev.results?.map(r =>
              r.name === 'BODY'
                ? { ...r, status: 'success', cdnUrl: result.cdnUrl, error: undefined }
                : r
            )
          }));
          
          setBodyMergedVideoUrl(result.cdnUrl);
        }
        
      } catch (error: any) {
        console.error(`[Merge Retry] ❌ ${failedResult.name} FAILED AGAIN:`, error);
        
        setMergeStep10Progress(prev => ({
          ...prev,
          results: prev.results?.map(r =>
            r.name === failedResult.name
              ? { ...r, status: 'failed', error: error.message }
              : r
          )
        }));
      }
    }
    
    // Final status update
    const finalResults = mergeStep10Progress.results || [];
    const successCount = finalResults.filter(r => r.status === 'success').length;
    const failCount = finalResults.filter(r => r.status === 'failed').length;
    
    setMergeStep10Progress(prev => ({
      ...prev,
      status: failCount > 0 ? 'partial' : 'complete',
      message: failCount > 0 
        ? `⚠️ ${successCount} succeeded, ${failCount} failed`
        : `✅ All merges complete!`
    }));
    
    if (failCount === 0) {
      toast.success(`✅ All retries succeeded!`);
    } else {
      toast.warning(`⚠️ ${successCount} succeeded, ${failCount} still failed`);
    }
  };
  
  // Sample Merge ALL Videos - with 65-second cooldown timer in popup
  const handleSampleMerge = async (videosToMerge: typeof videoResults) => {
    // Prevent multiple simultaneous merges
    if (sampleMergeProgress && sampleMergeProgress !== '') {
      console.log('[Sample Merge] ⚠️ Merge already in progress, ignoring click');
      return;
    }
    
    // Reset cancel flag
    cancelSampleMergeRef.current = false;
    
    console.log('[Sample Merge] 🚀 Starting Sample Merge...');
    
    // Prepare video list with notes
    const videoList = videosToMerge.map(v => ({
      name: v.videoName,
      note: v.step9Note || ''
    }));
    
    setSampleMergeVideos(videoList);
    
    // ALWAYS clear old video BEFORE opening popup
    setSampleMergedVideoUrl(null);
    setSampleMergeProgress('');
    
    setIsSampleMergeModalOpen(true);
    
    // Check cooldown (58 seconds)
    const now = Date.now();
    let remainingSeconds = 0;
    
    if (lastSampleMergeTimestamp) {
      const elapsed = now - lastSampleMergeTimestamp;
      const cooldownMs = 58000; // 58 seconds
      
      if (elapsed < cooldownMs) {
        const remainingMs = cooldownMs - elapsed;
        remainingSeconds = Math.ceil(remainingMs / 1000);
        console.log(`[Sample Merge] Cooldown active! ${remainingSeconds}s remaining`);
      }
    }
    
    // If cooldown active, show countdown in popup
    if (remainingSeconds > 0) {
      setSampleMergeCountdown(remainingSeconds);
      setSampleMergeProgress(`⏳ Waiting ${remainingSeconds}s before merge (FFmpeg rate limit)...`);
      
      // Wait for countdown to finish
      for (let countdown = remainingSeconds; countdown > 0; countdown--) {
        // Check if merge was cancelled
        if (cancelSampleMergeRef.current) {
          console.log('[Sample Merge] ⚠️ Merge cancelled by user');
          setSampleMergeCountdown(0);
          setSampleMergeProgress('');
          return;
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        setSampleMergeCountdown(countdown - 1);
        setSampleMergeProgress(`⏳ Waiting ${countdown - 1}s before merge...`);
      }
    }
    
    // Save timestamp for next cooldown
    setLastSampleMergeTimestamp(Date.now());
    setSampleMergeCountdown(0);
    
    // Always clear cached video and re-merge (user explicitly clicked button)
    console.log('[Sample Merge] 🔄 User clicked button, re-merging...');
    
    setSampleMergedVideoUrl(null);
    setSampleMergeProgress('Preparing videos...');
    
    try {
      // Extract original URLs
      const extractOriginalUrl = (url: string) => {
        if (url.startsWith('/api/proxy-video?url=')) {
          const urlParam = new URLSearchParams(url.split('?')[1]).get('url');
          return urlParam ? decodeURIComponent(urlParam) : url;
        }
        return url;
      };
      
      const videos = videosToMerge.map(v => ({
        url: extractOriginalUrl(v.trimmedVideoUrl || v.videoUrl),  // Use trimmed video if available
        name: v.videoName,
        startMs: 0,  // No CUT - merge full videos
        endMs: 0,    // No CUT - merge full videos
      }));
      
      console.log('[Sample Merge] Videos:', videos);
      setSampleMergeProgress(`Uploading ${videos.length} videos to FFmpeg API...`);
      
      const result = await cutAndMergeAllMutation.mutateAsync({
        videos,
        ffmpegApiKey: localCurrentUser.ffmpegApiKey || '',
      });
      
      console.log('[Sample Merge] Success!', result);
      setSampleMergedVideoUrl(result.downloadUrl);
      setLastSampleVideoUrl(result.downloadUrl); // Save for "Open Last Sample" link
      const currentHash = JSON.stringify(videosToMerge.map(v => ({
        name: v.videoName,
        startMs: Math.round(v.cutPoints?.startKeep || 0),
        endMs: Math.round(v.cutPoints?.endKeep || 0),
      })));
      setLastMergedVideosHash(currentHash);
      setSampleMergeProgress('');
      toast.success('✅ Sample merge complete!');
    } catch (error: any) {
      console.error('[Sample Merge] Error:', error);
      setSampleMergeProgress(`Error: ${error.message}`);
      toast.error(`Sample merge failed: ${error.message}`);
    }
  };
  
  // Step 10 → Step 11: Merge final videos (hooks + body combinations)
  const handleMergeFinalVideos = async () => {
    console.log('[Step 10→Step 11] Starting final merge process...');
    
    if (selectedHooks.length === 0 || !selectedBody) {
      toast.error('Please select at least one hook and one body video!');
      return;
    }
    
    // Get body URL
    let bodyUrl: string | null = null;
    if (selectedBody === 'body_merged') {
      bodyUrl = bodyMergedVideoUrl;
    } else {
      const bodyVideo = videoResults.find(v => v.videoName === selectedBody);
      bodyUrl = bodyVideo?.trimmedVideoUrl || null;
      console.log('[Step 10→Step 11] Body video:', selectedBody, 'trimmedVideoUrl:', bodyUrl);
    }
    
    if (!bodyUrl) {
      toast.error('Body video URL not found!');
      return;
    }
    
    // Get hook URLs
    const hookUrls: Array<{ name: string; url: string; hookNumber: string }> = [];
    
    for (const hookName of selectedHooks) {
      console.log(`[Step 10→Step 11] 🔍 Processing hook: ${hookName}`);
      let hookUrl: string | null = null;
      
      // Check if this is a merged hook
      const baseName = Object.keys(hookMergedVideos).find(bn => {
        const mergedName = bn.replace(/(HOOK\d+)/, '$1M');
        console.log(`  🔸 Checking merged: ${bn} → ${mergedName} === ${hookName}? ${hookName === mergedName}`);
        return hookName === mergedName;
      });
      
      if (baseName) {
        hookUrl = hookMergedVideos[baseName];
        console.log(`  ✅ Found in hookMergedVideos[${baseName}]: ${hookUrl}`);
      } else {
        const hookVideo = videoResults.find(v => v.videoName === hookName);
        hookUrl = hookVideo?.trimmedVideoUrl || null;
        console.log(`  🔸 Searching in videoResults for ${hookName}:`, hookVideo ? `FOUND (trimmedVideoUrl: ${hookUrl})` : 'NOT FOUND');
      }
      
      if (hookUrl) {
        const hookMatch = hookName.match(/HOOK(\d+)[A-Z]?/);
        const hookNumber = hookMatch ? hookMatch[1] : '1';
        hookUrls.push({ name: hookName, url: hookUrl, hookNumber });
        console.log(`  ✅ Added to hookUrls: ${hookName} (HOOK${hookNumber})`);
      } else {
        console.log(`  ❌ SKIPPED ${hookName} - no URL found!`);
      }
    }
    
    console.log('[Step 10→Step 11] 🎯 hookUrls array:', hookUrls);
    console.log('[Step 10→Step 11] 📊 selectedHooks:', selectedHooks);
    console.log('[Step 10→Step 11] 📊 hookMergedVideos:', hookMergedVideos);
    
    if (hookUrls.length === 0) {
      toast.error('No valid hook URLs found!');
      return;
    }
    
    // Extract context and character
    const referenceVideo = selectedBody === 'body_merged' 
      ? videoResults.find(v => !v.videoName.toLowerCase().includes('hook'))
      : videoResults.find(v => v.videoName === selectedBody);
    
    if (!referenceVideo) {
      toast.error('Reference video not found!');
      return;
    }
    
    const contextMatch = referenceVideo.videoName.match(/^(T\d+_C\d+_E\d+_AD\d+)/);
    const characterMatch = referenceVideo.videoName.match(/_([^_]+)$/);
    const context = contextMatch ? contextMatch[1] : 'MERGED';
    const character = characterMatch ? characterMatch[1] : 'TEST';
    
    console.log('[Step 10→Step 11] Context:', context, 'Character:', character);
    
    // Start merging
    setIsMergingFinalVideos(true);
    setMergeFinalProgress({
      current: 0,
      total: hookUrls.length,
      currentVideo: '',
      status: 'processing'
    });
    
    const results: Array<{
      videoName: string;
      cdnUrl: string;
      hookName: string;
      bodyName: string;
    }> = [];
    
    // Batch processing
    const BATCH_SIZE = 3;
    const DELAY_BETWEEN_BATCHES = 3000;
    
    let completedCount = 0;
    let failedCount = 0;
    
    for (let i = 0; i < hookUrls.length; i += BATCH_SIZE) {
      const batch = hookUrls.slice(i, Math.min(i + BATCH_SIZE, hookUrls.length));
      
      const batchPromises = batch.map(async (hook) => {
        const finalVideoName = hook.name.replace(/(HOOK\d+)M/, '$1');
        
        setMergeFinalProgress(prev => ({
          ...prev,
          current: completedCount,
          currentVideo: finalVideoName
        }));
        
        try {
          const result = await mergeVideosMutation.mutateAsync({
            videoUrls: [hook.url, bodyUrl],
            outputVideoName: finalVideoName,
            ffmpegApiKey: localCurrentUser.ffmpegApiKey || '',
            userId: localCurrentUser.id,
            folder: 'merged',  // Step 11 final videos go to /merged/ folder
          });
          
          results.push({
            videoName: finalVideoName,
            cdnUrl: result.cdnUrl,
            hookName: hook.name,
            bodyName: selectedBody || 'body_merged'
          });
          
          completedCount++;
          return { success: true };
        } catch (error: any) {
          console.error(`[Step 10→Step 11] ${finalVideoName} failed:`, error);
          failedCount++;
          return { success: false };
        }
      });
      
      await Promise.all(batchPromises);
      
      if (i + BATCH_SIZE < hookUrls.length) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
      }
    }
    
    // Save to database BEFORE setFinalVideos to ensure completion
    console.log('[Step 10→Step 11] 💾 Saving finalVideos to DB:', results);
    
    try {
      await upsertContextSessionMutation.mutateAsync({
        userId: localCurrentUser.id,
        tamId: selectedTamId,
        coreBeliefId: selectedCoreBeliefId,
        emotionalAngleId: selectedEmotionalAngleId,
        adId: selectedAdId,
        characterId: selectedCharacterId,
        currentStep: 11,
        rawTextAd,
        processedTextAd,
        adLines,
        prompts,
        images,
        combinations,
        deletedCombinations,
        videoResults,
        reviewHistory,
        hookMergedVideos,
        bodyMergedVideoUrl,
        finalVideos: results, // Save results directly
      });
      console.log('[Step 10→Step 11] ✅ finalVideos saved to database');
    } catch (error) {
      console.error('[Step 10→Step 11] ❌ Failed to save finalVideos:', error);
    }
    
    // Update state AFTER database save
    setFinalVideos(results);
    
    setMergeFinalProgress({
      current: completedCount,
      total: hookUrls.length,
      currentVideo: '',
      status: 'complete'
    });
    setIsMergingFinalVideos(false);
    setCurrentStep(11);
    
    toast.success(`✅ Final merge complete! ${completedCount}/${hookUrls.length} videos created`);
  };

  // Step 8 → Step 9: Trim all videos using FFMPEG API
  // Step 8 → Step 9: Trim all videos using FFMPEG API
  const handleTrimAllVideos = async () => {
    // ALWAYS reprocess ALL accepted videos (ignore recutStatus)
    const videosToTrim = videoResults.filter(v => 
      v.reviewStatus === 'accepted' && 
      v.status === 'success' && 
      v.videoUrl
    );
    
    if (videosToTrim.length === 0) {
      toast.error('Nu există videouri pentru tăiere!');
      setIsTrimmingModalOpen(false);
      return;
    }
    
    // Validate that all videos have START and END locked
    const unlockedVideos = videosToTrim.filter(v => 
      !v.isStartLocked || !v.isEndLocked
    );
    
    if (unlockedVideos.length > 0) {
      const unlockedNames = unlockedVideos.map(v => v.videoName).join('\n');
      
      toast.error(
        `❌ Următoarele videouri nu sunt locked:\n\n${unlockedNames}\n\nTe rog să blochezi START și END pentru toate videourile înainte de trimming!`,
        { duration: 8000 }
      );
      setIsTrimmingModalOpen(false);
      return;
    }
    
    console.log('[Trimming] Starting SIMPLE batch process for', videosToTrim.length, 'videos (10 per batch, 58s wait)');
    
    // SIMPLE BATCH PROCESSING: 10 at once → wait 58s → next 10 → wait 58s → rest
    const BATCH_SIZE = 10;
    const DELAY_BETWEEN_BATCHES = 58000; // 58 seconds
    
    // Open modal immediately
    setIsTrimmingModalOpen(true);
    
    // Calculate total batches
    const totalBatches = Math.ceil(videosToTrim.length / BATCH_SIZE);
    
    // Calculate total processes (videos + hook groups + body merge)
    // Calculate hook groups upfront
    const hookVideos = videosToTrim.filter(v => v.videoName.match(/HOOK\d+[A-Z]?/));
    const hookGroups: Record<string, typeof hookVideos> = {};
    
    hookVideos.forEach(video => {
      const hookMatch = video.videoName.match(/(.*)(HOOK\d+)[A-Z]?(.*)/); 
      if (hookMatch) {
        const prefix = hookMatch[1];
        const hookBase = hookMatch[2];
        const suffix = hookMatch[3];
        const groupKey = `${prefix}${hookBase}${suffix}`;
        
        if (!hookGroups[groupKey]) {
          hookGroups[groupKey] = [];
        }
        hookGroups[groupKey].push(video);
      }
    });
    
    const hookGroupsToMerge = Object.entries(hookGroups).filter(([_, videos]) => videos.length > 1);
    const bodyVideos = videosToTrim.filter(v => !v.videoName.match(/HOOK\d+[A-Z]?/));
    const needsBodyMerge = bodyVideos.length > 0;
    
    const cuttingTotal = videosToTrim.length;
    const mergingTotal = hookGroupsToMerge.length + (needsBodyMerge ? 1 : 0);
    const initialTotal = cuttingTotal + mergingTotal;
    
    console.log('[Trimming] 📊 Progress calculation:', {
      cuttingTotal,
      hookGroups: hookGroupsToMerge.length,
      bodyMerge: needsBodyMerge ? 1 : 0,
      mergingTotal,
      total: initialTotal
    });
    
    // Calculate total FFmpeg requests:
    // 1 directory + (N videos * 2 uploads) + (N videos * 1 process) = 1 + 2N + N = 1 + 3N
    // For videos with CleanVoice: 1 + (N * 3 uploads) + (N * 1 process) = 1 + 4N
    const videosWithCleanVoice = videosToTrim.filter(v => v.cleanvoiceAudioUrl).length;
    const videosWithoutCleanVoice = videosToTrim.length - videosWithCleanVoice;
    const totalFFmpegRequests = 1 + (videosWithCleanVoice * 4) + (videosWithoutCleanVoice * 3);
    
    console.log('[Trimming] 📊 FFmpeg requests calculation:', {
      total: totalFFmpegRequests,
      directory: 1,
      withCleanVoice: videosWithCleanVoice,
      withoutCleanVoice: videosWithoutCleanVoice
    });
    
    setTrimmingProgress({
      current: 0,
      total: initialTotal,
      currentVideo: '',
      status: 'processing',
      message: `Starting batch processing (${totalBatches} batches)...`,
      successVideos: [],
      failedVideos: [],
      inProgressVideos: [],
      currentBatch: 0,
      totalBatches,
      batchSize: BATCH_SIZE,
      mergeStatus: 'idle',
      ffmpegRequestsCurrent: 0,
      ffmpegRequestsTotal: totalFFmpegRequests,
      countdown: 0,
      cuttingCurrent: 0,
      cuttingTotal,
      mergingCurrent: 0,
      mergingTotal,
      mergedVideos: []
    });
    
    // Create shared directory for ALL videos in this batch (optimization: 1 request instead of N)
    console.log('[Trimming] 📁 Creating shared FFmpeg directory...');
    let sharedDirId: string | undefined;
    try {
      const dirResult = await createDirectoryMutation.mutateAsync({
        ffmpegApiKey: localCurrentUser.ffmpegApiKey || ''
      });
      sharedDirId = dirResult.dirId;
      console.log('[Trimming] ✅ Shared directory created:', sharedDirId);
      
      // Increment FFmpeg requests counter (1 directory creation)
      setTrimmingProgress(prev => ({
        ...prev,
        ffmpegRequestsCurrent: prev.ffmpegRequestsCurrent + 1
      }));
    } catch (error) {
      console.error('[Trimming] ❌ Failed to create shared directory:', error);
      // Continue without shared directory (each video will create its own)
    }
    
    // Process videos in batches
    let currentIndex = 0;
    let batchNumber = 1;
    const localSuccessVideos: Array<{name: string}> = [];  // Track successful videos locally
    
    while (currentIndex < videosToTrim.length) {
      const batchEnd = Math.min(currentIndex + BATCH_SIZE, videosToTrim.length);
      const batchVideos = videosToTrim.slice(currentIndex, batchEnd);
      
      console.log(`[Trimming] 📦 Batch ${batchNumber}: Processing ${batchVideos.length} videos (${currentIndex + 1}-${batchEnd})...`);
      
      // Update batch progress
      setTrimmingProgress(prev => ({
        ...prev,
        currentBatch: batchNumber,
        message: `📦 Batch ${batchNumber}/${totalBatches}: Trimming ${batchVideos.length} videos...`
      }));
      
      // Process all videos in this batch IN PARALLEL
      const batchPromises = batchVideos.map(async (video) => {
        const videoIndex = videosToTrim.indexOf(video);
        
        // Update progress: add to in-progress list
        setTrimmingProgress(prev => ({
          ...prev,
          inProgressVideos: [...prev.inProgressVideos, { name: video.videoName }]
        }));
        
        try {
          const trimStart = video.cutPoints?.startKeep || 0;
          const trimEnd = video.cutPoints?.endKeep || 0;
          
          console.log(`[Trimming] Processing ${video.videoName} (${videoIndex + 1}/${videosToTrim.length})`);
          
          const result = await cutVideoMutation.mutateAsync({
            userId: localCurrentUser.id,
            videoUrl: video.videoUrl!,
            videoName: video.videoName,
            startTimeMs: trimStart,
            endTimeMs: trimEnd,
            ffmpegApiKey: localCurrentUser.ffmpegApiKey || '',
            cleanVoiceAudioUrl: video.cleanvoiceAudioUrl || null,
            dirId: sharedDirId,  // Pass shared directory ID for optimization
          });
          
          if (!result.success || !result.downloadUrl) {
            throw new Error('Failed to trim video');
          }
          
          // Update videoResults with trimmed URL
          setVideoResults(prev => prev.map(v =>
            v.videoName === video.videoName
              ? { 
                  ...v, 
                  trimmedVideoUrl: result.downloadUrl,
                  recutStatus: 'accepted'
                }
              : v
          ));
          
          // SUCCESS
          console.log(`[Trimming] ✅ ${video.videoName} SUCCESS`);
          
          // Track locally
          localSuccessVideos.push({ name: video.videoName });
          
          // Calculate FFmpeg requests for this video:
          // - 2 uploads (video + audio) or 1 upload (video only) + 1 process
          const ffmpegRequestsForVideo = video.cleanvoiceAudioUrl ? 3 : 2;
          
          setTrimmingProgress(prev => ({
            ...prev,
            current: prev.current + 1,
            cuttingCurrent: prev.cuttingCurrent + 1,  // Increment cutting progress
            successVideos: [...prev.successVideos, { name: video.videoName }],
            inProgressVideos: prev.inProgressVideos.filter(v => v.name !== video.videoName),
            ffmpegRequestsCurrent: prev.ffmpegRequestsCurrent + ffmpegRequestsForVideo
          }));
          
          return { video, status: 'success' };
          
        } catch (error: any) {
          // FAILED
          console.error(`[Trimming] ❌ ${video.videoName} FAILED:`, error);
          
          setTrimmingProgress(prev => ({
            ...prev,
            current: prev.current + 1,
            failedVideos: [...prev.failedVideos, {
              name: video.videoName,
              error: error.message || 'Unknown error',
              retries: 0
            }],
            inProgressVideos: prev.inProgressVideos.filter(v => v.name !== video.videoName)
          }));
          
          return { video, status: 'failed', error: error.message };
        }
      });
      
      // Wait for ALL videos in this batch to complete
      await Promise.all(batchPromises);
      
      console.log(`[Trimming] ✅ Batch ${batchNumber} complete!`);
      
      // Move to next batch
      currentIndex = batchEnd;
      batchNumber++;
      
      // Wait 58s before next batch (if there are more videos)
      if (currentIndex < videosToTrim.length) {
        console.log(`[Trimming] ⏳ Waiting 58 seconds before batch ${batchNumber}...`);
        
        // Countdown timer: 58s → 57s → 56s → ... → 1s
        for (let countdown = 58; countdown > 0; countdown--) {
          setTrimmingProgress(prev => ({
            ...prev,
            message: `⏳ Waiting ${countdown}s before next batch (FFmpeg rate limit)...`,
            status: 'processing',
            countdown: countdown  // Update countdown state for UI
          }));
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // Reset countdown after delay
        setTrimmingProgress(prev => ({
          ...prev,
          countdown: 0
        }));
      }
    }
     console.log('[Trimming] \ud83c\udf89 All batches processed!');
    
    // Wait 58s after last batch before merge operations (FFmpeg rate limit)
    console.log('[Trimming] ⏳ Waiting 58 seconds before merge operations (FFmpeg rate limit)...');
    for (let countdown = 58; countdown > 0; countdown--) {
      setTrimmingProgress(prev => ({
        ...prev,
        message: `\u23f3 Waiting ${countdown}s before merge operations (FFmpeg rate limit)...`,
        status: 'processing',
        countdown: countdown
      }));
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Reset countdown
    setTrimmingProgress(prev => ({
      ...prev,
      countdown: 0
    }));
    
    // Get LATEST counts from state using callback
    setTrimmingProgress(prev => {
      const successCount = prev.successVideos.length;
      const failCount = prev.failedVideos.length;
      const finalStatus = failCount > 0 ? 'partial' : 'complete';
      
      console.log(`[Trimming] 🎉 COMPLETE! Success: ${successCount}, Failed: ${failCount}`);
      
      // Save updated videoResults to database (only successful ones)
      if (successCount > 0) {
      console.log('[Trimming] 💾 Saving trimmedVideoUrl to database...');
      
      // Use setVideoResults callback to get the LATEST state
      setVideoResults(currentVideoResults => {
        // Save to database with latest videoResults
        upsertContextSessionMutation.mutateAsync({
          userId: localCurrentUser.id,
          tamId: selectedTamId,
          coreBeliefId: selectedCoreBeliefId,
          emotionalAngleId: selectedEmotionalAngleId,
          adId: selectedAdId,
          characterId: selectedCharacterId,
          currentStep,
          rawTextAd,
          processedTextAd,
          adLines,
          prompts,
          images,
          combinations,
          deletedCombinations,
          videoResults: currentVideoResults, // Use LATEST state
          reviewHistory,
          hookMergedVideos,
          bodyMergedVideoUrl,
          finalVideos,
        }).then(async () => {
          console.log('[Trimming] ✅ Database save successful!');
          
          // STEP 2: Merge Hooks (B+C+D variations) - AFTER database save
          const hooksBodySuccess = await performHooksAndBodyMerge();
          
          // STEP 3: Final merge (only if hooks/body succeeded)
          if (hooksBodySuccess) {
            await performFinalMerge();
          } else {
            console.log('[Trimming] ⚠️ Skipping final merge due to hooks/body merge failure');
          }
        }).catch((error) => {
          console.error('[Trimming] ❌ Database save failed:', error);
          toast.error('Failed to save trimmed videos to database');
        });
        
        // Return unchanged state (no modification needed)
        return currentVideoResults;
      });
      }
      
      // Return updated progress state
      return {
        ...prev,
        status: finalStatus,
        message: failCount > 0 
          ? `⚠️ ${successCount} succeeded, ${failCount} failed`
          : `✅ All ${successCount} videos trimmed successfully!`
      };
    });
    
    // Define hooks/body merge function to be called after database save
    const performHooksAndBodyMerge = async (): Promise<boolean> => {
      console.log('[Trimming] 🎣 Starting Hooks merge (B+C+D)...');
      
      // Get LATEST successVideos and videoResults from state
      let latestSuccessVideos: typeof localSuccessVideos = [];
      let latestVideoResults: typeof videoResults = [];
      
      setTrimmingProgress(current => {
        latestSuccessVideos = current.successVideos;
        return current;
      });
      
      setVideoResults(current => {
        latestVideoResults = current;
        return current;
      });
      
      console.log(`[Trimming] Latest success videos count: ${latestSuccessVideos.length}`);
      
      const trimmedVideos = latestVideoResults.filter(v => 
        latestSuccessVideos.some(sv => sv.name === v.videoName)
      );
      
      console.log(`[Trimming] Trimmed videos for hooks merge: ${trimmedVideos.length}`);
      
      // Group HOOKS by base name (HOOK3, HOOK3B, HOOK3C → 1 group)
      const hookVideos = trimmedVideos.filter(v => v.videoName.match(/HOOK\d+[A-Z]?/));
      console.log(`[Trimming] Hook videos found: ${hookVideos.length}`, hookVideos.map(v => v.videoName));
      const hookGroups: Record<string, typeof hookVideos> = {};
      
      hookVideos.forEach(video => {
        const hookMatch = video.videoName.match(/(.*)(HOOK\d+)[A-Z]?(.*)/);
        if (hookMatch) {
          const prefix = hookMatch[1];
          const hookBase = hookMatch[2];
          const suffix = hookMatch[3];
          const groupKey = `${prefix}${hookBase}${suffix}`;
          
          if (!hookGroups[groupKey]) {
            hookGroups[groupKey] = [];
          }
          hookGroups[groupKey].push(video);
        }
      });
      
      // Filter: only groups with 2+ videos need merging
      const hookGroupsToMerge = Object.entries(hookGroups).filter(([_, videos]) => videos.length > 1);
      const bodyVideos = trimmedVideos.filter(v => !v.videoName.match(/HOOK\d+[A-Z]?/));
      
      console.log('[Trimming] 🎣 Hook groups to merge:', hookGroupsToMerge.length);
      
      // Merge each hook group
      for (const [baseName, videos] of hookGroupsToMerge) {
        console.log(`[Trimming] 🎣 Merging ${baseName} (${videos.length} videos)...`);
        
        // Check if all videos have trimmedVideoUrl
        const allHaveTrimmedUrl = videos.every(v => v.trimmedVideoUrl);
        if (!allHaveTrimmedUrl) {
          console.log(`[Trimming] ⚠️ Skipping ${baseName} - not all videos have trimmedVideoUrl`);
          setTrimmingProgress(prev => ({
            ...prev,
            failedVideos: [...prev.failedVideos, { 
              name: `${baseName} (Hooks merge)`, 
              error: 'Not all videos have been trimmed yet',
              retries: 0
            }]
          }));
          continue;
        }
        
        setTrimmingProgress(prev => ({
          ...prev,
          status: 'merging',
          message: `Merging ${baseName} (${videos.length} videos)...`
        }));
        
        try {
          const sortedVideos = videos.sort((a, b) => a.videoName.localeCompare(b.videoName));
          
          // Extract original URLs
          const extractOriginalUrl = (url: string) => {
            if (url.startsWith('/api/proxy-video?url=')) {
              const urlParam = new URLSearchParams(url.split('?')[1]).get('url');
              return urlParam ? decodeURIComponent(urlParam) : url;
            }
            return url;
          };
          
          const videoUrls = sortedVideos.map(v => extractOriginalUrl(v.trimmedVideoUrl!)).filter(Boolean);
          
          // Output name: T1_C1_E1_AD4_HOOK3M_TEST (M = merged)
          const outputName = baseName.replace(/(HOOK\d+)/, '$1M');
          
          const result = await mergeVideosMutation.mutateAsync({
            videoUrls,
            outputVideoName: outputName,
            ffmpegApiKey: localCurrentUser.ffmpegApiKey || '',
            userId: localCurrentUser.id,
          });
          
          console.log(`[Trimming] ✅ ${baseName} merged:`, result.cdnUrl);
          
          // Save merged hook URL
          setHookMergedVideos(prev => {
            const hookBaseMatch = baseName.match(/(.*HOOK\d+)/);
            const hookBase = hookBaseMatch ? hookBaseMatch[1] : null;
            const cleaned = hookBase 
              ? Object.fromEntries(Object.entries(prev).filter(([key]) => hookBase && !key.startsWith(hookBase)))
              : prev;
            return { ...cleaned, [baseName]: result.cdnUrl };
          });
          
          // Add to merged list and increment progress
          setTrimmingProgress(prev => ({
            ...prev,
            current: prev.current + 1,
            mergingCurrent: prev.mergingCurrent + 1,
            mergedVideos: [...prev.mergedVideos, { name: outputName, type: 'hooks' }]
          }));
          
          // Save to database
          await upsertContextSessionMutation.mutateAsync({
            userId: localCurrentUser.id,
            tamId: selectedTamId,
            coreBeliefId: selectedCoreBeliefId,
            emotionalAngleId: selectedEmotionalAngleId,
            adId: selectedAdId,
            characterId: selectedCharacterId,
            currentStep,
            rawTextAd,
            processedTextAd,
            adLines,
            prompts,
            images,
            combinations,
            deletedCombinations,
            videoResults: videoResults,
            reviewHistory,
            hookMergedVideos: { ...hookMergedVideos, [baseName]: result.cdnUrl },
            bodyMergedVideoUrl: bodyMergedVideoUrl,
            finalVideos,
          });
          
          } catch (error: any) {
            console.error('[Trimming] ❌ Hook merge failed:', error);
            setTrimmingProgress(prev => ({
              ...prev,
              status: 'partial',
              failedVideos: [...prev.failedVideos, { 
                name: `${baseName} (Hooks merge)`, 
                error: error.message,
                retries: 0
              }],
              message: `⚠️ Hooks merge failed: ${error.message}`
            }));
            return false; // Signal failure
          }
      }
      
      // STEP 3: Merge Body (all non-hook videos)
      console.log('[Trimming] 📺 Starting Body merge...');
      
      if (bodyVideos.length > 0) {
        console.log(`[Trimming] 📺 Merging BODY (${bodyVideos.length} videos)...`);
        
        // Check if all videos have trimmedVideoUrl
        const allHaveTrimmedUrl = bodyVideos.every(v => v.trimmedVideoUrl);
        if (!allHaveTrimmedUrl) {
          console.log(`[Trimming] ⚠️ Skipping BODY merge - not all videos have trimmedVideoUrl`);
          setTrimmingProgress(prev => ({
            ...prev,
            failedVideos: [...prev.failedVideos, { 
              name: 'BODY (Body merge)', 
              error: 'Not all videos have been trimmed yet',
              retries: 0
            }]
          }));
        } else {
          setTrimmingProgress(prev => ({
            ...prev,
            status: 'merging',
            message: `Merging BODY (${bodyVideos.length} videos)...`
          }));
          
          try {
            // Extract original URLs
            const extractOriginalUrl = (url: string) => {
              if (url.startsWith('/api/proxy-video?url=')) {
                const urlParam = new URLSearchParams(url.split('?')[1]).get('url');
                return urlParam ? decodeURIComponent(urlParam) : url;
              }
              return url;
            };
            
            // Extract context from first video
            const firstVideoName = bodyVideos[0].videoName;
            const contextMatch = firstVideoName.match(/^(T\d+_C\d+_E\d+_AD\d+)/);
            const contextName = contextMatch ? contextMatch[1] : 'MERGED';
            
            // Extract character and imageName
            const nameMatch = firstVideoName.match(/_([ A-Z]+)_([A-Z]+_\d+)$/);
            const character = nameMatch ? nameMatch[1] : 'TEST';
            const imageName = nameMatch ? nameMatch[2] : 'ALINA_1';
            
            const outputName = `${contextName}_BODY_${character}_${imageName}`;
            
            // BATCH MERGE: Split into batches of 5 videos to avoid FFmpeg crash
            const BATCH_SIZE = 5;
            const batches: typeof bodyVideos[] = [];
            for (let i = 0; i < bodyVideos.length; i += BATCH_SIZE) {
              batches.push(bodyVideos.slice(i, i + BATCH_SIZE));
            }
            
            console.log(`[Trimming] 📦 Splitting ${bodyVideos.length} body videos into ${batches.length} batches of ${BATCH_SIZE}`);
            
            // Merge each batch separately
            const batchResults: string[] = [];
            for (let i = 0; i < batches.length; i++) {
              const batch = batches[i];
              const batchVideoUrls = batch.map(v => extractOriginalUrl(v.trimmedVideoUrl!)).filter(Boolean);
              
              console.log(`[Trimming] 📦 Merging batch ${i + 1}/${batches.length} (${batch.length} videos)...`);
              
              setTrimmingProgress(prev => ({
                ...prev,
                message: `Merging BODY batch ${i + 1}/${batches.length} (${batch.length} videos)...`
              }));
              
              const batchResult = await mergeVideosMutation.mutateAsync({
                videoUrls: batchVideoUrls,
                outputVideoName: `${outputName}_BATCH_${i + 1}`,
                ffmpegApiKey: localCurrentUser.ffmpegApiKey || '',
                userId: localCurrentUser.id,
              });
              
              batchResults.push(batchResult.cdnUrl);
              console.log(`[Trimming] ✅ Batch ${i + 1}/${batches.length} merged:`, batchResult.cdnUrl);
            }
            
            // If only one batch, use it directly
            let result;
            if (batchResults.length === 1) {
              result = { cdnUrl: batchResults[0] };
              console.log('[Trimming] ✅ Single batch - using directly');
            } else {
              // Merge all batch results into final video
              console.log(`[Trimming] 🔗 Merging ${batchResults.length} batch results into final BODY video...`);
              
              setTrimmingProgress(prev => ({
                ...prev,
                message: `Merging ${batchResults.length} batch results into final BODY video...`
              }));
              
              result = await mergeVideosMutation.mutateAsync({
                videoUrls: batchResults,
                outputVideoName: outputName,
                ffmpegApiKey: localCurrentUser.ffmpegApiKey || '',
                userId: localCurrentUser.id,
              });
              
              console.log('[Trimming] ✅ Final BODY merge complete:', result.cdnUrl);
            }
            
            console.log('[Trimming] ✅ BODY merged:', result.cdnUrl);
            
            setBodyMergedVideoUrl(result.cdnUrl);
            
            // Add to merged list and increment progress
            setTrimmingProgress(prev => ({
              ...prev,
              current: prev.current + 1,
              mergingCurrent: prev.mergingCurrent + 1,
              mergedVideos: [...prev.mergedVideos, { name: outputName, type: 'body' }]
            }));
            
            // Save to database
            await upsertContextSessionMutation.mutateAsync({
              userId: localCurrentUser.id,
              tamId: selectedTamId,
              coreBeliefId: selectedCoreBeliefId,
              emotionalAngleId: selectedEmotionalAngleId,
              adId: selectedAdId,
              characterId: selectedCharacterId,
              currentStep,
              rawTextAd,
              processedTextAd,
              adLines,
              prompts,
              images,
              combinations,
              deletedCombinations,
              videoResults: videoResults,
              reviewHistory,
              hookMergedVideos: hookMergedVideos,
              bodyMergedVideoUrl: result.cdnUrl,
              finalVideos,
            });
            
          } catch (error: any) {
            console.error('[Trimming] ❌ BODY merge failed:', error);
            setTrimmingProgress(prev => ({
              ...prev,
              status: 'partial',
              failedVideos: [...prev.failedVideos, { 
                name: 'BODY (Body merge)', 
                error: error.message,
                retries: 0
              }],
              message: `⚠️ Body merge failed: ${error.message}`
            }));
            return false; // Signal failure
          }
        }
      }
      return true; // All merges succeeded
    };
    
    // Define final merge function to be called after hooks/body merge
    const performFinalMerge = async () => {
      // STEP 4: Wait 58s before final merge (FFmpeg rate limit)
      console.log('[Trimming] ⏳ Waiting 58 seconds before final merge (FFmpeg rate limit)...');
      for (let countdown = 58; countdown > 0; countdown--) {
        setTrimmingProgress(prev => ({
          ...prev,
          message: `⏳ Waiting ${countdown}s before final merge (FFmpeg rate limit)...`,
          status: 'processing',
          countdown: countdown
        }));
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Reset countdown
      setTrimmingProgress(prev => ({
        ...prev,
        countdown: 0
      }));
      
      // STEP 5: Final merge (all original videos for preview) - AFTER hooks/body merge + 58s delay
      console.log('[Trimming] 🔄 Starting final merge for preview...');
      
      // Get latest videoResults from database (fresh data)
      console.log('[Trimming] 💾 Fetching latest videoResults from database...');
      
      let dbVideoResults: typeof videoResults = [];
      try {
        const dbData = await contextSessionQuery.refetch();
        if (dbData.data?.videoResults) {
          dbVideoResults = dbData.data.videoResults;
          console.log('[Trimming] ✅ Loaded', dbVideoResults.length, 'videos from database');
        }
      } catch (error) {
        console.error('[Trimming] ❌ Failed to fetch from database:', error);
        // Fallback to current state
        dbVideoResults = videoResults;
      }
      
      // Filter videos that have trimmedVideoUrl (successfully trimmed)
      // EXCLUDE hooks/body merged videos (only original 20 videos)
      const finalMergeSuccessVideos = dbVideoResults.filter(v => 
        v.trimmedVideoUrl && 
        v.recutStatus === 'accepted' &&
        !v.videoName.includes('(Hooks merged)') &&
        !v.videoName.includes('(Body merged)')
      );
      
      console.log('[Trimming] 📊 Final merge check: successVideos count =', finalMergeSuccessVideos.length);
      console.log('[Trimming] 📊 Video names:', finalMergeSuccessVideos.map(v => v.videoName));
      
      if (finalMergeSuccessVideos.length > 0) {
        setTrimmingProgress(prev => ({
          ...prev,
          status: 'merging',
          mergeStatus: 'pending',
          message: `🔄 Merging ALL ${finalMergeSuccessVideos.length} videos for preview... Please wait...`
        }));
        
        try {
          // Extract original URLs
          const extractOriginalUrl = (url: string) => {
            if (url.startsWith('/api/proxy-video?url=')) {
              const urlParam = new URLSearchParams(url.split('?')[1]).get('url');
              return urlParam ? decodeURIComponent(urlParam) : url;
            }
            return url;
          };
          
          // Use dbVideoResults directly (already filtered)
          const trimmedVideos = finalMergeSuccessVideos;
          
          const videos = trimmedVideos.map(v => ({
            url: extractOriginalUrl(v.videoUrl),
            name: v.videoName,
            startMs: v.cutPoints?.startKeep || 0,
            endMs: v.cutPoints?.endKeep || 0,
          }));
          
          console.log('[Trimming] 📦 Calling cutAndMergeAllMutation with:', videos.length, 'videos');
          console.log('[Trimming] Videos:', videos);
          
          const result = await cutAndMergeAllMutation.mutateAsync({
            videos,
            ffmpegApiKey: localCurrentUser.ffmpegApiKey || '',
          });
          
          console.log('[Trimming] ✅ Auto-merge successful!', result);
          
          // Save merged video URL to state
          setTrimmingMergedVideoUrl(result.downloadUrl);
          
          setTrimmingProgress(prev => ({
            ...prev,
            status: 'complete',
            mergeStatus: 'success',
            message: '✅ All videos trimmed and merged successfully!'
          }));
          
        } catch (error: any) {
          console.error('[Trimming] ❌ Auto-merge failed:', error);
          console.error('[Trimming] Error details:', error.message, error.stack);
          setTrimmingProgress(prev => ({
            ...prev,
            status: 'partial',
            mergeStatus: 'failed',
            message: `⚠️ Trimming complete but merge failed: ${error.message}`
          }));
        }
      }
    };
  };

  // Manual retry for failed videos
  const handleRetryFailedVideos = async () => {
    const failedVideos = trimmingProgress.failedVideos;
    
    if (failedVideos.length === 0) {
      toast.error('No failed videos to retry!');
      return;
    }
    
    console.log(`[Retry] Starting manual retry for ${failedVideos.length} failed videos...`);
    
    // Update status to processing
    setTrimmingProgress(prev => ({
      ...prev,
      status: 'processing',
      message: `Retrying ${failedVideos.length} failed videos...`
    }));
    
    // Separate CUT failures from MERGE failures
    const cutFailures = failedVideos.filter(v => !v.name.includes('(Hooks merge)') && !v.name.includes('(Body merge)'));
    const mergeFailures = failedVideos.filter(v => v.name.includes('(Hooks merge)') || v.name.includes('(Body merge)'));
    
    // Process CUT failures first
    for (const failedVideo of cutFailures) {
      // Find the actual video object from videoResults
      const video = videoResults.find(v => v.videoName === failedVideo.name);
      
      if (!video) {
        console.error(`[Retry] Video not found: ${failedVideo.name}`);
        continue;
      }
      
      // Mark as retrying
      setTrimmingProgress(prev => ({
        ...prev,
        failedVideos: prev.failedVideos.map(v =>
          v.name === failedVideo.name
            ? { ...v, status: 'retrying', error: '' }
            : v
        ),
        message: `Retrying ${failedVideo.name}...`
      }));
      
      try {
        const trimStart = video.cutPoints?.startKeep || 0;
        const trimEnd = video.cutPoints?.endKeep || 0;
        
        console.log(`[Retry] Processing ${video.videoName}...`);
        
        const result = await cutVideoMutation.mutateAsync({
          userId: localCurrentUser.id,
          videoUrl: video.videoUrl!,
          videoName: video.videoName,
          startTimeMs: trimStart,
          endTimeMs: trimEnd,
          ffmpegApiKey: localCurrentUser.ffmpegApiKey || undefined,
          cleanVoiceAudioUrl: video.cleanvoiceAudioUrl || undefined,
          // No dirId for retry - each retry creates its own directory
        });
        
        if (!result.success || !result.downloadUrl) {
          throw new Error('Failed to trim video');
        }
        
        // Update videoResults with trimmed URL and success status
        setVideoResults(prev => prev.map(v =>
          v.videoName === video.videoName
            ? { 
                ...v, 
                trimmedVideoUrl: result.downloadUrl,
                recutStatus: 'accepted',
                status: 'success' as const,
                error: undefined
              }
            : v
        ));
        
        // SUCCESS - Save to database
        console.log(`[Retry] ✅ ${video.videoName} SUCCESS - Saving to database...`);
        
        try {
          const currentVideoResults = await new Promise<typeof videoResults>((resolve) => {
            setVideoResults(current => {
              resolve(current);
              return current;
            });
          });
          
          await upsertContextSessionMutation.mutateAsync({
            userId: localCurrentUser.id,
            tamId: selectedTamId,
            coreBeliefId: selectedCoreBeliefId,
            emotionalAngleId: selectedEmotionalAngleId,
            adId: selectedAdId,
            characterId: selectedCharacterId,
            currentStep,
            rawTextAd,
            processedTextAd,
            adLines,
            prompts,
            images,
            combinations,
            deletedCombinations,
            videoResults: currentVideoResults,
            reviewHistory,
            hookMergedVideos,
            bodyMergedVideoUrl,
            finalVideos,
          });
          
          console.log(`[Retry] 💾 ${video.videoName} saved to database`);
        } catch (dbError: any) {
          console.error(`[Retry] ❌ Database save failed for ${video.videoName}:`, dbError);
          // Continue processing even if DB save fails
        }
        
        // Move from failed to success list
        setTrimmingProgress(prev => ({
          ...prev,
          current: prev.current + 1,
          successVideos: [...prev.successVideos, { name: video.videoName }],
          failedVideos: prev.failedVideos.filter(v => v.name !== video.videoName)
        }));
        
      } catch (error: any) {
        // FAILED AGAIN - Update error message
        console.error(`[Retry] ❌ ${video.videoName} FAILED:`, error);
        
        // Update videoResults with failed status
        setVideoResults(prev => prev.map(v =>
          v.videoName === video.videoName
            ? { 
                ...v, 
                status: 'failed' as const,
                error: error.message || 'Unknown error'
              }
            : v
        ));
        
        // Save failed status to database
        try {
          const currentVideoResults = await new Promise<typeof videoResults>((resolve) => {
            setVideoResults(current => {
              resolve(current);
              return current;
            });
          });
          
          await upsertContextSessionMutation.mutateAsync({
            userId: localCurrentUser.id,
            tamId: selectedTamId,
            coreBeliefId: selectedCoreBeliefId,
            emotionalAngleId: selectedEmotionalAngleId,
            adId: selectedAdId,
            characterId: selectedCharacterId,
            currentStep,
            rawTextAd,
            processedTextAd,
            adLines,
            prompts,
            images,
            combinations,
            deletedCombinations,
            videoResults: currentVideoResults,
            reviewHistory,
            hookMergedVideos,
            bodyMergedVideoUrl,
            finalVideos,
          });
          
          console.log(`[Retry] 💾 ${video.videoName} failed status saved to database`);
        } catch (dbError: any) {
          console.error(`[Retry] ❌ Database save failed for ${video.videoName}:`, dbError);
          // Continue processing even if DB save fails
        }
        
        setTrimmingProgress(prev => ({
          ...prev,
          failedVideos: prev.failedVideos.map(v =>
            v.name === video.videoName
              ? { 
                  ...v, 
                  status: undefined,
                  error: error.message || 'Unknown error',
                  retries: (v.retries || 0) + 1
                }
              : v
          )
        }));
      }
    }
    
    // Final status
    const successCount = trimmingProgress.successVideos.length;
    const failCount = trimmingProgress.failedVideos.length;
    const finalStatus = failCount > 0 ? 'partial' : 'complete';
    
    setTrimmingProgress(prev => ({
      ...prev,
      status: finalStatus,
      message: failCount > 0 
        ? `⚠️ ${successCount} succeeded, ${failCount} still failed`
        : `✅ All videos trimmed successfully!`
    }));
    
    console.log(`[Retry] COMPLETE! Success: ${successCount}, Failed: ${failCount}`);
    
    // Save updated videoResults to database
    if (successCount > 0) {
      console.log('[Retry] 💾 Saving trimmedVideoUrl to database...');
      try {
        await upsertContextSessionMutation.mutateAsync({
          userId: localCurrentUser.id,
          coreBeliefId: selectedCoreBelief!,
          emotionalAngleId: selectedEmotionalAngle!,
          adId: selectedAd!,
          characterId: selectedCharacter!,
          videoResults: videoResults,
        });
        console.log('[Retry] ✅ Database save successful!');
      } catch (error) {
        console.error('[Retry] ❌ Database save failed:', error);
        toast.error('Failed to save trimmed videos to database');
      }
    }
    
    // Process MERGE failures (hooks/body merge)
    for (const failedMerge of mergeFailures) {
      console.log(`[Retry] 🔄 Retrying merge: ${failedMerge.name}`);
      
      setTrimmingProgress(prev => ({
        ...prev,
        message: `Retrying ${failedMerge.name}...`,
        failedVideos: prev.failedVideos.map(v =>
          v.name === failedMerge.name
            ? { ...v, status: 'retrying', error: '' }
            : v
        )
      }));
      
      try {
        if (failedMerge.name.includes('(Hooks merge)')) {
          // Retry hooks merge - extract base name
          const baseName = failedMerge.name.replace(' (Hooks merge)', '');
          
          // Find hook videos for this group
          const hookVideos = videoResults.filter(v => 
            v.videoName.startsWith(baseName) && 
            (v.videoName.includes('_HOOK') || v.videoName.includes('HOOK')) &&
            v.trimmedVideoUrl
          );
          
          if (hookVideos.length === 0) {
            throw new Error('No hook videos found for merge');
          }
          
          console.log(`[Retry] Found ${hookVideos.length} hook videos for ${baseName}`);
          
          const videos = hookVideos.map(v => ({
            url: v.trimmedVideoUrl!,
            name: v.videoName,
          }));
          
          const outputName = `${baseName}_HOOKS_MERGED`;
          
          const result = await mergeVideosMutation.mutateAsync({
            videos,
            outputVideoName: outputName,
            ffmpegApiKey: localCurrentUser.ffmpegApiKey || '',
            userId: localCurrentUser.id,
          });
          
          console.log(`[Retry] ✅ ${failedMerge.name} SUCCESS:`, result.cdnUrl);
          
          // Update hookMergedVideos
          setHookMergedVideos(prev => [
            ...prev.filter(v => !v.name.startsWith(baseName)),
            { name: outputName, url: result.cdnUrl }
          ]);
          
          // Remove from failed list
          setTrimmingProgress(prev => ({
            ...prev,
            failedVideos: prev.failedVideos.filter(v => v.name !== failedMerge.name),
            mergedVideos: [...prev.mergedVideos, { name: outputName, type: 'hook' }]
          }));
          
        } else if (failedMerge.name.includes('(Body merge)')) {
          // Retry body merge
          const bodyVideos = videoResults.filter(v => 
            !v.videoName.includes('_HOOK') && 
            !v.videoName.includes('HOOK') &&
            v.trimmedVideoUrl &&
            v.recutStatus === 'accepted'
          );
          
          if (bodyVideos.length === 0) {
            throw new Error('No body videos found for merge');
          }
          
          console.log(`[Retry] Found ${bodyVideos.length} body videos`);
          
          const videos = bodyVideos.map(v => ({
            url: v.trimmedVideoUrl!,
            name: v.videoName,
          }));
          
          const outputName = 'BODY_MERGED';
          
          const result = await mergeVideosMutation.mutateAsync({
            videos,
            outputVideoName: outputName,
            ffmpegApiKey: localCurrentUser.ffmpegApiKey || '',
            userId: localCurrentUser.id,
          });
          
          console.log(`[Retry] ✅ BODY merge SUCCESS:`, result.cdnUrl);
          
          setBodyMergedVideoUrl(result.cdnUrl);
          
          // Remove from failed list
          setTrimmingProgress(prev => ({
            ...prev,
            failedVideos: prev.failedVideos.filter(v => v.name !== failedMerge.name),
            mergedVideos: [...prev.mergedVideos, { name: outputName, type: 'body' }]
          }));
        }
        
        // Save to database after successful merge
        await upsertContextSessionMutation.mutateAsync({
          userId: localCurrentUser.id,
          tamId: selectedTamId,
          coreBeliefId: selectedCoreBeliefId,
          emotionalAngleId: selectedEmotionalAngleId,
          adId: selectedAdId,
          characterId: selectedCharacterId,
          currentStep,
          rawTextAd,
          processedTextAd,
          adLines,
          prompts,
          images,
          combinations,
          deletedCombinations,
          videoResults: videoResults,
          reviewHistory,
          hookMergedVideos,
          bodyMergedVideoUrl,
          finalVideos,
        });
        
      } catch (error: any) {
        console.error(`[Retry] ❌ ${failedMerge.name} FAILED AGAIN:`, error);
        
        setTrimmingProgress(prev => ({
          ...prev,
          failedVideos: prev.failedVideos.map(v =>
            v.name === failedMerge.name
              ? { ...v, status: 'failed', error: error.message }
              : v
          )
        }));
        
        toast.error(`Failed to retry ${failedMerge.name}: ${error.message}`);
      }
    }
    
    // If all merge retries succeeded, continue with final merge
    const remainingFailures = trimmingProgress.failedVideos.filter(v => v.status !== 'retrying');
    if (mergeFailures.length > 0 && remainingFailures.length === 0) {
      console.log('[Retry] ✅ All merge retries successful! Continuing with final merge...');
      
      // Call final merge
      setTrimmingProgress(prev => ({
        ...prev,
        status: 'processing',
        message: 'Continuing with final merge...'
      }));
      
      // Wait 58s before final merge
      console.log('[Retry] ⏳ Waiting 58 seconds before final merge (FFmpeg rate limit)...');
      for (let countdown = 58; countdown > 0; countdown--) {
        setTrimmingProgress(prev => ({
          ...prev,
          message: `⏳ Waiting ${countdown}s before final merge (FFmpeg rate limit)...`,
          countdown: countdown
        }));
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Fetch latest videoResults from database
      const dbData = await getContextSessionQuery.refetch();
      const dbVideoResults = dbData.data?.videoResults || videoResults;
      
      const finalMergeSuccessVideos = dbVideoResults.filter(v => 
        v.trimmedVideoUrl && 
        v.recutStatus === 'accepted' &&
        !v.videoName.includes('(Hooks merged)') &&
        !v.videoName.includes('(Body merged)')
      );
      
      if (finalMergeSuccessVideos.length > 0) {
        try {
          const videos = finalMergeSuccessVideos.map(v => ({
            url: v.trimmedVideoUrl!,
            name: v.videoName,
          }));
          
          const result = await mergeVideosMutation.mutateAsync({
            videos,
            outputVideoName: 'FINAL_PREVIEW_MERGE',
            ffmpegApiKey: localCurrentUser.ffmpegApiKey || '',
            userId: localCurrentUser.id,
          });
          
          console.log('[Retry] ✅ Final merge successful!', result.cdnUrl);
          
          setTrimmingMergedVideoUrl(result.cdnUrl);
          
          setTrimmingProgress(prev => ({
            ...prev,
            status: 'complete',
            mergeStatus: 'success',
            message: '✅ All operations completed successfully!'
          }));
          
          toast.success('Final merge successful!');
          
        } catch (error: any) {
          console.error('[Retry] ❌ Final merge failed:', error);
          setTrimmingProgress(prev => ({
            ...prev,
            status: 'partial',
            mergeStatus: 'failed',
            message: `⚠️ Merge retry complete but final merge failed: ${error.message}`
          }));
        }
      }
      
      return; // Exit early - don't run the old auto-merge logic
    }
    
    // Auto-merge if ALL CUT videos are now successful (old logic for CUT retries)
    if (failCount === 0 && successCount > 0 && cutFailures.length > 0) {
      console.log('[Retry] 🔄 All videos successful! Auto-merging...');
      
      setTrimmingProgress(prev => ({
        ...prev,
        status: 'merging',
        mergeStatus: 'pending',
        message: `🔄 Merging ALL ${successCount} videos... Please wait...`
      }));
      
      try {
        // Extract original URLs
        const extractOriginalUrl = (url: string) => {
          if (url.startsWith('/api/proxy-video?url=')) {
            const urlParam = new URLSearchParams(url.split('?')[1]).get('url');
            return urlParam ? decodeURIComponent(urlParam) : url;
          }
          return url;
        };
        
        const trimmedVideos = videoResults.filter(v => 
          trimmingProgress.successVideos.some(sv => sv.name === v.videoName)
        );
        
        const videos = trimmedVideos.map(v => ({
          url: extractOriginalUrl(v.videoUrl),
          name: v.videoName,
          startMs: v.cutPoints?.startKeep || 0,
          endMs: v.cutPoints?.endKeep || 0,
        }));
        
        console.log('[Retry] 📦 Calling cutAndMergeAllMutation with:', videos.length, 'videos');
        
        const result = await cutAndMergeAllMutation.mutateAsync({
          videos,
          ffmpegApiKey: localCurrentUser.ffmpegApiKey || '',
        });
        
        console.log('[Retry] ✅ Auto-merge successful!', result);
        
        // Save merged video URL to state
        setTrimmingMergedVideoUrl(result.downloadUrl);
        
        setTrimmingProgress(prev => ({
          ...prev,
          status: 'complete',
          mergeStatus: 'success',
          message: '✅ All videos trimmed and merged successfully!'
        }));
        
      } catch (error: any) {
        console.error('[Retry] ❌ Auto-merge failed:', error);
        setTrimmingProgress(prev => ({
          ...prev,
          status: 'partial',
          mergeStatus: 'failed',
          message: `⚠️ Retry complete but merge failed: ${error.message}`
        }));
      }
    }
  };

  // STEP 1: Simple Cut - Only cut videos without merge
  const handleSimpleCut = async () => {
    // Filter videos to cut (same as Trim All Videos)
    const videosToTrim = videoResults.filter(v => 
      v.reviewStatus === 'accepted' && 
      v.status === 'success' && 
      v.videoUrl
    );
    
    if (videosToTrim.length === 0) {
      toast.error('Nu există videouri pentru tăiere!');
      setIsTrimmingModalOpen(false);
      return;
    }
    
    // Validate that all videos have START and END locked
    const unlockedVideos = videosToTrim.filter(v => 
      !v.isStartLocked || !v.isEndLocked
    );
    
    if (unlockedVideos.length > 0) {
      const unlockedNames = unlockedVideos.map(v => v.videoName).join('\n');
      
      toast.error(
        `❌ Următoarele videouri nu sunt locked:\n\n${unlockedNames}\n\nTe rog să blochezi START și END pentru toate videourile înainte de trimming!`,
        { duration: 8000 }
      );
      setIsTrimmingModalOpen(false);
      return;
    }
    
    console.log('[Simple Cut] Starting batch process for', videosToTrim.length, 'videos (10 per batch, 58s wait)');
    
    // SIMPLE BATCH PROCESSING: 10 at once → wait 58s → next 10 → wait 58s → rest
    const BATCH_SIZE = 10;
    const DELAY_BETWEEN_BATCHES = 58000; // 58 seconds
    
    // Open modal immediately
    setIsTrimmingModalOpen(true);
    
    // Calculate total batches
    const totalBatches = Math.ceil(videosToTrim.length / BATCH_SIZE);
    
    // Calculate total FFmpeg requests
    const videosWithCleanVoice = videosToTrim.filter(v => v.cleanvoiceAudioUrl).length;
    const videosWithoutCleanVoice = videosToTrim.length - videosWithCleanVoice;
    const totalFFmpegRequests = 1 + (videosWithCleanVoice * 4) + (videosWithoutCleanVoice * 3);
    
    console.log('[Simple Cut] 📊 FFmpeg requests calculation:', {
      total: totalFFmpegRequests,
      directory: 1,
      withCleanVoice: videosWithCleanVoice,
      withoutCleanVoice: videosWithoutCleanVoice
    });
    
    setTrimmingProgress({
      current: 0,
      total: videosToTrim.length,
      currentVideo: '',
      status: 'processing',
      message: `Starting batch processing (${totalBatches} batches)...`,
      successVideos: [],
      failedVideos: [],
      inProgressVideos: [],
      currentBatch: 0,
      totalBatches,
      batchSize: BATCH_SIZE,
      mergeStatus: 'idle',
      ffmpegRequestsCurrent: 0,
      ffmpegRequestsTotal: totalFFmpegRequests,
      countdown: 0,
      cuttingCurrent: 0,
      cuttingTotal: videosToTrim.length,
      mergingCurrent: 0,
      mergingTotal: 0,
      mergedVideos: []
    });
    
    // Create shared directory for ALL videos in this batch
    console.log('[Simple Cut] 📁 Creating shared FFmpeg directory...');
    let sharedDirId: string | undefined;
    try {
      const dirResult = await createDirectoryMutation.mutateAsync({
        ffmpegApiKey: localCurrentUser.ffmpegApiKey || ''
      });
      sharedDirId = dirResult.dirId;
      console.log('[Simple Cut] ✅ Shared directory created:', sharedDirId);
      
      // Increment FFmpeg requests counter
      setTrimmingProgress(prev => ({
        ...prev,
        ffmpegRequestsCurrent: prev.ffmpegRequestsCurrent + 1
      }));
    } catch (error) {
      console.error('[Simple Cut] ❌ Failed to create shared directory:', error);
    }
    
    // Process videos in batches
    let currentIndex = 0;
    let batchNumber = 1;
    
    while (currentIndex < videosToTrim.length) {
      const batchEnd = Math.min(currentIndex + BATCH_SIZE, videosToTrim.length);
      const batchVideos = videosToTrim.slice(currentIndex, batchEnd);
      
      console.log(`[Simple Cut] 📦 Batch ${batchNumber}: Processing ${batchVideos.length} videos (${currentIndex + 1}-${batchEnd})...`);
      
      // Update batch progress
      setTrimmingProgress(prev => ({
        ...prev,
        currentBatch: batchNumber,
        message: `📦 Batch ${batchNumber}/${totalBatches}: Cutting ${batchVideos.length} videos...`
      }));
      
      // Process all videos in this batch IN PARALLEL
      const batchPromises = batchVideos.map(async (video) => {
        const videoIndex = videosToTrim.indexOf(video);
        
        // Update progress: add to in-progress list
        setTrimmingProgress(prev => ({
          ...prev,
          inProgressVideos: [...prev.inProgressVideos, { name: video.videoName }]
        }));
        
        try {
          const trimStart = video.cutPoints?.startKeep || 0;
          const trimEnd = video.cutPoints?.endKeep || 0;
          
          console.log(`[Simple Cut] Processing ${video.videoName} (${videoIndex + 1}/${videosToTrim.length})`);
          
          const result = await cutVideoMutation.mutateAsync({
            userId: localCurrentUser.id,
            videoUrl: video.videoUrl!,
            videoName: video.videoName,
            startTimeMs: trimStart,
            endTimeMs: trimEnd,
            ffmpegApiKey: localCurrentUser.ffmpegApiKey || '',
            cleanVoiceAudioUrl: video.cleanvoiceAudioUrl || null,
            dirId: sharedDirId,
          });
          
          if (!result.success || !result.downloadUrl) {
            throw new Error('Failed to trim video');
          }
          
          // Update videoResults with trimmed URL
          setVideoResults(prev => prev.map(v =>
            v.videoName === video.videoName
              ? { 
                  ...v, 
                  trimmedVideoUrl: result.downloadUrl,
                  recutStatus: 'accepted'
                }
              : v
          ));
          
          // SUCCESS - SAVE TO DATABASE IMMEDIATELY
          console.log(`[Simple Cut] ✅ ${video.videoName} SUCCESS - Saving to database...`);
          
          try {
            // Get current videoResults state
            const currentVideoResults = await new Promise<typeof videoResults>((resolve) => {
              setVideoResults(current => {
                resolve(current);
                return current;
              });
            });
            
            await upsertContextSessionMutation.mutateAsync({
              userId: localCurrentUser.id,
              tamId: selectedTamId,
              coreBeliefId: selectedCoreBeliefId,
              emotionalAngleId: selectedEmotionalAngleId,
              adId: selectedAdId,
              characterId: selectedCharacterId,
              currentStep,
              rawTextAd,
              processedTextAd,
              adLines,
              prompts,
              images,
              combinations,
              deletedCombinations,
              videoResults: currentVideoResults,
              reviewHistory,
              hookMergedVideos,
              bodyMergedVideoUrl,
              finalVideos,
            });
            
            console.log(`[Simple Cut] 💾 ${video.videoName} saved to database`);
          } catch (dbError: any) {
            console.error(`[Simple Cut] ❌ Database save failed for ${video.videoName}:`, dbError);
            // Continue processing even if DB save fails
          }
          
          // Calculate FFmpeg requests for this video
          const ffmpegRequestsForVideo = video.cleanvoiceAudioUrl ? 3 : 2;
          
          setTrimmingProgress(prev => ({
            ...prev,
            current: prev.current + 1,
            cuttingCurrent: prev.cuttingCurrent + 1,
            successVideos: [...prev.successVideos, { name: video.videoName }],
            inProgressVideos: prev.inProgressVideos.filter(v => v.name !== video.videoName),
            ffmpegRequestsCurrent: prev.ffmpegRequestsCurrent + ffmpegRequestsForVideo
          }));
          
          return { video, status: 'success' };
          
        } catch (error: any) {
          // FAILED
          console.error(`[Simple Cut] ❌ ${video.videoName} FAILED:`, error);
          
          // Update videoResults with failed status
          setVideoResults(prev => prev.map(v =>
            v.videoName === video.videoName
              ? { 
                  ...v, 
                  status: 'failed' as const,
                  error: error.message || 'Unknown error'
                }
              : v
          ));
          
          // Save failed status to database
          try {
            const currentVideoResults = await new Promise<typeof videoResults>((resolve) => {
              setVideoResults(current => {
                resolve(current);
                return current;
              });
            });
            
            await upsertContextSessionMutation.mutateAsync({
              userId: localCurrentUser.id,
              tamId: selectedTamId,
              coreBeliefId: selectedCoreBeliefId,
              emotionalAngleId: selectedEmotionalAngleId,
              adId: selectedAdId,
              characterId: selectedCharacterId,
              currentStep,
              rawTextAd,
              processedTextAd,
              adLines,
              prompts,
              images,
              combinations,
              deletedCombinations,
              videoResults: currentVideoResults,
              reviewHistory,
              hookMergedVideos,
              bodyMergedVideoUrl,
              finalVideos,
            });
            
            console.log(`[Simple Cut] 💾 ${video.videoName} failed status saved to database`);
          } catch (dbError: any) {
            console.error(`[Simple Cut] ❌ Database save failed for ${video.videoName}:`, dbError);
            // Continue processing even if DB save fails
          }
          
          setTrimmingProgress(prev => ({
            ...prev,
            current: prev.current + 1,
            failedVideos: [...prev.failedVideos, {
              name: video.videoName,
              error: error.message || 'Unknown error',
              retries: 0
            }],
            inProgressVideos: prev.inProgressVideos.filter(v => v.name !== video.videoName)
          }));
          
          return { video, status: 'failed', error: error.message };
        }
      });
      
      // Wait for ALL videos in this batch to complete
      await Promise.all(batchPromises);
      
      console.log(`[Simple Cut] ✅ Batch ${batchNumber} complete!`);
      
      // Move to next batch
      currentIndex = batchEnd;
      batchNumber++;
      
      // Wait 58s before next batch (if there are more videos)
      if (currentIndex < videosToTrim.length) {
        console.log(`[Simple Cut] ⏳ Waiting 58 seconds before batch ${batchNumber}...`);
        
        // Countdown timer: 58s → 57s → 56s → ... → 1s
        for (let countdown = 58; countdown > 0; countdown--) {
          setTrimmingProgress(prev => ({
            ...prev,
            message: `⏳ Waiting ${countdown}s before next batch (FFmpeg rate limit)...`,
            status: 'processing',
            countdown: countdown
          }));
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // Reset countdown after delay
        setTrimmingProgress(prev => ({
          ...prev,
          countdown: 0
        }));
      }
    }
    
    console.log('[Simple Cut] 🎉 All batches processed!');
    
    // Get final counts from state
    setTrimmingProgress(prev => {
      const successCount = prev.successVideos.length;
      const failCount = prev.failedVideos.length;
      const finalStatus = failCount > 0 ? 'partial' : 'complete';
      
      console.log(`[Simple Cut] 🎉 COMPLETE! Success: ${successCount}, Failed: ${failCount}`);
      
      return {
        ...prev,
        status: finalStatus,
        message: failCount > 0 
          ? `⚠️ ${successCount} succeeded, ${failCount} failed`
          : `✅ All ${successCount} videos cut successfully!`
      };
    });
  };

// STEP 2: Prepare for Merge - NEW SIMPLE LOGIC
// 1 batch = max 10 FINAL VIDEOS (regardless of input count)
// BODY = 1 final video, each HOOK group = 1 final video
const handlePrepareForMerge = async () => {
  console.log('[STEP 2] 🚀 Starting NEW merge process...');
  
  // 1. Filter trimmed videos
  const trimmedVideos = videoResults.filter(v => 
    v.trimmedVideoUrl &&
    v.reviewStatus === 'accepted' && 
    v.status === 'success'
  );
  
  if (trimmedVideos.length === 0) {
    toast.error('No trimmed videos to merge!');
    setIsMergingStep10(false);
    return;
  }
  
  console.log('[STEP 2] 📋 Trimmed videos:', trimmedVideos.length);
  
  // 2. Separate BODY and HOOKS
  const bodyVideos = trimmedVideos.filter(v => !v.videoName.match(/HOOK\d+[A-Z]?/));
  const hookVideos = trimmedVideos.filter(v => v.videoName.match(/HOOK\d+[A-Z]?/));
  
  // 3. Group HOOKS by base name
  const hookGroups: Record<string, typeof hookVideos> = {};
  hookVideos.forEach(video => {
    const hookMatch = video.videoName.match(/(.*)(HOOK\d+)[A-Z]?(.*)/);
    if (hookMatch) {
      const prefix = hookMatch[1];
      const hookBase = hookMatch[2];
      const suffix = hookMatch[3];
      const groupKey = `${prefix}${hookBase}${suffix}`;
      
      if (!hookGroups[groupKey]) {
        hookGroups[groupKey] = [];
      }
      hookGroups[groupKey].push(video);
    }
  });
  
  const hookGroupsToMerge = Object.entries(hookGroups).filter(([_, videos]) => videos.length > 1);
  
  console.log('[STEP 2] 📺 BODY videos:', bodyVideos.length);
  console.log('[STEP 2] 🎣 HOOK groups:', hookGroupsToMerge.length);
  
  // 4. Create list of ALL merge tasks (BODY + HOOKS)
  interface MergeTask {
    type: 'body' | 'hook';
    name: string;
    videos: typeof trimmedVideos;
  }
  
  const mergeTasks: MergeTask[] = [];
  
  // Add BODY task (if exists)
  if (bodyVideos.length > 0) {
    mergeTasks.push({
      type: 'body',
      name: 'BODY',
      videos: bodyVideos
    });
  }
  
  // Add HOOK tasks
  hookGroupsToMerge.forEach(([baseName, videos]) => {
    mergeTasks.push({
      type: 'hook',
      name: baseName,
      videos
    });
  });
  
  const totalFinalVideos = mergeTasks.length;
  console.log('[STEP 2] 📊 Total final videos to create:', totalFinalVideos);
  
  if (totalFinalVideos === 0) {
    toast.info('No videos need merging!');
    setIsMergingStep10(false);
    return;
  }
  
  // 5. Create batches (max 10 final videos per batch)
  const MAX_FINAL_VIDEOS_PER_BATCH = 10;
  const batches: MergeTask[][] = [];
  
  for (let i = 0; i < mergeTasks.length; i += MAX_FINAL_VIDEOS_PER_BATCH) {
    batches.push(mergeTasks.slice(i, i + MAX_FINAL_VIDEOS_PER_BATCH));
  }
  
  console.log('[STEP 2] 📦 Batches:', batches.length);
  batches.forEach((batch, idx) => {
    console.log(`  Batch ${idx + 1}: ${batch.length} final videos (${batch.map(t => t.name).join(', ')})`);
  });
  
  // 6. Initialize progress
  setMergeStep10Progress({
    status: 'countdown',
    message: 'Waiting 60s before starting...',
    countdown: 60,
    totalFinalVideos,
    currentFinalVideo: 0,
    currentBatch: 0,
    totalBatches: batches.length,
    hooksSuccess: [],
    hooksFailed: [],
    hooksInProgress: [],
    bodySuccess: [],
    bodyFailed: [],
    bodyInProgress: [],
    onSkipCountdown: undefined // Will be set below
  });
  
  // 7. INITIAL COUNTDOWN: 60s with Skip button
  console.log('[STEP 2] ⏳ Initial countdown 60s...');
  let skipCountdown = false;
  
  setMergeStep10Progress(prev => ({
    ...prev,
    onSkipCountdown: () => {
      console.log('[STEP 2] ⏩ User skipped countdown!');
      skipCountdown = true;
    }
  }));
  
  for (let countdown = 60; countdown > 0; countdown--) {
    if (skipCountdown) {
      console.log('[STEP 2] ⏩ Countdown skipped!');
      break;
    }
    
    setMergeStep10Progress(prev => ({
      ...prev,
      countdown,
      message: `Waiting ${countdown}s before starting...`
    }));
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Clear countdown
  setMergeStep10Progress(prev => ({
    ...prev,
    status: 'processing',
    countdown: 0,
    onSkipCountdown: undefined,
    message: 'Starting merge process...'
  }));
  
  console.log('[STEP 2] 🚀 Starting merge...');
  
  // 8. Process batches sequentially
  try {
    for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
      const batch = batches[batchIdx];
      const batchNum = batchIdx + 1;
      
      console.log(`[STEP 2] 📦 Processing batch ${batchNum}/${batches.length} (${batch.length} final videos)...`);
      
      setMergeStep10Progress(prev => ({
        ...prev,
        currentBatch: batchNum,
        message: `Processing batch ${batchNum}/${batches.length}...`
      }));
      
      // Process all tasks in this batch in parallel
      const batchPromises = batch.map(async (task) => {
        console.log(`[STEP 2] 🔄 Merging ${task.name} (${task.videos.length} videos)...`);
        
        // Add to in-progress
        setMergeStep10Progress(prev => ({
          ...prev,
          hooksInProgress: task.type === 'hook' ? [...prev.hooksInProgress, { name: task.name }] : prev.hooksInProgress,
          bodyInProgress: task.type === 'body' ? [...prev.bodyInProgress, { name: task.name }] : prev.bodyInProgress
        }));
        
        try {
          const videoUrls = task.videos.map(v => v.trimmedVideoUrl!).filter(Boolean);
          
          console.log(`[STEP 2] 📹 ${task.name} URLs:`, videoUrls);
          
          // Call merge API
          const result = await mergeVideosMutation.mutateAsync({
            videoUrls,
            outputVideoName: task.name,
            ffmpegApiKey: localCurrentUser.ffmpegApiKey || '',
            addTextOverlay: false,
            userId: localCurrentUser.id,
          });
          
          console.log(`[STEP 2] ✅ ${task.name} SUCCESS:`, result.cdnUrl);
          
          // Move from in-progress to success
          setMergeStep10Progress(prev => ({
            ...prev,
            hooksSuccess: task.type === 'hook' 
              ? [...prev.hooksSuccess, { name: task.name, videoCount: task.videos.length, videoNames: task.videos.map(v => v.videoName) }]
              : prev.hooksSuccess,
            hooksInProgress: task.type === 'hook' 
              ? prev.hooksInProgress.filter(h => h.name !== task.name)
              : prev.hooksInProgress,
            bodySuccess: task.type === 'body' 
              ? [...prev.bodySuccess, { name: task.name }]
              : prev.bodySuccess,
            bodyInProgress: task.type === 'body' 
              ? prev.bodyInProgress.filter(b => b.name !== task.name)
              : prev.bodyInProgress,
            currentFinalVideo: prev.currentFinalVideo + 1
          }));
          
          // Note: Results are saved to database at the end via upsertContextSessionMutation
          console.log(`[STEP 2] 💾 ${task.name} result stored in state (will be saved to DB at end)`);
          
          return { task, status: 'success', url: result.cdnUrl };
          
        } catch (error: any) {
          console.error(`[STEP 2] ❌ ${task.name} FAILED:`, error);
          
          // Move from in-progress to failed
          setMergeStep10Progress(prev => ({
            ...prev,
            hooksFailed: task.type === 'hook' 
              ? [...prev.hooksFailed, { name: task.name, error: error.message }]
              : prev.hooksFailed,
            hooksInProgress: task.type === 'hook' 
              ? prev.hooksInProgress.filter(h => h.name !== task.name)
              : prev.hooksInProgress,
            bodyFailed: task.type === 'body' 
              ? [...prev.bodyFailed, { name: task.name, error: error.message }]
              : prev.bodyFailed,
            bodyInProgress: task.type === 'body' 
              ? prev.bodyInProgress.filter(b => b.name !== task.name)
              : prev.bodyInProgress,
            currentFinalVideo: prev.currentFinalVideo + 1
          }));
          
          return { task, status: 'failed', error: error.message };
        }
      });
      
      await Promise.all(batchPromises);
      
      // Wait 60s AFTER batch (except last batch)
      if (batchIdx < batches.length - 1) {
        console.log(`[STEP 2] ⏳ Waiting 60s after batch ${batchNum}...`);
        for (let countdown = 60; countdown >= 0; countdown--) {
          setMergeStep10Progress(prev => ({
            ...prev,
            message: `⏳ Waiting ${countdown}s before next batch...`,
            countdown
          }));
          if (countdown > 0) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
        console.log(`[STEP 2] ✅ Wait complete, starting next batch...`);
      }
    }
    
    // Complete
    const failedCount = mergeStep10Progress.hooksFailed.length + mergeStep10Progress.bodyFailed.length;
    setMergeStep10Progress(prev => ({
      ...prev,
      status: failedCount === 0 ? 'complete' : 'partial',
      message: failedCount === 0 
        ? `✅ All ${totalFinalVideos} merges complete!`
        : `⚠️ ${totalFinalVideos - failedCount}/${totalFinalVideos} merges complete (${failedCount} failed)`
    }));
    
    console.log('[STEP 2] 🎉 COMPLETE!');
    
    if (failedCount === 0) {
      toast.success(`✅ All ${totalFinalVideos} merges completed!`);
    } else {
      toast.warning(`⚠️ ${failedCount} merges failed`);
    }
    
  } catch (error: any) {
    console.error('[STEP 2] ❌ Fatal error:', error);
    
    setMergeStep10Progress(prev => ({
      ...prev,
      status: 'error',
      message: `Fatal Error: ${error.message}`
    }));
    toast.error(`Merge failed: ${error.message}`);
  }
};
  // Retry failed merge items
  const handleRetryFailedMerge = async () => {
    const failedItems = mergeStep10Progress.failedItems || [];
    
    if (failedItems.length === 0) {
      toast.info('No failed items to retry!');
      return;
    }
    
    console.log('[Retry Failed Merge] 🔄 Retrying', failedItems.length, 'failed items...');
    
    // Filter trimmed videos again
    const trimmedVideos = videoResults.filter(v => 
      v.trimmedVideoUrl &&
      v.reviewStatus === 'accepted' && 
      v.status === 'success'
    );
    
    // Reset progress and tracking arrays
    setMergeStep10Progress(prev => ({
      ...prev,
      status: 'processing',
      message: `Retrying ${failedItems.length} failed items...`,
      failedItems: [],
      bodySuccessVideos: [],
      bodyFailedVideos: [],
      bodyInProgressVideos: [],
      hookSuccessGroups: [],
      hookFailedGroups: [],
      hookInProgressGroups: []
    }));
    
    try {
      // Separate failed items by type
      const bodyChunkFailures = failedItems.filter(item => item.type === 'body_chunk');
      const bodyFinalFailures = failedItems.filter(item => item.type === 'body_final');
      const hookFailures = failedItems.filter(item => item.type === 'hook');
      
      console.log('[Retry] Body chunks:', bodyChunkFailures.length);
      console.log('[Retry] Body final:', bodyFinalFailures.length);
      console.log('[Retry] Hooks:', hookFailures.length);
      
      // RETRY BODY CHUNKS
      if (bodyChunkFailures.length > 0 || bodyFinalFailures.length > 0) {
        console.log('[Retry] 📺 Retrying BODY...');
        
        const bodyVideos = trimmedVideos.filter(v => !v.videoName.match(/HOOK\d+[A-Z]?/));
        const CHUNK_SIZE = 7;
        const bodyChunks: typeof bodyVideos[] = [];
        
        for (let i = 0; i < bodyVideos.length; i += CHUNK_SIZE) {
          bodyChunks.push(bodyVideos.slice(i, i + CHUNK_SIZE));
        }
        
        const chunkUrls: string[] = [];
        
        // Retry failed chunks
        for (const failure of bodyChunkFailures) {
          const chunkNum = parseInt(failure.name.replace('Chunk ', ''));
          const chunk = bodyChunks[chunkNum - 1];
          
          if (!chunk) {
            console.error('[Retry] Chunk not found:', chunkNum);
            continue;
          }
          
          console.log(`[Retry] 📦 Retrying chunk ${chunkNum}...`);
          
          setMergeStep10Progress(prev => ({
            ...prev,
            message: `📺 BODY: Retrying Chunk ${chunkNum}/${bodyChunks.length}...`
          }));
          
          try {
            const extractOriginalUrl = (url: string) => {
              if (url.startsWith('/api/proxy-video?url=')) {
                const urlParam = new URLSearchParams(url.split('?')[1]).get('url');
                return urlParam ? decodeURIComponent(urlParam) : url;
              }
              return url;
            };
            
            const chunkVideoUrls = chunk.map(v => extractOriginalUrl(v.trimmedVideoUrl!)).filter(Boolean);
            const chunkOutputName = `BODY_CHUNK_${chunkNum}_${Date.now()}`;
            
            const result = await mergeVideosMutation.mutateAsync({
              videoUrls: chunkVideoUrls,
              outputVideoName: chunkOutputName,
              ffmpegApiKey: localCurrentUser.ffmpegApiKey || '',
              userId: localCurrentUser.id,
            });
            
            console.log(`[Retry] ✅ Chunk ${chunkNum} SUCCESS:`, result.cdnUrl);
            chunkUrls.push(result.cdnUrl);
            
            setMergeStep10Progress(prev => ({
              ...prev,
              bodyInfo: prev.bodyInfo ? {
                ...prev.bodyInfo,
                chunkResults: prev.bodyInfo.chunkResults.map(cr => 
                  cr.chunkNum === chunkNum 
                    ? { ...cr, status: 'success', url: result.cdnUrl, error: undefined }
                    : cr
                )
              } : null,
              bodySuccessVideos: [
                ...(prev.bodySuccessVideos || []),
                ...chunk.map(v => ({ name: v.videoName, chunkNum }))
              ],
              bodyFailedVideos: (prev.bodyFailedVideos || []).filter(fv => 
                !chunk.some(cv => cv.videoName === fv.name)
              )
            }));
            
            // Wait 60s before next operation
            console.log(`[Retry] ⏳ Waiting 60s...`);
            for (let countdown = 60; countdown > 0; countdown--) {
              setMergeStep10Progress(prev => ({
                ...prev,
                message: `⏳ FFmpeg rate limit: waiting ${countdown}s...`,
                countdown
              }));
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
          } catch (error: any) {
            console.error(`[Retry] ❌ Chunk ${chunkNum} FAILED AGAIN:`, error);
            
            setMergeStep10Progress(prev => ({
              ...prev,
              failedItems: [
                ...(prev.failedItems || []),
                { type: 'body_chunk', name: `Chunk ${chunkNum}`, error: error.message }
              ],
              bodyFailedVideos: [
                ...(prev.bodyFailedVideos || []),
                ...chunk.map(v => {
                  const existingFail = (prev.bodyFailedVideos || []).find(fv => fv.name === v.videoName);
                  return {
                    name: v.videoName,
                    chunkNum,
                    error: error.message,
                    retries: (existingFail?.retries || 0) + 1
                  };
                })
              ]
            }));
          }
        }
        
        // Retry final merge if needed
        if (bodyFinalFailures.length > 0 || chunkUrls.length > 0) {
          console.log('[Retry] 🔄 Retrying BODY final merge...');
          
          // Get all successful chunk URLs
          const allChunkUrls = mergeStep10Progress.bodyInfo?.chunkResults
            .filter(cr => cr.status === 'success' && cr.url)
            .map(cr => cr.url!) || [];
          
          if (allChunkUrls.length > 1) {
            setMergeStep10Progress(prev => ({
              ...prev,
              message: `📺 BODY: Final merge (${allChunkUrls.length} chunks)...`
            }));
            
            try {
              const firstVideoName = bodyVideos[0].videoName;
              const contextMatch = firstVideoName.match(/^(T\d+_C\d+_E\d+_AD\d+)/);
              const contextName = contextMatch ? contextMatch[1] : 'MERGED';
              
              const nameMatch = firstVideoName.match(/_([ A-Z]+)_([A-Z]+_\d+)$/);
              const character = nameMatch ? nameMatch[1] : 'TEST';
              const imageName = nameMatch ? nameMatch[2] : 'ALINA_1';
              
              const outputName = `${contextName}_BODY_${character}_${imageName}`;
              
              const result = await mergeVideosMutation.mutateAsync({
                videoUrls: allChunkUrls,
                outputVideoName: outputName,
                ffmpegApiKey: localCurrentUser.ffmpegApiKey || '',
                userId: localCurrentUser.id,
              });
              
              console.log('[Retry] ✅ BODY FINAL SUCCESS:', result.cdnUrl);
              
              setMergeStep10Progress(prev => ({
                ...prev,
                bodyInfo: prev.bodyInfo ? {
                  ...prev.bodyInfo,
                  finalUrl: result.cdnUrl,
                  status: 'success'
                } : null
              }));
              
              // Save to database
              setBodyMergedVideoUrl(result.cdnUrl);
              
              const currentBodyMergedVideoUrl = await new Promise<string>((resolve) => {
                setBodyMergedVideoUrl(current => {
                  resolve(current);
                  return current;
                });
              });
              
              await upsertContextSessionMutation.mutateAsync({
                userId: localCurrentUser.id,
                tamId: selectedTamId,
                coreBeliefId: selectedCoreBeliefId!,
                emotionalAngleId: selectedEmotionalAngleId!,
                adId: selectedAdId!,
                characterId: selectedCharacterId!,
                currentStep,
                rawTextAd,
                processedTextAd,
                adLines,
                prompts,
                images,
                combinations,
                deletedCombinations,
                videoResults,
                reviewHistory,
                hookMergedVideos,
                bodyMergedVideoUrl: currentBodyMergedVideoUrl,
              });
              
              console.log('[Retry] 💾 BODY saved to database');
              
            } catch (error: any) {
              console.error('[Retry] ❌ BODY FINAL FAILED AGAIN:', error);
              
              setMergeStep10Progress(prev => ({
                ...prev,
                bodyInfo: prev.bodyInfo ? {
                  ...prev.bodyInfo,
                  status: 'failed'
                } : null,
                failedItems: [
                  ...(prev.failedItems || []),
                  { type: 'body_final', name: 'BODY Final Merge', error: error.message }
                ]
              }));
            }
          }
        }
      }
      
      // RETRY HOOKS
      if (hookFailures.length > 0) {
        console.log(`[Retry] 🎣 Retrying ${hookFailures.length} hooks...`);
        
        // Wait 60s before hooks
        console.log(`[Retry] ⏳ Waiting 60s before hooks...`);
        for (let countdown = 60; countdown > 0; countdown--) {
          setMergeStep10Progress(prev => ({
            ...prev,
            message: `⏳ FFmpeg rate limit: waiting ${countdown}s before hooks...`,
            countdown
          }));
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        setMergeStep10Progress(prev => ({
          ...prev,
          message: `🎣 Retrying ${hookFailures.length} hook groups...`
        }));
        
        const hookVideos = trimmedVideos.filter(v => v.videoName.match(/HOOK\d+[A-Z]?/));
        const hookGroups: Record<string, typeof hookVideos> = {};
        
        hookVideos.forEach(video => {
          const hookMatch = video.videoName.match(/(.*)(HOOK\d+)[A-Z]?(.*)/);
          if (hookMatch) {
            const prefix = hookMatch[1];
            const hookBase = hookMatch[2];
            const suffix = hookMatch[3];
            const groupKey = `${prefix}${hookBase}${suffix}`;
            
            if (!hookGroups[groupKey]) {
              hookGroups[groupKey] = [];
            }
            hookGroups[groupKey].push(video);
          }
        });
        
        // Process failed hooks in parallel
        const hookPromises = hookFailures.map(async (failure) => {
          const baseName = failure.name;
          const videos = hookGroups[baseName];
          
          if (!videos || videos.length === 0) {
            console.error('[Retry] Hook group not found:', baseName);
            return;
          }
          
          console.log(`[Retry] 🎣 Retrying ${baseName} (${videos.length} videos)...`);
          
          setMergeStep10Progress(prev => ({
            ...prev,
            hookGroups: prev.hookGroups?.map(g => 
              g.baseName === baseName ? { ...g, status: 'processing' } : g
            )
          }));
          
          try {
            const sortedVideos = videos.sort((a, b) => a.videoName.localeCompare(b.videoName));
            
            const extractOriginalUrl = (url: string) => {
              if (url.startsWith('/api/proxy-video?url=')) {
                const urlParam = new URLSearchParams(url.split('?')[1]).get('url');
                return urlParam ? decodeURIComponent(urlParam) : url;
              }
              return url;
            };
            
            const videoUrls = sortedVideos.map(v => extractOriginalUrl(v.trimmedVideoUrl!)).filter(Boolean);
            const outputName = baseName.replace(/(HOOK\d+)/, '$1M');
            
            const result = await mergeVideosMutation.mutateAsync({
              videoUrls,
              outputVideoName: outputName,
              ffmpegApiKey: localCurrentUser.ffmpegApiKey || '',
              userId: localCurrentUser.id,
            });
            
            console.log(`[Retry] ✅ ${baseName} SUCCESS:`, result.cdnUrl);
            
            setMergeStep10Progress(prev => ({
              ...prev,
              hookGroups: prev.hookGroups?.map(g => 
                g.baseName === baseName 
                  ? { ...g, status: 'success', cdnUrl: result.cdnUrl, error: null } 
                  : g
              ),
              hookSuccessGroups: [
                ...(prev.hookSuccessGroups || []),
                { baseName, videoCount: videos.length, videoNames: videos.map(v => v.videoName), batchNum: 0 }
              ],
              hookFailedGroups: (prev.hookFailedGroups || []).filter(fg => fg.baseName !== baseName),
              hooksCurrent: (prev.hooksCurrent || 0) + 1
            }));
            
            // Save hook to local state
            setHookMergedVideos(prev => ({ ...prev, [baseName]: result.cdnUrl }));
            
            const currentHookMergedVideos = await new Promise<typeof hookMergedVideos>((resolve) => {
              setHookMergedVideos(current => {
                resolve(current);
                return current;
              });
            });
            
            // Save to database
            await upsertContextSessionMutation.mutateAsync({
              userId: localCurrentUser.id,
              tamId: selectedTamId,
              coreBeliefId: selectedCoreBeliefId!,
              emotionalAngleId: selectedEmotionalAngleId!,
              adId: selectedAdId!,
              characterId: selectedCharacterId!,
              currentStep,
              rawTextAd,
              processedTextAd,
              adLines,
              prompts,
              images,
              combinations,
              deletedCombinations,
              videoResults,
              reviewHistory,
              hookMergedVideos: currentHookMergedVideos,
              bodyMergedVideoUrl,
            });
            
            console.log(`[Retry] 💾 ${baseName} saved to database`);
            
          } catch (error: any) {
            console.error(`[Retry] ❌ ${baseName} FAILED AGAIN:`, error);
            
            setMergeStep10Progress(prev => ({
              ...prev,
              hookGroups: prev.hookGroups?.map(g => 
                g.baseName === baseName 
                  ? { ...g, status: 'failed', error: error.message } 
                  : g
              ),
              hookFailedGroups: [
                ...(prev.hookFailedGroups || []).filter(fg => fg.baseName !== baseName),
                {
                  baseName,
                  videoCount: videos.length,
                  error: error.message,
                  retries: ((prev.hookFailedGroups || []).find(fg => fg.baseName === baseName)?.retries || 0) + 1,
                  batchNum: 0
                }
              ],
              failedItems: [
                ...(prev.failedItems || []),
                { type: 'hook', name: baseName, error: error.message }
              ]
            }));
          }
        });
        
        await Promise.all(hookPromises);
      }
      
      // Final status
      const finalFailedCount = (mergeStep10Progress.failedItems?.length || 0);
      
      setMergeStep10Progress(prev => ({
        ...prev,
        status: finalFailedCount > 0 ? 'partial' : 'complete',
        message: finalFailedCount > 0 
          ? `⚠️ Retry complete: ${failedItems.length - finalFailedCount} succeeded, ${finalFailedCount} still failed`
          : `✅ All ${failedItems.length} retries succeeded!`
      }));
      
      if (finalFailedCount === 0) {
        toast.success(`✅ All ${failedItems.length} retries succeeded!`);
      } else {
        toast.warning(`⚠️ ${failedItems.length - finalFailedCount} succeeded, ${finalFailedCount} still failed`);
      }
      
    } catch (error: any) {
      console.error('[Retry] ❌ Fatal error:', error);
      setMergeStep10Progress(prev => ({
        ...prev,
        status: 'error',
        message: `Error: ${error.message}`
      }));
      toast.error(`Retry failed: ${error.message}`);
    }
  };

  // Step 4: Create mappings
  const createMappings = () => {
    if (adLines.length === 0) {
      toast.error("Te rog încarcă documentul cu ad-ul mai întâi");
      return;
    }
    if (images.length === 0) {
      toast.error("Te rog încarcă cel puțin o imagine");
      return;
    }
    // Prompturile hardcodate sunt întotdeauna active, nu mai verificăm prompts.length

    // Găsește poza CTA (dacă există) - verifică dacă fileName conține 'CTA'
    const ctaImage = images.find(img => 
      img.fileName?.toUpperCase().includes('CTA') || 
      img.imageName?.toUpperCase().includes('CTA')
    );
    // Default image = prima imagine care NU conține CTA (sau prima imagine dacă toate sunt CTA)
    const defaultImage = images.find(img => 
      !img.fileName?.toUpperCase().includes('CTA') && 
      !img.imageName?.toUpperCase().includes('CTA')
    ) || images[0];
    
    console.log('[CTA Mapping] Images:', images.map(img => ({ fileName: img.fileName, hasCTA: img.fileName?.toUpperCase().includes('CTA') })));
    console.log('[CTA Mapping] CTA Image found:', ctaImage ? ctaImage.fileName : 'NONE');
    console.log('[CTA Mapping] Default Image:', defaultImage ? defaultImage.fileName : 'NONE');
    
    // Filter out labels (categoryNumber === 0) - only use actual text lines
    const textLines = adLines.filter(line => line.categoryNumber > 0);
    
    // Găsește prima linie care conține cuvintele cheie CTA
    const ctaKeywords = ['rescrie', 'cartea', 'carte', 'lacrimi'];
    let firstCTAKeywordIndex = -1;
    
    for (let i = 0; i < textLines.length; i++) {
      const lowerText = textLines[i].text.toLowerCase();
      const hasKeyword = ctaKeywords.some(keyword => lowerText.includes(keyword));
      
      console.log(`[CTA Mapping] Checking line ${i}: section="${textLines[i].section}", text="${textLines[i].text.substring(0, 40)}...", hasKeyword=${hasKeyword}`);
      
      if (hasKeyword) {
        firstCTAKeywordIndex = i;
        console.log(`[CTA Mapping] FOUND! First line with CTA keywords at index ${i}`);
        break;
      }
    }
    
    console.log('[CTA Mapping] First CTA keyword index:', firstCTAKeywordIndex);
    console.log('[CTA Mapping] Total text lines:', textLines.length);
    
    // Log all sections for debugging
    console.log('[CTA Mapping] All sections:', textLines.map((l, i) => `${i}: ${l.section}`).join(', '));
    
    // Creează combinații cu mapare simplificată:
    // - DOAR secțiunea CTA primește imagine CTA
    // - După ce se mapează CTA, toate liniile de jos până la sfârșit primesc aceeași imagine CTA
    // - Restul categoriilor primesc default image
    const newCombinations: Combination[] = textLines.map((line, index) => {
      let selectedImage = defaultImage;
      
      // DOAR dacă există poză CTA ȘI există linie cu keywords CTA ȘI suntem de la prima linie cu keywords până la sfârșit
      const shouldUseCTA = ctaImage && firstCTAKeywordIndex !== -1 && index >= firstCTAKeywordIndex;
      
      console.log(`[CTA Mapping] Line ${index}:`);
      console.log(`  - Section: "${line.section}"`);
      console.log(`  - Text: "${line.text.substring(0, 50)}..."`);
      console.log(`  - firstCTAKeywordIndex: ${firstCTAKeywordIndex}`);
      console.log(`  - index >= firstCTAKeywordIndex: ${index >= firstCTAKeywordIndex}`);
      console.log(`  - shouldUseCTA: ${shouldUseCTA}`);
      
      if (shouldUseCTA) {
        selectedImage = ctaImage;
        console.log(`  - ✅ Using CTA image: ${selectedImage.fileName}`);
      } else {
        console.log(`  - ❌ Using default image: ${selectedImage.fileName}`);
      }
      
      // Extract image name from fileName (e.g., "Alina_1_CTA.png" → "ALINA_1")
      let imageName = '';
      if (selectedImage.fileName) {
        // Remove extension
        const nameWithoutExt = selectedImage.fileName.replace(/\.[^.]+$/, '');
        // Remove "_CTA" or "CTA" suffix (case insensitive)
        imageName = nameWithoutExt.replace(/_?CTA$/i, '').toUpperCase();
      }
      
      // Update videoName to include image name
      const updatedVideoName = imageName ? `${line.videoName}_${imageName}` : line.videoName;
      
      return {
        id: `combo-${index}`,
        text: line.text,
        imageUrl: selectedImage.url,
        imageId: selectedImage.id,
        promptType: line.promptType, // Mapare automată inteligentă
        videoName: updatedVideoName,
        section: line.section,
        categoryNumber: line.categoryNumber,
        redStart: line.redStart,  // Copiază pozițiile red text din AdLine
        redEnd: line.redEnd,
      };
    });

    setCombinations(newCombinations);
    setDeletedCombinations([]);
    
    console.log('[Create Mappings] Created', newCombinations.length, 'combinations from', textLines.length, 'text lines');
    console.log('[Create Mappings] First 3 texts:', textLines.slice(0, 3).map(l => l.text.substring(0, 50)));
    
    // Save to database before moving to Step 5
    if (selectedCoreBeliefId && selectedEmotionalAngleId && selectedAdId && selectedCharacterId) {
      upsertContextSessionMutation.mutate({
        userId: localCurrentUser.id,
        coreBeliefId: selectedCoreBeliefId,
        emotionalAngleId: selectedEmotionalAngleId,
        adId: selectedAdId,
        characterId: selectedCharacterId,
        currentStep: 4,
        rawTextAd,
        processedTextAd,
        adLines,
        prompts,
        images,
        combinations: newCombinations,
        deletedCombinations: [],
        videoResults,
        reviewHistory,
      }, {
        onSuccess: () => {
          console.log('[Step 4] Saved before moving to Step 5');
          setCurrentStep(5); // Go to STEP 5 - Mapping
          
          if (ctaImage && firstCTAIndex !== -1) {
            const ctaLinesCount = textLines.length - firstCTAIndex;
            toast.success(`${newCombinations.length} combinații create. Poza CTA mapata pe secțiunea CTA și toate liniile următoare (${ctaLinesCount} linii)`);
          } else {
            toast.success(`${newCombinations.length} combinații create cu mapare automată`);
          }
        },
        onError: (error) => {
          console.error('[Step 4] Save failed:', error);
          // Still move to next step (don't block user)
          setCurrentStep(5);
          
          if (ctaImage && firstCTAIndex !== -1) {
            const ctaLinesCount = textLines.length - firstCTAIndex;
            toast.success(`${newCombinations.length} combinații create. Poza CTA mapata pe secțiunea CTA și toate liniile următoare (${ctaLinesCount} linii)`);
          } else {
            toast.success(`${newCombinations.length} combinații create cu mapare automată`);
          }
        },
      });
    } else {
      setCurrentStep(5);
      
      if (ctaImage && firstCTAIndex !== -1) {
        const ctaLinesCount = textLines.length - firstCTAIndex;
        toast.success(`${newCombinations.length} combinații create. Poza CTA mapata pe secțiunea CTA și toate liniile următoare (${ctaLinesCount} linii)`);
      } else {
        toast.success(`${newCombinations.length} combinații create cu mapare automată`);
      }
    }
  };

  const updateCombinationPromptType = (id: string, promptType: PromptType) => {
    setCombinations(prev =>
      prev.map(combo =>
        combo.id === id ? { ...combo, promptType } : combo
      )
    );
    
    // Lock system removed
  };

  const updateCombinationText = (id: string, text: string) => {
    setCombinations(prev =>
      prev.map(combo =>
        combo.id === id ? { ...combo, text } : combo
      )
    );
  };

  const updateCombinationImage = (id: string, imageId: string) => {
    const image = images.find(img => img.id === imageId);
    if (image) {
      setCombinations(prev =>
        prev.map(combo =>
          combo.id === id ? { ...combo, imageUrl: image.url, imageId: image.id } : combo
        )
      );
      
      // Lock system removed
    }
  };

  const removeCombination = (id: string) => {
    const combo = combinations.find(c => c.id === id);
    if (combo) {
      const currentIndex = combinations.findIndex(c => c.id === id);
      // Salvează combinația cu indexul original
      setDeletedCombinations(prev => [{ ...combo, originalIndex: currentIndex }, ...prev]);
      setCombinations(prev => prev.filter(c => c.id !== id));
    }
  };

  const undoDelete = () => {
    if (deletedCombinations.length > 0) {
      const lastDeleted = deletedCombinations[0];
      const originalIndex = (lastDeleted as any).originalIndex ?? combinations.length;
      
      // Restaurează la poziția originală
      setCombinations(prev => {
        const newCombinations = [...prev];
        newCombinations.splice(originalIndex, 0, lastDeleted);
        return newCombinations;
      });
      
      setDeletedCombinations(prev => prev.slice(1));
      toast.success("Combinație restaurată la poziția originală");
    }
  };

  // Step 5: Generate videos
  const generateVideos = async () => {
    if (combinations.length === 0) {
      toast.error("Nu există combinații de generat");
      return;
    }

    // Prompturile hardcodate sunt întotdeauna active, nu mai verificăm prompts.length

    try {
      setCurrentStep(6); // Go to STEP 6 - Generate
      
      // Inițializează rezultatele
      const initialResults: VideoResult[] = combinations.map(combo => ({
        text: combo.text,
        imageUrl: combo.imageUrl,
        status: 'pending' as const,
        videoName: combo.videoName,
        section: combo.section,
        categoryNumber: combo.categoryNumber,
        reviewStatus: null,
        redStart: combo.redStart,  // Copiază pozițiile red text
        redEnd: combo.redEnd,
      }));
      setVideoResults(initialResults);

      // Grupează combinațiile pe tip de prompt
      const combinationsByPrompt: Record<PromptType, typeof combinations> = {
        PROMPT_NEUTRAL: [],
        PROMPT_SMILING: [],
        PROMPT_CTA: [],
        PROMPT_CUSTOM: [],
      };

      combinations.forEach(combo => {
        combinationsByPrompt[combo.promptType].push(combo);
      });

      // Generează pentru fiecare tip de prompt cu batch processing (max 20 per batch)
      const allResults: VideoResult[] = [];
      const BATCH_SIZE = 20; // Max 20 videos per batch

      for (const [promptType, combos] of Object.entries(combinationsByPrompt)) {
        if (combos.length === 0) continue;

        // Căutare prompt: încearcă custom, apoi hardcoded
        let promptTemplate: string;
        let promptName: string;
        
        // Încearcă să găsească prompt custom
        let customPrompt;
        if (promptType === 'PROMPT_NEUTRAL') {
          customPrompt = prompts.find(p => p.name.toUpperCase().includes('NEUTRAL'));
        } else if (promptType === 'PROMPT_SMILING') {
          customPrompt = prompts.find(p => p.name.toUpperCase().includes('SMILING'));
        } else if (promptType === 'PROMPT_CTA') {
          customPrompt = prompts.find(p => p.name.toUpperCase().includes('CTA'));
        }
        
        if (customPrompt) {
          promptTemplate = customPrompt.template;
          promptName = customPrompt.name;
        } else {
          // Folosește hardcoded prompt de pe backend
          // Backend-ul va folosi HARDCODED_PROMPTS automat
          promptTemplate = `HARDCODED_${promptType}`;
          promptName = promptType;
        }

        // Split în batch-uri de max 20 videos
        const totalBatches = Math.ceil(combos.length / BATCH_SIZE);
        console.log(`[Batch Processing] ${promptType}: ${combos.length} videos, ${totalBatches} batch(es)`);

        for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
          const start = batchIndex * BATCH_SIZE;
          const end = Math.min(start + BATCH_SIZE, combos.length);
          const batchCombos = combos.slice(start, end);

          console.log(`[Batch ${batchIndex + 1}/${totalBatches}] Processing ${batchCombos.length} videos (${start + 1}-${end})`);
          
          toast.info(`Processing batch ${batchIndex + 1}/${totalBatches} for ${promptType} (${batchCombos.length} videos)`);

          const result = await generateBatchMutation.mutateAsync({
            userId: currentUser.id,
            promptTemplate: promptTemplate,
            combinations: batchCombos.map(combo => ({
              text: combo.text,
              imageUrl: combo.imageUrl,
            })),
          });

          const batchResults: VideoResult[] = result.results.map((r: any) => {
            // Găsește combo-ul care corespunde textului returnat de API (nu by index!)
            const combo = batchCombos.find(c => c.text === r.text);
            if (!combo) {
              console.error('[CRITICAL] No matching combo found for API result text:', r.text?.substring(0, 50));
              // Fallback la index dacă nu găsim match (nu ar trebui să se întâmple)
              const fallbackCombo = batchCombos[result.results.indexOf(r)];
              return {
                taskId: r.taskId,
                text: r.text,
                imageUrl: r.imageUrl,
                status: r.success ? 'pending' as const : 'failed' as const,
                error: r.error,
                videoName: fallbackCombo?.videoName || 'UNKNOWN',
                section: fallbackCombo?.section || 'UNKNOWN',
                categoryNumber: fallbackCombo?.categoryNumber || 0,
                reviewStatus: null,
                redStart: fallbackCombo?.redStart,
                redEnd: fallbackCombo?.redEnd,
              };
            }
            return {
              taskId: r.taskId,
              text: r.text,
              imageUrl: r.imageUrl,
              status: r.success ? 'pending' as const : 'failed' as const,
              error: r.error,
              videoName: combo.videoName,
              section: combo.section,
              categoryNumber: combo.categoryNumber,
              reviewStatus: null,
              redStart: combo.redStart,  // Copiază pozițiile red text
              redEnd: combo.redEnd,
            };
          });

          allResults.push(...batchResults);
          
          // Delay între batch-uri pentru rate limiting (2 secunde)
          if (batchIndex < totalBatches - 1) {
            console.log(`[Batch Processing] Waiting 2s before next batch...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      }

      setVideoResults(allResults);
      const successCount = allResults.filter(r => r.status === 'pending').length;
      const failedCount = allResults.filter(r => r.status === 'failed').length;

      toast.success(`${successCount} videouri trimise spre generare`);
      
      if (failedCount > 0) {
        toast.error(`${failedCount} videouri au eșuat`);
      }
      
      // SAVE TO DATABASE after generation
      console.log('[Database Save] Saving session after video generation...');
      upsertContextSessionMutation.mutate({
        userId: localCurrentUser.id,
        tamId: selectedTamId,
        coreBeliefId: selectedCoreBeliefId,
        emotionalAngleId: selectedEmotionalAngleId,
        adId: selectedAdId,
        characterId: selectedCharacterId,
        currentStep: 6,
        rawTextAd,
        processedTextAd,
        adLines,
        prompts,
        images,
        combinations,
        deletedCombinations,
        videoResults: allResults,
        reviewHistory,
      }, {
        onSuccess: () => {
          console.log('[Database Save] Session saved successfully after generation!');
        },
        onError: (error) => {
          console.error('[Database Save] Failed to save session:', error);
          toast.error('Sesiunea nu a putut fi salvată în database, dar e salvată local');
        },
      });
    } catch (error: any) {
      toast.error(`Eroare la generarea videourilo: ${error.message}`);
    }
  };

  const checkVideoStatus = async (taskId: string, index: number) => {
    try {
      console.log(`Checking status for taskId: ${taskId}, index: ${index}`);
      
      const response = await fetch(`https://api.kie.ai/api/v1/veo/record-info?taskId=${taskId}`, {
        headers: {
          'Authorization': 'Bearer a4089052f1c04c6b8be02b026ce87fe8',
        },
      });

      const data = await response.json();
      console.log('Status response:', data);

      if (data.code === 200 && data.data) {
        let status: 'pending' | 'success' | 'failed' = 'pending';
        let videoUrl: string | undefined;
        let errorMessage: string | undefined;

        console.log('Processing video status - successFlag:', data.data.successFlag);
        console.log('Full API response:', JSON.stringify(data.data, null, 2));
        
        if (data.data.successFlag === 1) {
          status = 'success';
          // Verificare alternativă pentru resultUrls (poate fi în data.data sau data.data.response)
          videoUrl = data.data.resultUrls?.[0] || data.data.response?.resultUrls?.[0];
          console.log('Video SUCCESS - URL:', videoUrl);
          console.log('resultUrls location:', data.data.resultUrls ? 'data.data.resultUrls' : 'data.data.response.resultUrls');
        } else if (data.data.successFlag === -1 || data.data.successFlag === 2) {
          // successFlag === -1 sau 2 înseamnă failed
          status = 'failed';
          errorMessage = data.data.errorMessage || data.data.error || data.data.msg || 'Unknown error';
          console.log('Video FAILED - Error:', errorMessage);
        } else if (data.data.errorMessage || data.data.error) {
          // Dacă există errorMessage dar successFlag nu e -1, tot considerăm failed
          status = 'failed';
          errorMessage = data.data.errorMessage || data.data.error;
          console.log('Video FAILED (detected via errorMessage) - Error:', errorMessage);
        } else if (data.data.successFlag === 0) {
          // successFlag === 0 înseamnă pending
          status = 'pending';
          console.log('Video PENDING - successFlag:', data.data.successFlag);
        } else {
          console.log('Video status UNKNOWN - successFlag:', data.data.successFlag);
          console.log('Setting as pending by default');
        }

        setVideoResults(prev =>
          prev.map((v, i) =>
            i === index
              ? {
                  ...v,
                  status: status,
                  videoUrl: videoUrl,
                  error: errorMessage,
                }
              : v
          )
        );
        
        console.log(`Video #${index} updated in videoResults:`, {
          status,
          videoUrl,
          error: errorMessage,
        });

        // Only show toast for NEW status changes (not for videos already loaded from DB)
        const previousVideo = videoResults[index];
        const isNewSuccess = status === 'success' && !previousVideo.videoUrl;
        const isNewFailure = status === 'failed' && previousVideo.status !== 'failed';
        
        if (isNewSuccess) {
          toast.success(`Video #${index + 1} generat cu succes!`);
          
          // Save to DB immediately after success
          const updatedVideoResults = videoResults.map((v, i) =>
            i === index
              ? {
                  ...v,
                  status: status,
                  videoUrl: videoUrl,
                  error: errorMessage,
                }
              : v
          );
          
          await upsertContextSessionMutation.mutateAsync({
            userId: localCurrentUser.id,
            tamId: selectedTamId,
            coreBeliefId: selectedCoreBeliefId!,
            emotionalAngleId: selectedEmotionalAngleId!,
            adId: selectedAdId!,
            characterId: selectedCharacterId!,
            currentStep,
            rawTextAd,
            processedTextAd,
            adLines,
            prompts,
            images,
            combinations,
            deletedCombinations,
            videoResults: updatedVideoResults,
            reviewHistory,
          });
        } else if (isNewFailure) {
          toast.error(`Video #${index + 1} a eșuat: ${errorMessage}`);
        }
        // Nu mai afișăm toast pentru pending - doar UI update
      } else {
        toast.error(`Răspuns invalid de la API: ${data.msg || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Error checking video status:', error);
      toast.error(`Eroare la verificarea statusului: ${error.message}`);
    }
  };

  const downloadVideo = (url: string, index: number) => {
    window.open(url, '_blank');
    toast.success(`Descărcare video #${index + 1} pornită`);
  };

  // TEMPORARY: Load sample videos for testing when Kie.ai is down
  const loadSampleVideos = async () => {
    // Task IDs și URL-uri hardcodate (furnizate de user)
    const sampleData = [
      {
        taskId: '352a1aaaaba3352b6652305f2469718d',
        videoUrl: 'https://tempfile.aiquickdraw.com/v/352a1aaaaba3352b6652305f2469718d_1763136934.mp4',
        text: "Pentru femeile care s-au săturat să trăiască de la o lună la alta și cred că 'așa e viața'. Acest mesaj este pentru voi.",
        section: 'HOOKS' as SectionType,
      },
      {
        taskId: 'f4207b34d031dfbfcc06915e8cd8f4d2',
        videoUrl: 'https://tempfile.aiquickdraw.com/v/f4207b34d031dfbfcc06915e8cd8f4d2_1763116288.mp4',
        text: "Pentru femeile care simt că oricât se străduiesc, nu reușesc să iasă din datorii. Acest mesaj este pentru voi.",
        section: 'MIRROR' as SectionType,
      },
      {
        taskId: '119acff811870bcdb8da7cca59d58ddb',
        videoUrl: 'https://tempfile.aiquickdraw.com/v/119acff811870bcdb8da7cca59d58ddb_1763116319.mp4',
        text: "Știu cum e să simți că nu mai poți din cauză că nu mai faci față cu cheltuielile și să-ți vină să renunți la tot.",
        section: 'DCS' as SectionType,
      },
      {
        taskId: '155a3426ecbf0f4548030f333716f597',
        videoUrl: 'https://tempfile.aiquickdraw.com/v/155a3426ecbf0f4548030f333716f597_1763116288.mp4',
        text: "Dacă simți că viața ta e doar despre supraviețuire, cheltuieli, stres și lipsuri, ascultă-mă un minut.",
        section: 'TRANZITION' as SectionType,
      },
    ];
    
    toast.info('Încărcare sample videos...');
    
    try {
      // Creează videoResults cu videoUrl deja completat (hardcodat)
      const sampleResults: VideoResult[] = sampleData.map((data, index) => {
        // Pentru HOOKS folosește HOOK (singular) în nume
        const categoryName = data.section === 'HOOKS' ? 'HOOK' : data.section;
        // Video names are now generated in STEP 2 based on full context
        // For sample videos, use a placeholder format
        const categoryNumber = 1;
        
        return {
          taskId: data.taskId,
          videoName: `SAMPLE_${categoryName}${categoryNumber}`,
          text: data.text,
          imageUrl: 'https://via.placeholder.com/270x480/blue/white?text=Sample',
          status: 'success' as const,
          videoUrl: data.videoUrl,
          section: data.section,
          categoryNumber: categoryNumber,
          reviewStatus: null,
        };
      });
      
      setVideoResults(sampleResults);
      
      // Creează și combinations pentru sample videos
      const sampleCombinations: Combination[] = sampleData.map((data, index) => {
        // Pentru HOOKS folosește HOOK (singular) în nume
        const categoryName = data.section === 'HOOKS' ? 'HOOK' : data.section;
        // Toate sample videos sunt prima linie din categoria lor (categoryNumber = 1)
        const categoryNumber = 1;
        
        return {
          id: `sample-${index}`,
          text: data.text,
          imageUrl: 'https://via.placeholder.com/270x480/blue/white?text=Sample',
          imageId: `sample-img-${index}`,
          promptType: 'PROMPT_NEUTRAL' as PromptType,
          videoName: `SAMPLE_${categoryName}${categoryNumber}`,
          section: data.section,
          categoryNumber: categoryNumber,
        };
      });
      
      setCombinations(sampleCombinations);
      setCurrentStep(7); // Go to STEP 7 - Check Videos
      
      toast.success(`4/4 sample videos încărcate cu succes!`);
      console.log('Sample videos loaded:', sampleResults.map(v => v.videoName));
    } catch (error: any) {
      toast.error(`Eroare la încărcarea sample videos: ${error.message}`);
    }
  };
  
  // Regenerare toate videouri (failed + rejected)
  const regenerateAll = async () => {
    // Colectează toate videouri care trebuie regenerate: failed SAU rejected SAU duplicate negenerat (status null)
    const toRegenerateIndexes = videoResults
      .map((v, i) => ({ video: v, index: i }))
      .filter(({ video }) => 
        video.status === 'failed' || 
        video.reviewStatus === 'regenerate' ||
        video.status === null  // Include duplicate-uri negenerate
      )
      .map(({ index }) => index);
    
    if (toRegenerateIndexes.length === 0) {
      toast.error('Nu există videouri de regenerat');
      return;
    }

    try {
      toast.info(`Se regenerează ${toRegenerateIndexes.length} videouri...`);
      
      // Grupează pe tip de prompt
      const combinationsByPrompt: Record<PromptType, Array<{ combo: typeof combinations[0], index: number }>> = {
        PROMPT_NEUTRAL: [],
        PROMPT_SMILING: [],
        PROMPT_CTA: [],
        PROMPT_CUSTOM: [],
      };

      toRegenerateIndexes.forEach(index => {
        const combo = combinations[index];
        if (combo) {
          combinationsByPrompt[combo.promptType].push({ combo, index });
        }
      });

      let successCount = 0;
      let failCount = 0;

      // Regenerează pentru fiecare tip de prompt
      for (const [promptType, items] of Object.entries(combinationsByPrompt)) {
        if (items.length === 0) continue;

        // Determină prompt template
        let promptTemplate: string;
        let customPrompt;
        
        if (promptType === 'PROMPT_NEUTRAL') {
          customPrompt = prompts.find(p => p.name.toUpperCase().includes('NEUTRAL'));
        } else if (promptType === 'PROMPT_SMILING') {
          customPrompt = prompts.find(p => p.name.toUpperCase().includes('SMILING'));
        } else if (promptType === 'PROMPT_CTA') {
          customPrompt = prompts.find(p => p.name.toUpperCase().includes('CTA'));
        }
        
        if (customPrompt) {
          promptTemplate = customPrompt.template;
        } else {
          promptTemplate = `HARDCODED_${promptType}`;
        }

        const result = await generateBatchMutation.mutateAsync({
          userId: currentUser.id,
          promptTemplate: promptTemplate,
          combinations: items.map(({ combo }) => ({
            text: combo.text,
            imageUrl: combo.imageUrl,
          })),
        });

        // Actualizează videoResults
        result.results.forEach((newResult: any, i: number) => {
          const originalIndex = items[i].index;
          
          setVideoResults(prev =>
            prev.map((v, idx) =>
              idx === originalIndex
                  ? {
                    ...v,
                    taskId: newResult.taskId,
                    status: newResult.success ? 'pending' as const : 'failed' as const,
                    error: newResult.error,
                    videoUrl: undefined,
                    reviewStatus: undefined, // Reset review status
                  }
                : v
            )
          );

          if (newResult.success) {
            successCount++;
          } else {
            failCount++;
          }
        });
      }

      if (successCount > 0) {
        toast.success(`${successCount} videouri retrimise pentru generare`);
      }
      if (failCount > 0) {
        toast.error(`${failCount} videouri au eșuat din nou`);
      }
    } catch (error: any) {
      toast.error(`Eroare la regenerare batch: ${error.message}`);
    }
  };

  // ========== DUPLICATE VIDEO FUNCTIONS ==========

  /**
   * Creează un duplicate al unui video card
   * Duplicate-ul va avea status null și va fi regenerat când se apasă "Regenerate All"
   */
  const duplicateVideo = useCallback((videoName: string) => {
    const videoIndex = videoResults.findIndex(v => v.videoName === videoName);
    
    if (videoIndex < 0) {
      toast.error('Video nu găsit');
      return;
    }
    
    const originalVideo = videoResults[videoIndex];
    const originalCombo = combinations[videoIndex];
    
    if (!originalCombo) {
      toast.error('Combinație nu găsită');
      return;
    }
    
    // Generează nume duplicate
    const originalName = getOriginalVideoName(videoName);
    const duplicateName = generateDuplicateName(originalName, videoResults);
    
    // Creează duplicate video result
    // Copiază INPUT-urile (text, imageUrl) dar RESETEAZĂ OUTPUT-urile (taskId, videoUrl, status, reviewStatus)
    const duplicateVideoResult: VideoResult = {
      ...originalVideo, // Copiază toate câmpurile
      videoName: duplicateName,
      // RESET output fields - duplicatul e un video NOU care nu a fost generat încă
      taskId: undefined,
      videoUrl: undefined,
      // RESET status și reviewStatus - duplicatul e un video negenerat
      status: null, // null = not generated yet
      reviewStatus: null, // null = no review yet
      isDuplicate: true,
      duplicateNumber: getDuplicateNumber(duplicateName),
      originalVideoName: originalName,
    };
    
    console.log('[Duplicate Video] Created:', {
      originalName: videoName,
      duplicateName,
      originalStatus: originalVideo.status,
      duplicateStatus: duplicateVideoResult.status,
      originalVideoUrl: originalVideo.videoUrl,
      duplicateVideoUrl: duplicateVideoResult.videoUrl,
    });
    
    // Creează duplicate combination
    const duplicateCombo: Combination = {
      ...originalCombo,
      id: `combo-duplicate-${Date.now()}`,
      videoName: duplicateName,
    };
    
    // Adaugă duplicate după originalul său
    setVideoResults(prev => {
      const newResults = [...prev];
      newResults.splice(videoIndex + 1, 0, duplicateVideoResult);
      return newResults;
    });
    
    setCombinations(prev => {
      const newCombos = [...prev];
      newCombos.splice(videoIndex + 1, 0, duplicateCombo);
      return newCombos;
    });
    
    toast.success(`Duplicate creat: ${duplicateName}`);
  }, [videoResults, combinations]);

  /**
   * Șterge un video card (duplicate sau original)
   * Permite ștergerea oricărui video card
   */
  const deleteDuplicate = useCallback((videoName: string) => {
    // Allow deleting any video card, not just duplicates
    // if (!isDuplicateVideo(videoName)) {
    //   toast.error('Poți șterge doar duplicate-uri (videoName cu _D1, _D2, etc.)');
    //   return;
    // }
    
    const videoIndex = videoResults.findIndex(v => v.videoName === videoName);
    
    if (videoIndex < 0) {
      toast.error('Video nu găsit');
      return;
    }
    
    // Șterge din videoResults și combinations
    setVideoResults(prev => prev.filter((_, i) => i !== videoIndex));
    setCombinations(prev => prev.filter((_, i) => i !== videoIndex));
    
    toast.success(`Duplicate șters: ${videoName}`);
  }, [videoResults]);

  // Expune funcțiile pentru Step6
  useEffect(() => {
    (window as any).__duplicateVideo = duplicateVideo;
    (window as any).__deleteDuplicate = deleteDuplicate;
    
    return () => {
      delete (window as any).__duplicateVideo;
      delete (window as any).__deleteDuplicate;
    };
  }, [duplicateVideo, deleteDuplicate]);

  // Regenerare video cu modificări (Modify & Regenerate)
  const regenerateWithModifications = async (index: number) => {
    const combo = combinations[index];
    
    if (!combo) {
      toast.error('Combinație nu găsită');
      return;
    }
    
    // Text și pozițiile roșu sunt deja în state (modifyDialogueText, modifyRedStart, modifyRedEnd)
    
    // Validare text
    if (modifyDialogueText.trim().length === 0) {
      toast.error('Textul nu poate fi gol!');
      return;
    }
    
    console.log('[Regenerate With Modifications] Using text from state:', modifyDialogueText.substring(0, 50));
    console.log('[Regenerate With Modifications] Red positions:', modifyRedStart, '-', modifyRedEnd);

    try {
      // Determină prompt template
      let promptTemplate: string;
      
      // Dacă utilizatorul a editat promptul custom, folosește-l
      if (modifyPromptText.trim().length > 0) {
        promptTemplate = modifyPromptText;
      } else {
        // Altfel, folosește prompt type selectat
        let customPrompt;
        if (modifyPromptType === 'PROMPT_NEUTRAL') {
          customPrompt = prompts.find(p => p.name.toUpperCase().includes('NEUTRAL'));
        } else if (modifyPromptType === 'PROMPT_SMILING') {
          customPrompt = prompts.find(p => p.name.toUpperCase().includes('SMILING'));
        } else if (modifyPromptType === 'PROMPT_CTA') {
          customPrompt = prompts.find(p => p.name.toUpperCase().includes('CTA'));
        }
        
        if (customPrompt) {
          promptTemplate = customPrompt.template;
        } else {
          promptTemplate = `HARDCODED_${modifyPromptType}`;
        }
      }

      const result = await generateBatchMutation.mutateAsync({
        userId: currentUser.id,
        promptTemplate: promptTemplate,
        combinations: [{
          text: modifyDialogueText, // Folosește textul din state
          imageUrl: combo.imageUrl,
        }],
      });

      const newResult = result.results[0];
      
      // Actualizează videoResults și combinations cu noul text
      setVideoResults(prev =>
        prev.map((v, i) =>
          i === index
            ? {
                ...v,
                text: modifyDialogueText, // Update text
                taskId: newResult.taskId,
                status: newResult.success ? 'pending' as const : 'failed' as const,
                error: newResult.error,
                videoUrl: undefined,
              }
            : v
        )
      );
      
      // Update combinations cu noul prompt type și text
      setCombinations(prev =>
        prev.map((c, i) =>
          i === index
            ? {
                ...c,
                text: modifyDialogueText,
                promptType: modifyPromptType,
              }
            : c
        )
      );
      
      // Update adLines with red text positions
      setAdLines(prev => prev.map(line => {
        if (line.text === combo.text) {
          return {
            ...line,
            text: modifyDialogueText,
            charCount: modifyDialogueText.length,
            redStart: modifyRedStart,
            redEnd: modifyRedEnd,
          };
        }
        return line;
      }));

      // Închide form-ul
      setModifyingVideoIndex(null);
      setModifyPromptText('');
      setModifyDialogueText('');

      if (newResult.success) {
        toast.success(`Video #${index + 1} retrimis cu modificări`);
      } else {
        toast.error(`Eroare la retrimite video #${index + 1}: ${newResult.error}`);
      }
    } catch (error: any) {
      toast.error(`Eroare la regenerare cu modificări: ${error.message}`);
    }
  };

  // Regenerare video individual cu aceleași setări
  const regenerateSingleVideo = async (index: number) => {
    const video = videoResults[index];
    const combo = combinations[index];
    
    if (!combo) {
      toast.error('Combinație nu găsită');
      return;
    }

    try {
      // Închide modal-ul IMEDIAT (nu așteaptă după API call)
      setModifyingVideoIndex(null);
      
      // Determină prompt template (custom sau hardcoded)
      let promptTemplate: string;
      const promptType = combo.promptType;
      
      let customPrompt;
      if (promptType === 'PROMPT_NEUTRAL') {
        customPrompt = prompts.find(p => p.name.toUpperCase().includes('NEUTRAL'));
      } else if (promptType === 'PROMPT_SMILING') {
        customPrompt = prompts.find(p => p.name.toUpperCase().includes('SMILING'));
      } else if (promptType === 'PROMPT_CTA') {
        customPrompt = prompts.find(p => p.name.toUpperCase().includes('CTA'));
      }
      
      if (customPrompt) {
        promptTemplate = customPrompt.template;
      } else {
        promptTemplate = `HARDCODED_${promptType}`;
      }

      const result = await generateBatchMutation.mutateAsync({
        userId: currentUser.id,
        promptTemplate: promptTemplate,
        combinations: [{
          text: combo.text,
          imageUrl: combo.imageUrl,
        }],
      });

      const newResult = result.results[0];
      
      // Actualizează videoResults cu noul taskId ȘI șterge reviewStatus (forțează re-render)
      setVideoResults(prev => [
        ...prev.map((v, i) =>
          i === index
            ? {
                ...v,
                taskId: newResult.taskId,
                status: newResult.success ? 'pending' as const : 'failed' as const,
                error: newResult.error,
                videoUrl: undefined, // Reset videoUrl
                reviewStatus: null, // Șterge Rejected/Approved când regenerăm
              }
            : v
        )
      ]);

      if (newResult.success) {
        toast.success(`Video #${index + 1} retrimis pentru generare`);
      } else {
        toast.error(`Eroare la retrimite video #${index + 1}: ${newResult.error}`);
      }
    } catch (error: any) {
      toast.error(`Eroare la regenerare: ${error.message}`);
    }
  };
  // Auto-check video status pentru videouri pending (polling)
  useEffect(() => {
    if (videoResults.length === 0) return;

    // Only poll if we're in Step 6 (generation step)
    if (currentStep !== 6) return;

    // Only poll videos that are truly pending (no videoUrl yet)
    const pendingVideos = videoResults.filter(v => v.status === 'pending' && v.taskId && !v.videoUrl);
    if (pendingVideos.length === 0) return;

    console.log(`[Polling] Starting polling for ${pendingVideos.length} truly pending videos`);

    // Check-uri din 5 în 5 secunde de la început
    const interval = setInterval(() => {
      const stillPending = videoResults.filter(v => v.status === 'pending' && v.taskId && !v.videoUrl);
      if (stillPending.length === 0) {
        console.log('[Polling] All videos completed, stopping polling');
        clearInterval(interval);
        return;
      }

      console.log(`[Polling] Checking ${stillPending.length} pending videos...`);
      stillPending.forEach((video) => {
        const actualIndex = videoResults.findIndex(v => v.taskId === video.taskId);
        if (actualIndex !== -1 && video.taskId) {
          checkVideoStatus(video.taskId, actualIndex);
        }
      });
    }, 5000); // 5 secunde

    return () => {
      clearInterval(interval);
    };
  }, [videoResults, currentStep])  // DISABLED: Auto-check când intri în STEP 6 - cauzează false "în curs de regenerare" la refresh
  // Polling-ul de mai sus (line 3047) este suficient pentru videouri pending reale
  // ========== WORD DOCUMENT GENERATION ==========
  const generateWordDocument = useCallback(() => {
    // Group adLines by section
    const linesBySection: Record<SectionType, AdLine[]> = {
      HOOKS: [],
      MIRROR: [],
      DCS: [],
      TRANZITION: [],
      NEW_CAUSE: [],
      MECHANISM: [],
      EMOTIONAL_PROOF: [],
      TRANSFORMATION: [],
      CTA: [],
      OTHER: [],
    };

    adLines.forEach(line => {
      linesBySection[line.section].push(line);
    });

    // Generate HTML content
    let htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { color: #2563eb; border-bottom: 3px solid #2563eb; padding-bottom: 10px; }
          h2 { color: #16a34a; margin-top: 30px; border-bottom: 2px solid #16a34a; padding-bottom: 5px; }
          .line-item { margin: 15px 0; padding: 10px; background-color: #f9fafb; border-left: 4px solid #2563eb; }
          .video-name { font-weight: bold; color: #1e40af; margin-bottom: 5px; }
          .line-text { margin: 5px 0; line-height: 1.6; }
          .red-text { color: #dc2626; font-weight: bold; }
        </style>
      </head>
      <body>
        <h1>Linii Extrase - Step 2</h1>
    `;

    // Add sections
    Object.entries(linesBySection).forEach(([section, lines]) => {
      if (lines.length === 0) return;

      htmlContent += `<h2>${section}</h2>`;

      lines.forEach(line => {
        htmlContent += `<div class="line-item">`;
        htmlContent += `<div class="video-name">${line.videoName}</div>`;
        htmlContent += `<div class="line-text">`;

        // Add text with red highlighting
        if (line.redStart !== undefined && line.redStart >= 0 && line.redEnd !== undefined && line.redEnd >= 0) {
          const before = line.text.substring(0, line.redStart);
          const red = line.text.substring(line.redStart, line.redEnd);
          const after = line.text.substring(line.redEnd);
          htmlContent += `${before}<span class="red-text">${red}</span>${after}`;
        } else {
          htmlContent += line.text;
        }

        htmlContent += `</div></div>`;
      });
    });

    htmlContent += `</body></html>`;

    // Create blob and download
    const blob = new Blob([htmlContent], { type: 'application/msword' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Linii_Extrase_Step2.doc';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    toast.success('Document Word descărcat!');
  }, [adLines]);

  // ========== STEP 6: Review functions (MEMOIZED) ==========
  const acceptVideo = useCallback((videoName: string) => {
    setVideoResults(prev => prev.map(v => 
      v.videoName === videoName 
        ? { ...v, reviewStatus: 'accepted' as const }
        : v
    ));
    
    setReviewHistory(prev => [...prev, {
      videoName,
      previousStatus: videoResults.find(v => v.videoName === videoName)?.reviewStatus || null,
      newStatus: 'accepted',
    }]);
    
    toast.success(`Video ${videoName} acceptat!`);
  }, [videoResults]);

  const regenerateVideo = useCallback((videoName: string) => {
    setVideoResults(prev => prev.map(v => 
      v.videoName === videoName 
        ? { ...v, reviewStatus: 'regenerate' as const }
        : v
    ));
    setReviewHistory(prev => [...prev, {
      videoName,
      previousStatus: videoResults.find(v => v.videoName === videoName)?.reviewStatus || null,
      newStatus: 'regenerate',
    }]);
    toast.info(`${videoName} marcat pentru regenerare`);
  }, [videoResults]);

  const undoReviewDecision = useCallback((videoName: string) => {
    setVideoResults(prev => prev.map(v => 
      v.videoName === videoName 
        ? { ...v, reviewStatus: null }
        : v
    ));
    toast.success(`Decizie anulată pentru ${videoName}`);
  }, [videoResults]);

  const handleCategoryChange = useCallback(async (videoName: string, newSection: string) => {
    try {
      // Find video
      const videoIndex = videoResults.findIndex(v => v.videoName === videoName);
      if (videoIndex < 0) {
        toast.error('Video not found');
        return;
      }
      
      const video = videoResults[videoIndex];
      
      // Extract parts from videoName: "T1_C1_E2_AD1_HOOK3_LIDIA"
      const parts = videoName.split('_');
      
      if (parts.length < 6) {
        toast.error('Invalid video name format');
        console.error('[Category Change] Invalid videoName:', videoName);
        return;
      }
      
      // parts[4] = "HOOK3" or "MIRROR1" etc.
      // Extract number: "HOOK3" → "3"
      const oldCategoryPart = parts[4];
      const numberMatch = oldCategoryPart.match(/\d+$/);
      const categoryNumber = numberMatch ? numberMatch[0] : '1';
      
      // Create new videoName: "HOOK3" → "MIRROR3"
      parts[4] = newSection + categoryNumber;
      const newVideoName = parts.join('_');
      
      console.log('[Category Change]', videoName, '→', newVideoName);
      console.log('[Category Change] Old section:', video.section, '→ New section:', newSection);
      
      // Update videoResults state
      const updatedVideoResults = videoResults.map(v =>
        v.videoName === videoName
          ? { ...v, videoName: newVideoName, section: newSection as any }
          : v
      );
      
      setVideoResults(updatedVideoResults);
      
      // Save to database
      await upsertContextSessionMutation.mutateAsync({
        userId: localCurrentUser.id,
        tamId: selectedTamId,
        coreBeliefId: selectedCoreBeliefId,
        emotionalAngleId: selectedEmotionalAngleId,
        adId: selectedAdId,
        characterId: selectedCharacterId,
        currentStep,
        rawTextAd,
        processedTextAd,
        adLines,
        prompts,
        images,
        combinations,
        deletedCombinations,
        videoResults: updatedVideoResults,
        reviewHistory,
        hookMergedVideos,
        bodyMergedVideoUrl,
        finalVideos,
      });
      
      toast.success(`✅ Category changed: ${videoName} → ${newVideoName}`);
    } catch (error: any) {
      console.error('[Category Change] Error:', error);
      toast.error(`Failed to save category: ${error.message}`);
    }
  }, [videoResults, localCurrentUser, selectedTamId, selectedCoreBeliefId, selectedEmotionalAngleId, selectedAdId, selectedCharacterId, currentStep, rawTextAd, processedTextAd, adLines, prompts, images, combinations, deletedCombinations, reviewHistory, hookMergedVideos, bodyMergedVideoUrl, finalVideos, upsertContextSessionMutation]);

  const undoReview = useCallback(() => {
    if (reviewHistory.length === 0) {
      toast.error('Nu există acțiuni de anulat');
      return;
    }
    
    const lastAction = reviewHistory[reviewHistory.length - 1];
    
    setVideoResults(prev => prev.map(v => 
      v.videoName === lastAction.videoName 
        ? { ...v, reviewStatus: lastAction.previousStatus }
        : v
    ));
    
    setReviewHistory(prev => prev.slice(0, -1));
    toast.success(`Acțiune anulată pentru ${lastAction.videoName}`);
  }, [reviewHistory]);

  const goToCheckVideos = async () => {
    setCurrentStep(7); // Go to STEP 7 - Check Videos
    
    // Save currentStep to DB
    await upsertContextSessionMutation.mutateAsync({
      userId: localCurrentUser.id,
      tamId: selectedTamId,
      coreBeliefId: selectedCoreBeliefId!,
      emotionalAngleId: selectedEmotionalAngleId!,
      adId: selectedAdId!,
      characterId: selectedCharacterId!,
      currentStep: 7,
      rawTextAd,
      processedTextAd,
      adLines,
      prompts,
      images,
      combinations,
      deletedCombinations,
      videoResults,
      reviewHistory,
    });
  };

  // Navigation
  const goToStep = async (step: number) => {
    // Allow free navigation in both directions
    setCurrentStep(step);
    
    // Save currentStep to DB
    await upsertContextSessionMutation.mutateAsync({
      userId: localCurrentUser.id,
      tamId: selectedTamId,
      coreBeliefId: selectedCoreBeliefId!,
      emotionalAngleId: selectedEmotionalAngleId!,
      adId: selectedAdId!,
      characterId: selectedCharacterId!,
      currentStep: step,
      rawTextAd,
      processedTextAd,
      adLines,
      prompts,
      images,
      combinations,
      deletedCombinations,
      videoResults,
      reviewHistory,
    });
  };

  const goBack = () => {
    if (currentStep > 1) {
      // Dacă sunt modificări, întreabă user
      if (hasModifications) {
        if (!confirm('Ai modificări nesalvate. Sigur vrei să te întorci?')) {
          return;
        }
        setHasModifications(false); // Reset modificări
      }
      setCurrentStep(currentStep - 1);
    }
  };

  // Show loading screen while restoring session
  if (isRestoringSession) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100">
      {/* Header Navigation Bar */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 shadow-lg">
        <div className="container max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo + Brand */}
            <div className="flex items-center gap-3">
              <Sparkles className="w-6 h-6 text-yellow-300" />
              <span className="text-white font-bold text-lg">A.I Ads Engine</span>
            </div>
            
            {/* Navigation Links */}
            <div className="hidden md:flex items-center gap-6">
              <button
                onClick={() => setLocation("/images-library")}
                className="flex items-center gap-2 text-white hover:text-yellow-300 transition-colors text-sm font-medium"
              >
                <Images className="w-4 h-4" />
                Images Library
              </button>
              <button
                onClick={() => setLocation("/prompts-library")}
                className="flex items-center gap-2 text-white hover:text-yellow-300 transition-colors text-sm font-medium"
              >
                <MessageSquare className="w-4 h-4" />
                Prompts Library
              </button>
              <button
                onClick={() => setLocation("/category-management")}
                className="flex items-center gap-2 text-white hover:text-yellow-300 transition-colors text-sm font-medium"
              >
                <Folder className="w-4 h-4" />
                Ads Management
              </button>
              <button
                onClick={() => setIsEditProfileOpen(true)}
                className="flex items-center gap-2 text-white hover:text-yellow-300 transition-colors text-sm font-medium"
              >
                <SettingsIcon className="w-4 h-4" />
                Settings
              </button>
            </div>
            
            {/* User Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-blue-800 transition-colors">
                  {localCurrentUser.profileImageUrl && (
                    <img
                      src={localCurrentUser.profileImageUrl}
                      alt="Profile"
                      className="w-8 h-8 rounded-full border-2 border-white object-cover"
                    />
                  )}
                  {!localCurrentUser.profileImageUrl && (
                    <div className="w-8 h-8 rounded-full border-2 border-white bg-blue-800 flex items-center justify-center">
                      <span className="text-white font-medium text-sm">
                        {localCurrentUser.username.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <span className="text-white text-sm font-medium">{localCurrentUser.username}</span>
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={onLogout} className="cursor-pointer text-red-600">
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
      
      <div className="container max-w-6xl mx-auto py-4 md:py-8 px-2 md:px-4">
      
      {/* Edit Profile Modal */}
      <EditProfileModal
        isOpen={isEditProfileOpen}
        onClose={() => setIsEditProfileOpen(false)}
        currentUser={localCurrentUser}
        onProfileUpdated={(updatedUser: any) => {
          setLocalCurrentUser(updatedUser);
          // Update parent component
          localStorage.setItem('currentUser', JSON.stringify(updatedUser));
        }}
      />
      
      {/* Processing Modal for Step 8 batch processing */}
      <ProcessingModal
        open={showProcessingModal}
        ffmpegProgress={processingProgress.ffmpeg}
        whisperProgress={processingProgress.whisper}
        cleanvoiceProgress={processingProgress.cleanvoice}
        currentVideoName={processingProgress.currentVideoName}
        processingStep={processingStep}
        countdown={processingProgress.countdown}
        estimatedMinutes={processingProgress.estimatedMinutes}
        successVideos={processingProgress.successVideos}
        failedVideos={processingProgress.failedVideos}
        ffmpegSuccess={processingProgress.ffmpegSuccess}
        ffmpegFailed={processingProgress.ffmpegFailed}
        whisperSuccess={processingProgress.whisperSuccess}
        whisperFailed={processingProgress.whisperFailed}
        cleanvoiceSuccess={processingProgress.cleanvoiceSuccess}
        cleanvoiceFailed={processingProgress.cleanvoiceFailed}
        onClose={() => setShowProcessingModal(false)}
        onContinue={() => {
          setShowProcessingModal(false);
          setCurrentStep(8);
          toast.success('✅ Proceeding to Step 8');
        }}
        onRetryFailed={async () => {
          console.log('[Retry Failed] Starting retry for failed videos:', processingProgress.failedVideos);
          
          // Get failed video names
          const failedVideoNames = processingProgress.failedVideos.map(f => f.videoName);
          
          // Find the original video objects
          const videosToRetry = videoResults.filter(v => failedVideoNames.includes(v.videoName));
          
          if (videosToRetry.length === 0) {
            toast.error('No failed videos to retry');
            return;
          }
          
          console.log(`[Retry Failed] Retrying ${videosToRetry.length} videos...`);
          toast.info(`🔄 Retrying ${videosToRetry.length} failed videos...`);
          
          // Reset progress for retry
          setProcessingProgress({
            ffmpeg: { current: 0, total: videosToRetry.length, status: 'idle', activeVideos: [] },
            whisper: { current: 0, total: videosToRetry.length, status: 'idle', activeVideos: [] },
            cleanvoice: { current: 0, total: videosToRetry.length, status: 'idle', activeVideos: [] },
            currentVideoName: '',
            countdown: 0,
            estimatedMinutes: 0,
            successVideos: [],
            failedVideos: [],
            ffmpegSuccess: [],
            ffmpegFailed: [],
            whisperSuccess: [],
            whisperFailed: [],
            cleanvoiceSuccess: [],
            cleanvoiceFailed: []
          });
          
          try {
            // Reprocess failed videos
            await batchProcessVideosWithWhisper(videosToRetry);
            
            // Check if there are still failed videos
            const stillFailedCount = processingProgress.failedVideos.length;
            
            if (stillFailedCount > 0) {
              toast.warning(`⚠️ Retry complete: ${videosToRetry.length - stillFailedCount} success, ${stillFailedCount} still failed`);
            } else {
              // All retries successful - user can now click "Continue to Step 8"
              toast.success(`✅ All ${videosToRetry.length} retried videos processed successfully! Click Continue to proceed.`);
            }
          } catch (error: any) {
            console.error('[Retry Failed] Error:', error);
            toast.error(`Eroare la retry: ${error.message}`);
          }
        }}
        onSampleMerge={handleSampleMerge}
      />
      
      {/* Merge Videos Modal for Step 9 → Step 10 - NEW MergeProgressModal */}
      <MergeProgressModal
        open={isMergingStep10}
        status={mergeStep10Progress.status}
        message={mergeStep10Progress.message}
        countdown={mergeStep10Progress.countdown}
        totalFinalVideos={mergeStep10Progress.totalFinalVideos}
        currentFinalVideo={mergeStep10Progress.currentFinalVideo}
        currentBatch={mergeStep10Progress.currentBatch}
        totalBatches={mergeStep10Progress.totalBatches}
        hooksSuccess={mergeStep10Progress.hooksSuccess}
        hooksFailed={mergeStep10Progress.hooksFailed}
        hooksInProgress={mergeStep10Progress.hooksInProgress}
        bodySuccess={mergeStep10Progress.bodySuccess}
        bodyFailed={mergeStep10Progress.bodyFailed}
        bodyInProgress={mergeStep10Progress.bodyInProgress}
        onSkipCountdown={mergeStep10Progress.onSkipCountdown}
        onRetryFailed={handleRetryFailedMerge}
        onContinue={() => {
          setIsMergingStep10(false);
          setCurrentStep(10);
          toast.success('✅ Proceeding to Step 10');
        }}
        onClose={() => {
          if (mergeStep10Progress.status !== 'processing' && mergeStep10Progress.status !== 'countdown') {
            setIsMergingStep10(false);
          }
        }}
      />
      
      {/* Merge Final Videos Modal for Step 10 → Step 11 */}
      <Dialog open={isMergingFinalVideos} onOpenChange={(open) => {
        if (!open && mergeFinalProgress.status === 'processing') return;
        setIsMergingFinalVideos(open);
      }}>
        <DialogContent className="max-w-md" onInteractOutside={(e) => {
          if (mergeFinalProgress.status === 'processing') e.preventDefault();
        }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-green-600" />
              🎬 Merge Final Videos
            </DialogTitle>
            <DialogDescription>
              Merging hooks + body into final video combinations...
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {mergeFinalProgress.status === 'processing' ? (
              <>
                <div className="space-y-2">
                  <Progress 
                    value={(mergeFinalProgress.current / mergeFinalProgress.total) * 100} 
                    className="h-3"
                  />
                  <p className="text-center text-sm font-medium text-gray-700">
                    {mergeFinalProgress.current}/{mergeFinalProgress.total} final videos merged
                  </p>
                </div>
                
                {mergeFinalProgress.current < mergeFinalProgress.total && mergeFinalProgress.currentVideo && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-sm font-semibold text-green-900 mb-1">
                      🎬 Current: {mergeFinalProgress.currentVideo}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-green-700">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Merging hook + body with FFmpeg...
                    </div>
                  </div>
                )}
                
                {mergeFinalProgress.current < mergeFinalProgress.total && (
                  <p className="text-xs text-center text-gray-500">
                    ⏱️ Estimated time: ~{Math.ceil((mergeFinalProgress.total - mergeFinalProgress.current) * 10 / 60)} {Math.ceil((mergeFinalProgress.total - mergeFinalProgress.current) * 10 / 60) === 1 ? 'minute' : 'minutes'}
                  </p>
                )}
              </>
            ) : mergeFinalProgress.status === 'complete' ? (
              <div className="text-center space-y-3">
                <div className="flex justify-center">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                    <Check className="w-8 h-8 text-green-600" />
                  </div>
                </div>
                <p className="text-lg font-semibold text-green-900">
                  ✅ Merge Complete!
                </p>
                <p className="text-sm text-gray-600">
                  {mergeFinalProgress.current} final videos created successfully
                </p>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Trimming Modal for Step 8 → Step 9 */}
      <Dialog open={isTrimmingModalOpen} onOpenChange={(open) => {
        // Allow closing only when NOT processing or merging
        if (!open && (trimmingProgress.status === 'processing' || trimmingProgress.status === 'merging')) return;
        setIsTrimmingModalOpen(open);
      }}>
        <DialogContent className="max-w-5xl max-h-[80vh] overflow-y-auto" onInteractOutside={(e) => {
          // Prevent closing by clicking outside during processing or merging
          if (trimmingProgress.status === 'processing' || trimmingProgress.status === 'merging') e.preventDefault();
        }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {trimmingProgress.status === 'processing' && (
                <Loader2 className="w-5 h-5 animate-spin text-red-600" />
              )}
              ✂️ Procesare Videouri (FFmpeg + CleanVoice)
            </DialogTitle>
            <DialogDescription>
              Tăiem fiecare video la timestamps-urile detectate și înlocuim audio cu versiunea procesată de CleanVoice...
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Batch Progress (always visible during processing or merging) */}
            {(trimmingProgress.status === 'processing' || trimmingProgress.status === 'merging') && (
              <div className="space-y-3">
                {/* Batch Info */}
                {trimmingProgress.totalBatches > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm font-semibold text-blue-800">
                      📦 Batch {trimmingProgress.currentBatch}/{trimmingProgress.totalBatches}
                    </p>
                  </div>
                )}
                
                {/* Progress Bars */}
                <div className="space-y-4">
                  {/* Cutting Videos Progress */}
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                      ✂️ Cutting Videos
                    </p>
                    <Progress 
                      value={(trimmingProgress.cuttingCurrent / trimmingProgress.cuttingTotal) * 100} 
                      className="h-3 bg-green-100"
                    />
                    <p className="text-center text-sm font-medium text-green-700">
                      {trimmingProgress.cuttingCurrent}/{trimmingProgress.cuttingTotal} videos cut
                    </p>
                  </div>
                  
                  {/* Prepare for Merge Progress */}
                  {trimmingProgress.mergingTotal > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-center gap-2">
                        <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                          🔗 Prepare for Merge
                        </p>
                        {trimmingProgress.mergingCurrent < trimmingProgress.mergingTotal && (
                          <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                        )}
                      </div>
                      <Progress 
                        value={(trimmingProgress.mergingCurrent / trimmingProgress.mergingTotal) * 100} 
                        className="h-3 bg-purple-100"
                      />
                      <p className="text-center text-sm font-medium text-purple-700">
                        {trimmingProgress.mergingCurrent}/{trimmingProgress.mergingTotal} merged
                      </p>
                    </div>
                  )}
                  
                  {/* Countdown Timer */}
                  {trimmingProgress.countdown > 0 && (
                    <div className="flex items-center justify-center">
                      <div className="bg-orange-50 border-2 border-orange-300 rounded-lg px-6 py-4">
                        <p className="text-center text-4xl font-bold text-orange-600 tabular-nums">
                          ⏳ {trimmingProgress.countdown}s
                        </p>
                        <p className="text-center text-xs text-orange-500 mt-2">
                          Waiting for FFmpeg rate limit...
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Status message */}
                {trimmingProgress.message && trimmingProgress.status !== 'merging' && (
                  <div className="text-center text-sm font-medium p-2 rounded-lg bg-gray-50 text-gray-600">
                    {trimmingProgress.message}
                  </div>
                )}
                
                {/* Merge Status */}
                {trimmingProgress.mergeStatus === 'pending' && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-center gap-3">
                    <Loader2 className="w-5 h-5 animate-spin text-orange-600" />
                    <p className="text-sm font-semibold text-orange-800">
                      🔄 Merging all {trimmingProgress.total} videos, please wait...
                    </p>
                  </div>
                )}
              </div>
            )}
            
            {/* Success List (collapsible) */}
            {trimmingProgress.successVideos.length > 0 && (
              <div>
                <button
                  onClick={() => setIsTrimmingSuccessLogOpen(!isTrimmingSuccessLogOpen)}
                  className="w-full flex items-center justify-between text-sm font-medium text-green-700 mb-2 hover:text-green-800"
                >
                  <span>✅ Success ({trimmingProgress.successVideos.length})</span>
                  <span className="text-blue-600 underline text-xs">View log</span>
                </button>
                {isTrimmingSuccessLogOpen && (
                  <div className="max-h-48 overflow-y-auto bg-green-50 border border-green-200 rounded-lg p-3 space-y-1">
                    {trimmingProgress.successVideos.map((v, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-green-700">
                        <span className="text-green-600">✓</span>
                        <span>{v.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {/* Failed List (collapsible, auto-open if has failures) */}
            {trimmingProgress.failedVideos.length > 0 && (
              <div>
                <button
                  onClick={() => setIsTrimmingFailedLogOpen(!isTrimmingFailedLogOpen)}
                  className="w-full flex items-center justify-between text-sm font-medium text-red-700 mb-2 hover:text-red-800"
                >
                  <span>❌ Failed ({trimmingProgress.failedVideos.length})</span>
                  <span className="text-blue-600 underline text-xs">View log</span>
                </button>
                {isTrimmingFailedLogOpen && (
                  <div className="max-h-48 overflow-y-auto bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
                    {trimmingProgress.failedVideos.map((v, i) => (
                      <div key={i} className="text-sm">
                        <div className="flex items-start gap-2">
                          {/* Show loading spinner if video is retrying */}
                          {v.status === 'retrying' ? (
                            <Loader2 className="w-4 h-4 animate-spin text-orange-600 mt-0.5" />
                          ) : (
                            <span className="text-red-600">✗</span>
                          )}
                          <div className="flex-1">
                            <div className="font-medium text-red-700">{v.name}</div>
                            {v.error && v.status !== 'retrying' && (
                              <div className="text-xs text-gray-600 mt-0.5">{v.error}</div>
                            )}
                            {v.status === 'retrying' && (
                              <div className="text-xs text-orange-600 mt-0.5">Retrying...</div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {/* Merged Videos List (hooks + body, separate from CUT videos) */}
            {trimmingProgress.mergedVideos?.length > 0 && (
              <div>
                <button
                  onClick={() => setIsTrimmingSuccessLogOpen(!isTrimmingSuccessLogOpen)}
                  className="w-full flex items-center justify-between text-sm font-medium text-purple-700 mb-2 hover:text-purple-800"
                >
                  <span>🔗 Merged ({trimmingProgress.mergedVideos.length})</span>
                  <span className="text-blue-600 underline text-xs">View log</span>
                </button>
                {isTrimmingSuccessLogOpen && (
                  <div className="max-h-48 overflow-y-auto bg-purple-50 border border-purple-200 rounded-lg p-3 space-y-1">
                    {trimmingProgress.mergedVideos.map((v, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-purple-700">
                        <span>✓</span>
                        <span>{v.name} ({v.type === 'hooks' ? 'Hooks merged' : 'Body merged'})</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {/* In Progress List (during processing) */}
            {trimmingProgress.inProgressVideos.length > 0 && (
              <div>
                <p className="text-sm font-medium text-blue-700 mb-2">
                  ⏳ Processing ({trimmingProgress.inProgressVideos.length}):
                </p>
                <div className="max-h-32 overflow-y-auto bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-1">
                  {trimmingProgress.inProgressVideos.map((v, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-blue-700">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{v.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Merge Success (at bottom) */}
            {trimmingProgress.mergeStatus === 'success' && (
              <div>
                <p className="text-sm font-medium text-green-700 mb-2">
                  ✅ Merge successful!
                </p>
              </div>
            )}
            
            {/* Merge Failed (at bottom) */}
            {trimmingProgress.mergeStatus === 'failed' && (
              <div>
                <p className="text-sm font-medium text-red-700 mb-2">
                  ❌ Merge failed
                </p>
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
                  <p className="text-xs text-red-600">
                    Videos were trimmed but merge operation failed.
                  </p>
                  <Button
                    onClick={async () => {
                      // Retry final merge
                      console.log('[Trimming] 🔄 Retrying final merge...');
                      
                      setTrimmingProgress(prev => ({
                        ...prev,
                        status: 'merging',
                        mergeStatus: 'pending',
                        message: '🔄 Retrying merge...'
                      }));
                      
                      try {
                        // Get latest videoResults
                        let latestVideoResults: typeof videoResults = [];
                        setVideoResults(current => {
                          latestVideoResults = current;
                          return current;
                        });
                        
                        const trimmedVideos = latestVideoResults.filter(v => v.trimmedVideoUrl);
                        
                        if (trimmedVideos.length === 0) {
                          throw new Error('No trimmed videos found');
                        }
                        
                        // Merge all trimmed videos
                        const mergeResult = await cutAndMergeAllMutation.mutateAsync({
                          videos: trimmedVideos.map(v => ({
                            url: v.trimmedVideoUrl!,
                            name: v.videoName,
                            startMs: 0,
                            endMs: 0
                          })),
                          ffmpegApiKey: localCurrentUser.ffmpegApiKey || ''
                        });
                        
                        if (!mergeResult.success || !mergeResult.downloadUrl) {
                          throw new Error('Merge failed');
                        }
                        
                        setTrimmingMergedVideoUrl(mergeResult.downloadUrl);
                        setLastSampleVideoUrl(mergeResult.downloadUrl);
                        
                        setTrimmingProgress(prev => ({
                          ...prev,
                          status: 'complete',
                          mergeStatus: 'success',
                          message: '\u2705 Merge successful!'
                        }));
                        
                        toast.success('Merge successful!');
                      } catch (error: any) {
                        console.error('[Trimming] ❌ Retry merge failed:', error);
                        setTrimmingProgress(prev => ({
                          ...prev,
                          status: 'partial',
                          mergeStatus: 'failed',
                          message: `❌ Merge failed: ${error.message}`
                        }));
                        toast.error(`Merge failed: ${error.message}`);
                      }
                    }}
                    className="bg-red-600 hover:bg-red-700 text-white text-xs"
                    size="sm"
                  >
                    🔄 Retry Merge
                  </Button>
                </div>
              </div>
            )}
            
            {/* Video Player (only if ALL videos succeeded) */}
            {trimmingProgress.status !== 'processing' && 
             trimmingProgress.failedVideos.length === 0 && 
             trimmingProgress.successVideos.length > 0 && 
             trimmingMergedVideoUrl && (
              <div className="space-y-4 mt-6">
                {/* Video Player */}
                <video
                  id="trimming-video-player"
                  src={trimmingMergedVideoUrl}
                  controls
                  className="w-full rounded-lg border border-gray-300"
                  style={{ maxHeight: '400px' }}
                />
                
                {/* Current Video Name Display (below video) */}
                <div className="bg-yellow-100 border-2 border-yellow-400 rounded-lg p-2 text-center">
                  <p className="text-xs font-bold text-yellow-900" id="trimming-current-video-name">
                    🎬 {trimmingCurrentVideoName || trimmingProgress.successVideos[0]?.name || 'Loading...'}
                  </p>
                </div>
                
                {/* Download Video Link */}
                <div className="flex justify-end">
                  <a
                    href={trimmingMergedVideoUrl}
                    download="merged-video.mp4"
                    className="text-blue-600 hover:text-blue-800 underline text-xs italic"
                  >
                    Download video
                  </a>
                </div>
                
                {/* Video Timeline - Simple list matching "Videos in this merge" design */}
                <div className="bg-purple-50 border-2 border-purple-300 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">
                    🎬 Video Timeline
                  </h3>
                  <div className="space-y-2">
                    {/* Previous Video */}
                    {(() => {
                      const currentIdx = trimmingProgress.successVideos.findIndex(
                        v => v.name === trimmingCurrentVideoName
                      );
                      const prevVideo = currentIdx > 0 
                        ? trimmingProgress.successVideos[currentIdx - 1] 
                        : null;
                      if (!prevVideo) return null;
                      const videoData = videoResults.find(v => v.videoName === prevVideo.name);
                      const note = videoData?.step9Note || '';
                      const isEditing = editingNoteId === prevVideo.name;
                      
                      return (
                        <div className="flex items-start justify-between gap-3 p-3 bg-gray-50 rounded-lg">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">← Previous: {prevVideo.name}</p>
                            
                            {isEditing ? (
                              <div className="mt-2 space-y-2">
                                <textarea
                                  value={editingNoteText}
                                  onChange={(e) => setEditingNoteText(e.target.value)}
                                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  rows={3}
                                  placeholder="Add note for Step 9..."
                                />
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      const updatedVideoResults = videoResults.map(v =>
                                        v.videoName === prevVideo.name ? { ...v, step9Note: editingNoteText } : v
                                      );
                                      setVideoResults(updatedVideoResults);
                                      setEditingNoteId(null);
                                      setEditingNoteText('');
                                      toast.success('Note saved!');
                                      if (selectedCoreBeliefId && selectedEmotionalAngleId && selectedAdId && selectedCharacterId) {
                                        upsertContextSessionMutation.mutate({
                                          userId: currentUser.id,
                                          tamId: selectedTamId,
                                          coreBeliefId: selectedCoreBeliefId,
                                          emotionalAngleId: selectedEmotionalAngleId,
                                          adId: selectedAdId,
                                          characterId: selectedCharacterId,
                                          currentStep,
                                          rawTextAd,
                                          processedTextAd,
                                          adLines,
                                          prompts,
                                          images,
                                          combinations,
                                          deletedCombinations,
                                          videoResults: updatedVideoResults,
                                          reviewHistory,
                                          hookMergedVideos,
                                          bodyMergedVideoUrl,
                                          finalVideos,
                                        });
                                      }
                                    }}
                                    className="bg-green-600 hover:bg-green-700"
                                  >
                                    Save
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setEditingNoteId(null);
                                      setEditingNoteText('');
                                    }}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              note && (
                                <p className="mt-1 text-xs text-purple-600">📝 {note}</p>
                              )
                            )}
                          </div>
                          
                          {!isEditing && (
                            <button
                              onClick={() => {
                                setEditingNoteId(prevVideo.name);
                                setEditingNoteText(note);
                              }}
                              className="text-xs text-blue-600 hover:text-blue-800 underline whitespace-nowrap"
                            >
                              {note ? 'Edit note' : 'Add note'}
                            </button>
                          )}
                        </div>
                      );
                    })()}
                    
                    {/* Current Video */}
                    {(() => {
                      const videoName = trimmingCurrentVideoName || trimmingProgress.successVideos[0]?.name || 'Loading...';
                      const videoData = videoResults.find(v => v.videoName === videoName);
                      const note = videoData?.step9Note || '';
                      const isEditing = editingNoteId === videoName;
                      
                      return (
                        <div className="flex items-start justify-between gap-3 p-3 bg-white border-2 border-purple-400 rounded-lg">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900 font-bold">▶️ Current: {videoName}</p>
                            
                            {isEditing ? (
                              <div className="mt-2 space-y-2">
                                <textarea
                                  value={editingNoteText}
                                  onChange={(e) => setEditingNoteText(e.target.value)}
                                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  rows={3}
                                  placeholder="Add note for Step 9..."
                                />
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      const updatedVideoResults = videoResults.map(v =>
                                        v.videoName === videoName ? { ...v, step9Note: editingNoteText } : v
                                      );
                                      setVideoResults(updatedVideoResults);
                                      setEditingNoteId(null);
                                      setEditingNoteText('');
                                      toast.success('Note saved!');
                                      if (selectedCoreBeliefId && selectedEmotionalAngleId && selectedAdId && selectedCharacterId) {
                                        upsertContextSessionMutation.mutate({
                                          userId: currentUser.id,
                                          tamId: selectedTamId,
                                          coreBeliefId: selectedCoreBeliefId,
                                          emotionalAngleId: selectedEmotionalAngleId,
                                          adId: selectedAdId,
                                          characterId: selectedCharacterId,
                                          currentStep,
                                          rawTextAd,
                                          processedTextAd,
                                          adLines,
                                          prompts,
                                          images,
                                          combinations,
                                          deletedCombinations,
                                          videoResults: updatedVideoResults,
                                          reviewHistory,
                                          hookMergedVideos,
                                          bodyMergedVideoUrl,
                                          finalVideos,
                                        });
                                      }
                                    }}
                                    className="bg-green-600 hover:bg-green-700"
                                  >
                                    Save
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setEditingNoteId(null);
                                      setEditingNoteText('');
                                    }}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              note && (
                                <p className="mt-1 text-xs text-purple-600">📝 {note}</p>
                              )
                            )}
                          </div>
                          
                          {!isEditing && (
                            <button
                              onClick={() => {
                                setEditingNoteId(videoName);
                                setEditingNoteText(note);
                              }}
                              className="text-xs text-blue-600 hover:text-blue-800 underline whitespace-nowrap"
                            >
                              {note ? 'Edit note' : 'Add note'}
                            </button>
                          )}
                        </div>
                      );
                    })()}
                    
                    {/* Next Video */}
                    {(() => {
                      const currentIdx = trimmingProgress.successVideos.findIndex(
                        v => v.name === trimmingCurrentVideoName
                      );
                      const nextVideo = currentIdx >= 0 && currentIdx < trimmingProgress.successVideos.length - 1
                        ? trimmingProgress.successVideos[currentIdx + 1] 
                        : null;
                      if (!nextVideo) return null;
                      const videoData = videoResults.find(v => v.videoName === nextVideo.name);
                      const note = videoData?.step9Note || '';
                      const isEditing = editingNoteId === nextVideo.name;
                      
                      return (
                        <div className="flex items-start justify-between gap-3 p-3 bg-gray-50 rounded-lg">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">Next → {nextVideo.name}</p>
                            
                            {isEditing ? (
                              <div className="mt-2 space-y-2">
                                <textarea
                                  value={editingNoteText}
                                  onChange={(e) => setEditingNoteText(e.target.value)}
                                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  rows={3}
                                  placeholder="Add note for Step 9..."
                                />
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      const updatedVideoResults = videoResults.map(v =>
                                        v.videoName === nextVideo.name ? { ...v, step9Note: editingNoteText } : v
                                      );
                                      setVideoResults(updatedVideoResults);
                                      setEditingNoteId(null);
                                      setEditingNoteText('');
                                      toast.success('Note saved!');
                                      if (selectedCoreBeliefId && selectedEmotionalAngleId && selectedAdId && selectedCharacterId) {
                                        upsertContextSessionMutation.mutate({
                                          userId: currentUser.id,
                                          tamId: selectedTamId,
                                          coreBeliefId: selectedCoreBeliefId,
                                          emotionalAngleId: selectedEmotionalAngleId,
                                          adId: selectedAdId,
                                          characterId: selectedCharacterId,
                                          currentStep,
                                          rawTextAd,
                                          processedTextAd,
                                          adLines,
                                          prompts,
                                          images,
                                          combinations,
                                          deletedCombinations,
                                          videoResults: updatedVideoResults,
                                          reviewHistory,
                                          hookMergedVideos,
                                          bodyMergedVideoUrl,
                                          finalVideos,
                                        });
                                      }
                                    }}
                                    className="bg-green-600 hover:bg-green-700"
                                  >
                                    Save
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setEditingNoteId(null);
                                      setEditingNoteText('');
                                    }}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              note && (
                                <p className="mt-1 text-xs text-purple-600">📝 {note}</p>
                              )
                            )}
                          </div>
                          
                          {!isEditing && (
                            <button
                              onClick={() => {
                                setEditingNoteId(nextVideo.name);
                                setEditingNoteText(note);
                              }}
                              className="text-xs text-blue-600 hover:text-blue-800 underline whitespace-nowrap"
                            >
                              {note ? 'Edit note' : 'Add note'}
                            </button>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
                
                {/* Video List with Notes */}
                <div className="border-t pt-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Videos in this merge:</h3>
                  <div className="space-y-2">
                    {trimmingProgress.successVideos
                      .filter(video => !video.name.includes('(Hooks merged)') && !video.name.includes('(Body merged)'))
                      .map((video) => {
                      const videoData = videoResults.find(v => v.videoName === video.name);
                      const note = videoData?.step9Note || '';
                      
                      return (
                        <div key={video.name} className="flex items-start justify-between gap-3 p-3 bg-gray-50 rounded-lg">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">{video.name}</p>
                            
                            {/* Note editor */}
                            {editingNoteId === video.name ? (
                              <div className="mt-2 space-y-2">
                                <textarea
                                  value={editingNoteText}
                                  onChange={(e) => setEditingNoteText(e.target.value)}
                                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  rows={3}
                                  placeholder="Add note for Step 9..."
                                />
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      // Update videoResults
                                      const updatedVideoResults = videoResults.map(v =>
                                        v.videoName === video.name ? { ...v, step9Note: editingNoteText } : v
                                      );
                                      setVideoResults(updatedVideoResults);
                                      
                                      // Close editing mode
                                      setEditingNoteId(null);
                                      setEditingNoteText('');
                                      toast.success('Note saved!');
                                      
                                      // Save to database in background
                                      if (selectedCoreBeliefId && selectedEmotionalAngleId && selectedAdId && selectedCharacterId) {
                                        upsertContextSessionMutation.mutate({
                                          userId: currentUser.id,
                                          tamId: selectedTamId,
                                          coreBeliefId: selectedCoreBeliefId,
                                          emotionalAngleId: selectedEmotionalAngleId,
                                          adId: selectedAdId,
                                          characterId: selectedCharacterId,
                                          currentStep,
                                          rawTextAd,
                                          processedTextAd,
                                          adLines,
                                          prompts,
                                          images,
                                          combinations,
                                          deletedCombinations,
                                          videoResults: updatedVideoResults,
                                          reviewHistory,
                                          hookMergedVideos,
                                          bodyMergedVideoUrl,
                                          finalVideos,
                                        });
                                      }
                                    }}
                                    className="bg-green-600 hover:bg-green-700"
                                  >
                                    Save
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setEditingNoteId(null);
                                      setEditingNoteText('');
                                    }}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              note && (
                                <p className="mt-1 text-xs text-gray-600">📝 {note}</p>
                              )
                            )}
                          </div>
                          
                          {/* Add Note link */}
                          {editingNoteId !== video.name && (
                            <button
                              onClick={() => {
                                setEditingNoteId(video.name);
                                setEditingNoteText(note);
                              }}
                              className="text-xs text-blue-600 hover:text-blue-800 underline whitespace-nowrap"
                            >
                              {note ? 'Edit note' : 'Add note'}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
            
            {/* Action Buttons */}
            <div className="flex gap-2 mt-6">
              {/* Go to Step 10 (only if ALL videos succeeded and video player is visible) */}
              {trimmingProgress.status !== 'processing' && 
               trimmingProgress.failedVideos.length === 0 && 
               trimmingProgress.successVideos.length > 0 && 
               trimmingMergedVideoUrl && (
                <button
                  onClick={() => {
                    setIsTrimmingModalOpen(false);
                    setCurrentStep(10);
                  }}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  ➡️ Go to Step 10
                </button>
              )}
              
              {/* Retry Failed Button (only if processing complete and has failures) */}
              {trimmingProgress.status !== 'processing' && trimmingProgress.failedVideos.length > 0 && (
                <button
                  onClick={handleRetryFailedVideos}
                  className="flex-1 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  🔄 Retry Failed ({trimmingProgress.failedVideos.length})
                </button>
              )}
              
              {/* Close Button (only when NOT processing) */}
              {trimmingProgress.status !== 'processing' && (
                <button
                  onClick={() => setIsTrimmingModalOpen(false)}
                  className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  ❌ Close
                </button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Cut & Merge Modal */}
      <Dialog open={isMergeModalOpen} onOpenChange={setIsMergeModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              ✂️ Cut & Merge (Test)
            </DialogTitle>
            <DialogDescription>
              Preview merged video (temporary - not saved to database)
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {!mergedVideoUrl ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                <p className="text-sm text-gray-600">{mergeProgress}</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm font-semibold text-green-900">
                    ✅ Merge complete! Preview below:
                  </p>
                </div>
                
                <video
                  src={mergedVideoUrl}
                  controls
                  className="w-full rounded-lg border border-gray-300"
                  style={{ maxHeight: '400px' }}
                />
                
                <p className="text-xs text-gray-500 text-center">
                  💡 This is a temporary preview. Click "TRIM ALL VIDEOS" to save final cuts.
                </p>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button
              onClick={() => {
                setIsMergeModalOpen(false);
                setMergedVideoUrl(null);
                setMergeProgress('');
              }}
              variant="outline"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Download ZIP Progress Modal */}
      <Dialog open={isDownloadZipModalOpen} onOpenChange={setIsDownloadZipModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="w-5 h-5" />
              Descarcă Arhivă ZIP
            </DialogTitle>
            <DialogDescription>
              Creez arhiva cu toate videoclipurile acceptate...
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <p className="text-sm text-gray-600 text-center">{downloadZipProgress}</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Sample Merge Modal */}
      <Dialog open={isSampleMergeModalOpen} onOpenChange={(open) => {
        setIsSampleMergeModalOpen(open);
        if (!open) {
          setEditingNoteId(null);
          setEditingNoteText('');
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              🎬 Sample Merge ALL Videos
            </DialogTitle>
            <DialogDescription>
              Preview all videos merged together (temporary - not saved to database)
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {!sampleMergedVideoUrl ? (
              <div className="flex flex-col items-center gap-3">
                {sampleMergeCountdown > 0 ? (
                  <>
                    <div className="text-6xl font-bold text-orange-600">{sampleMergeCountdown}</div>
                    <p className="text-sm text-gray-600">{sampleMergeProgress}</p>
                    <p className="text-xs text-gray-500">Please wait for FFmpeg rate limit...</p>
                  </>
                ) : (
                  <>
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                    <p className="text-sm text-gray-600">{sampleMergeProgress}</p>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm font-semibold text-green-900">
                    ✅ Sample merge complete! Preview below:
                  </p>
                </div>
                
                {/* Video Player */}
                <video
                  id="sample-merge-video-player"
                  src={sampleMergedVideoUrl}
                  controls
                  className="w-full rounded-lg border border-gray-300"
                  style={{ maxHeight: '400px' }}
                />
                
                {/* Current Video Name Display (below video) */}
                <div className="bg-yellow-100 border-2 border-yellow-400 rounded-lg p-1.5 text-center">
                  <p className="text-xs font-bold text-yellow-900" id="current-video-name">
                    🎬 {currentPlayingVideoName || sampleMergeVideos[0]?.name || 'Loading...'}
                  </p>
                </div>
                
                {/* Video List with Notes */}
                <div className="border-t pt-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Videos in this merge:</h3>
                  <div className="space-y-2">
                    {sampleMergeVideos.map((video) => (
                      <div key={video.name} className="flex items-start justify-between gap-3 p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{video.name}</p>
                          
                          {/* Note editor */}
                          {editingNoteId === video.name ? (
                            <div className="mt-2 space-y-2">
                              <textarea
                                value={editingNoteText}
                                onChange={(e) => setEditingNoteText(e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                rows={3}
                                placeholder="Add note for Step 9..."
                              />
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    // 1. Update sampleMergeVideos INSTANTLY
                                    const updatedVideos = sampleMergeVideos.map(v =>
                                      v.name === video.name ? { ...v, note: editingNoteText } : v
                                    );
                                    setSampleMergeVideos(updatedVideos);
                                    
                                    // 2. Update videoResults INSTANTLY (note + recutStatus)
                                    const updatedVideoResults = videoResults.map(v =>
                                      v.videoName === video.name ? { ...v, step9Note: editingNoteText, recutStatus: 'recut' } : v
                                    );
                                    setVideoResults(updatedVideoResults);
                                    
                                    // 3. Close editing mode INSTANTLY
                                    setEditingNoteId(null);
                                    setEditingNoteText('');
                                    toast.success('Note saved & status changed to Recut!');
                                    
                                    // 4. Save to database in BACKGROUND (no await)
                                    if (selectedCoreBeliefId && selectedEmotionalAngleId && selectedAdId && selectedCharacterId) {
                                      upsertContextSessionMutation.mutate({
                                        userId: currentUser.id,
                                        coreBeliefId: selectedCoreBeliefId,
                                        emotionalAngleId: selectedEmotionalAngleId,
                                        adId: selectedAdId,
                                        characterId: selectedCharacterId,
                                        currentStep,
                                        rawTextAd,
                                        processedTextAd,
                                        adLines,
                                        prompts,
                                        images,
                                        combinations,
                                        deletedCombinations,
                                        videoResults: updatedVideoResults,
                                        reviewHistory,
                                      });
                                    }
                                  }}
                                  className="bg-orange-600 hover:bg-orange-700"
                                >
                                  📝 Save & Change Status to 'Recut'
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setEditingNoteId(null);
                                    setEditingNoteText('');
                                  }}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            video.note && (
                              <p className="mt-1 text-xs text-gray-600">📝 {video.note}</p>
                            )
                          )}
                        </div>
                        
                        {/* Add Note link */}
                        {editingNoteId !== video.name && (
                          <button
                            onClick={() => {
                              setEditingNoteId(video.name);
                              setEditingNoteText(video.note);
                            }}
                            className="text-xs text-blue-600 hover:text-blue-800 underline whitespace-nowrap"
                          >
                            {video.note ? 'Edit note' : 'Add note'}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                
                <p className="text-xs text-gray-500 text-center">
                  💡 This is a temporary preview. Click "TRIM ALL VIDEOS" to save final cuts.
                </p>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button
              onClick={() => {
                cancelSampleMergeRef.current = true;  // Signal cancellation
                setIsSampleMergeModalOpen(false);
                setSampleMergedVideoUrl(null);
                setSampleMergeProgress('');
                setSampleMergeCountdown(0);  // Cancel countdown
                setEditingNoteId(null);
                setEditingNoteText('');
              }}
              variant="outline"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>



        {/* Context Selector */}
        <div className="mb-4 p-3 bg-white border border-blue-200 rounded-lg shadow-sm">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-blue-900 mb-1 flex items-center gap-2">
              <span className="text-lg">🎯</span>
              Select Your Working Context
            </h2>
            <p className="text-sm text-gray-600">Choose all 5 categories to start working. This context will apply to all steps.</p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* TAM */}
            <div>
              <Label className="text-sm font-semibold text-blue-900 mb-2 block">
                1. TAM
              </Label>
              <Select 
                value={selectedTamId?.toString() || ''} 
                onValueChange={async (value) => {
                  if (value === 'new') {
                    const name = prompt('Enter new TAM name:');
                    if (name && name.trim()) {
                      const result = await createTamMutation.mutateAsync({
                        userId: localCurrentUser.id,
                        name: name.trim(),
                      });
                      setSelectedTamId(result.id);
                      refetchTams();
                      toast.success('TAM created!');
                    }
                  } else if (value) {
                    setSelectedTamId(parseInt(value));
                    // Reset dependent selections
                    setSelectedCoreBeliefId(null);
                    setSelectedEmotionalAngleId(null);
                    setSelectedAdId(null);
                    setSelectedCharacterId(null);
                  }
                }}
              >
                <SelectTrigger className="w-full bg-white">
                  <SelectValue placeholder="Select TAM" />
                </SelectTrigger>
                <SelectContent>
                  {tams.map((tam, index) => (
                    <SelectItem key={tam.id} value={tam.id.toString()}>{index + 1}. {tam.name}</SelectItem>
                  ))}
                  <SelectItem value="new">+ New TAM</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Core Belief */}
            <div>
              <Label className="text-sm font-semibold text-blue-900 mb-2 block">
                2. Core Belief
              </Label>
              <Select 
                value={selectedCoreBeliefId?.toString() || ''}
                disabled={!selectedTamId}
                onValueChange={async (value) => {
                  if (value === 'new') {
                    const name = prompt('Enter new Core Belief name:');
                    if (name && name.trim()) {
                      const result = await createCoreBeliefMutation.mutateAsync({
                        userId: localCurrentUser.id,
                        tamId: selectedTamId,
                        name: name.trim(),
                      });
                      setSelectedCoreBeliefId(result.id);
                      refetchCoreBeliefs();
                      toast.success('Core Belief created!');
                    }
                  } else if (value) {
                    setSelectedCoreBeliefId(parseInt(value));
                    // Reset dependent selections
                    setSelectedEmotionalAngleId(null);
                    setSelectedAdId(null);
                    setSelectedCharacterId(null);
                  }
                }}
              >
                <SelectTrigger className="w-full bg-white">
                  <SelectValue placeholder="Select Core Belief" />
                </SelectTrigger>
                <SelectContent>
                  {coreBeliefs.map((cb, index) => (
                    <SelectItem key={cb.id} value={cb.id.toString()}>{index + 1}. {cb.name}</SelectItem>
                  ))}
                  <SelectItem value="new">+ New Core Belief</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Emotional Angle */}
            <div>
              <Label className="text-sm font-semibold text-blue-900 mb-2 block">
                3. Emotional Angle
              </Label>
              <Select 
                value={selectedEmotionalAngleId?.toString() || ''}
                disabled={!selectedCoreBeliefId}
                onValueChange={async (value) => {
                  if (value === 'new') {
                    const name = prompt('Enter new Emotional Angle name:');
                    if (name && name.trim()) {
                      const result = await createEmotionalAngleMutation.mutateAsync({
                        userId: localCurrentUser.id,
                        coreBeliefId: selectedCoreBeliefId,
                        name: name.trim(),
                      });
                      setSelectedEmotionalAngleId(result.id);
                      refetchEmotionalAngles();
                      toast.success('Emotional Angle created!');
                    }
                  } else if (value) {
                    setSelectedEmotionalAngleId(parseInt(value));
                    // Reset dependent selections
                    setSelectedAdId(null);
                    setSelectedCharacterId(null);
                  }
                }}
              >
                <SelectTrigger className="w-full bg-white">
                  <SelectValue placeholder="Select Emotional Angle" />
                </SelectTrigger>
                <SelectContent>
                  {emotionalAngles.map((ea, index) => (
                    <SelectItem key={ea.id} value={ea.id.toString()}>{index + 1}. {ea.name}</SelectItem>
                  ))}
                  <SelectItem value="new">+ New Emotional Angle</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Ad */}
            <div>
              <Label className="text-sm font-semibold text-blue-900 mb-2 block">
                4. Ad
              </Label>
              <Select 
                value={selectedAdId?.toString() || ''}
                disabled={!selectedEmotionalAngleId}
                onValueChange={async (value) => {
                  if (value === 'new') {
                    const name = prompt('Enter new Ad name:');
                    if (name && name.trim()) {
                      const result = await createAdMutation.mutateAsync({
                        userId: localCurrentUser.id,
                        emotionalAngleId: selectedEmotionalAngleId,
                        name: name.trim(),
                      });
                      setSelectedAdId(result.id);
                      setSelectedCharacterId(null); // Reset character for new AD
                      refetchAds();
                      toast.success('Ad created!');
                    }
                  } else if (value) {
                    setSelectedAdId(parseInt(value));
                    // Reset character
                    setSelectedCharacterId(null);
                  }
                }}
              >
                <SelectTrigger className="w-full bg-white">
                  <SelectValue placeholder="Select Ad" />
                </SelectTrigger>
                <SelectContent>
                  {ads.map((ad, index) => (
                    <SelectItem key={ad.id} value={ad.id.toString()}>{index + 1}. {ad.name}</SelectItem>
                  ))}
                  <SelectItem value="new">+ New Ad</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Character (Required) */}
            <div>
              <Label className="text-sm font-semibold text-blue-900 mb-2 block">
                5. Character *
              </Label>
              <Select 
                value={selectedCharacterId?.toString() || ''}
                disabled={!selectedAdId}
                onValueChange={async (value) => {
                  if (value === 'new') {
                    const name = prompt('Enter new Character name:');
                    if (name && name.trim()) {
                      // Check for duplicate character name
                      const isDuplicate = categoryCharacters.some(char => char.name.toLowerCase() === name.trim().toLowerCase());
                      if (isDuplicate) {
                        toast.error(`Character "${name.trim()}" already exists!`);
                        return;
                      }
                      try {
                        const result = await createCharacterMutation.mutateAsync({
                          userId: localCurrentUser.id,
                          name: name.trim(),
                        });
                        await refetchCharacters();
                        setSelectedCharacterId(result.id);
                        toast.success('Character created!');
                      } catch (error: any) {
                        toast.error(`Failed to create character: ${error.message}`);
                      }
                    }
                  } else if (value) {
                    const newCharacterId = parseInt(value);
                    // Simply update character selection without auto-duplicate
                    setSelectedCharacterId(newCharacterId);
                    previousCharacterIdRef.current = newCharacterId;
                  }
                }}
              >
                <SelectTrigger className="w-full bg-white">
                  <SelectValue placeholder="Select Character" />
                </SelectTrigger>
                <SelectContent>
                  {/* UNUSED Characters */}
                  {sortedCategoryCharacters.unused.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-green-600 bg-green-50">
                        ✨ UNUSED ({sortedCategoryCharacters.unused.length})
                      </div>
                      {sortedCategoryCharacters.unused.map((char) => (
                        <SelectItem key={char.id} value={char.id.toString()}>
                          <div className="flex items-center gap-2">
                            {char.thumbnailUrl && (
                              <img 
                                src={char.thumbnailUrl} 
                                alt={char.name}
                                className="w-6 h-6 rounded-full object-cover"
                              />
                            )}
                            <span>{char.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </>
                  )}
                  
                  {/* USED Characters */}
                  {sortedCategoryCharacters.used.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 bg-gray-50 border-t">
                        📋 USED ({sortedCategoryCharacters.used.length})
                      </div>
                      {sortedCategoryCharacters.used.map((char) => (
                        <SelectItem key={char.id} value={char.id.toString()}>
                          <div className="flex items-center gap-2">
                            {char.thumbnailUrl && (
                              <img 
                                src={char.thumbnailUrl} 
                                alt={char.name}
                                className="w-6 h-6 rounded-full object-cover"
                              />
                            )}
                            <span>{char.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </>
                  )}
                  
                  <SelectItem value="new">+ New Character</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          

        </div>

        {/* Context Required Warning */}
        {(!selectedTamId || !selectedCoreBeliefId || !selectedEmotionalAngleId || !selectedAdId || !selectedCharacterId) && (
          <div className="mb-8 p-6 bg-red-50 border-2 border-red-300 rounded-lg">
            <h3 className="text-xl font-bold text-red-900 mb-2 flex items-center gap-2">
              <span className="text-2xl">⛔</span>
              Context Required
            </h3>
            <p className="text-red-700">Please select all 5 categories (TAM, Core Belief, Emotional Angle, Ad, Character) in the context selector above to access the workflow steps.</p>
          </div>
        )}

        {/* Breadcrumbs - Professional & Consistent */}
        {selectedTamId && selectedCoreBeliefId && selectedEmotionalAngleId && selectedAdId && selectedCharacterId && (
        <div className="w-full mb-8">
          <div className="flex items-center justify-between px-6 py-6 bg-white rounded-lg shadow-sm border border-gray-200">
            {[
              { num: 1, label: "Prepare", fullLabel: "Prepare Ad" },
              { num: 2, label: "Extract", fullLabel: "Extracted Lines" },
              { num: 3, label: "Prompts", fullLabel: "Prompts" },
              { num: 4, label: "Images", fullLabel: "Images" },
              { num: 5, label: "Mapping", fullLabel: "Mapping" },
              { num: 6, label: "Generate", fullLabel: "Generate" },
              { num: 7, label: "Check", fullLabel: "Check Videos" },
              { num: 8, label: "Cut Prep", fullLabel: "Prepare for Cut" },
              { num: 9, label: "Trimmed", fullLabel: "Trimmed Videos" },
              { num: 10, label: "Merge", fullLabel: "Merge Videos" },
              { num: 11, label: "Final", fullLabel: "Final Videos" },
            ].map((step, index, array) => (
              <div key={step.num} className="contents">
                {/* Step Container */}
                <div className="flex flex-col items-center gap-2 relative group">
                  {/* Badge */}
                  <button
                    onClick={() => goToStep(step.num)}
                    title={step.fullLabel}
                    className={`
                      w-14 h-14 rounded-full 
                      flex items-center justify-center 
                      font-bold text-lg
                      transition-all duration-200
                      relative z-10
                      ${
                        currentStep === step.num
                          ? "bg-blue-600 text-white shadow-lg ring-4 ring-blue-200"
                          : currentStep > step.num
                          ? "bg-green-500 text-white shadow-md hover:bg-green-600 hover:scale-105"
                          : "bg-gray-200 text-gray-500 hover:bg-gray-300"
                      }
                    `}
                  >
                    {currentStep > step.num ? (
                      <Check className="w-7 h-7" />
                    ) : (
                      step.num
                    )}
                  </button>
                  
                  {/* Label */}
                  <span className={`
                    text-xs font-semibold text-center
                    whitespace-nowrap
                    transition-colors duration-200
                    ${
                      currentStep === step.num
                        ? "text-blue-900 font-bold"
                        : currentStep > step.num
                        ? "text-green-700"
                        : "text-gray-500"
                    }
                  `}>
                    {step.label}
                  </span>
                  
                  {/* Tooltip on Hover */}
                  <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-20">
                    <div className="bg-gray-900 text-white text-xs py-1 px-3 rounded shadow-lg whitespace-nowrap">
                      {step.fullLabel}
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                        <div className="border-4 border-transparent border-t-gray-900"></div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Connector Line */}
                {index < array.length - 1 && (
                  <div className="flex-1 flex items-center px-2">
                    <div className={`
                      h-1 w-full rounded-full
                      transition-all duration-300
                      ${
                        currentStep > step.num ? "bg-green-500" : "bg-gray-200"
                      }
                    `} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        )}

        {/* Back Button */}
        {selectedTamId && selectedCoreBeliefId && selectedEmotionalAngleId && selectedAdId && selectedCharacterId && currentStep > 1 && (
          <div className="mb-4">
            <Button
              onClick={goBack}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              Înapoi la STEP {currentStep - 1}
            </Button>
          </div>
        )}
        
        {/* All Steps - Only show if context is complete */}
        {selectedTamId && selectedCoreBeliefId && selectedEmotionalAngleId && selectedAdId && selectedCharacterId && (
        <>
        {/* STEP 1: Prepare Text Ad */}
        {currentStep === 1 && (
          <Card className="mb-8 border-2 border-blue-200">
            <CardHeader className="bg-blue-50">
              <CardTitle className="flex items-center gap-2 text-blue-900">
                <FileText className="w-5 h-5" />
                STEP 1 - Prepare Text Ad
              </CardTitle>
              <CardDescription>
                Selectează categoriile și pregătește textul ad-ului (118-125 caractere).
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 md:pt-8 px-3 md:px-8 pb-4 md:pb-8">
              {/* Context Info */}
              <div className="mb-6 p-4 bg-blue-50/50 border-2 border-blue-200 rounded-lg">
                <h3 className="text-lg font-semibold text-blue-900 mb-4">Current Context</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="font-medium text-gray-600">Core Belief:</span>
                    <p className="text-blue-900 font-semibold">{coreBeliefs.find(cb => cb.id === selectedCoreBeliefId)?.name || 'Not selected'}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">Emotional Angle:</span>
                    <p className="text-blue-900 font-semibold">{emotionalAngles.find(ea => ea.id === selectedEmotionalAngleId)?.name || 'Not selected'}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">Ad:</span>
                    <p className="text-blue-900 font-semibold">{ads.find(ad => ad.id === selectedAdId)?.name || 'Not selected'}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">Character:</span>
                    <div className="flex items-center gap-2 mt-1">
                      {selectedCharacterId && categoryCharacters.find(char => char.id === selectedCharacterId)?.thumbnailUrl && (
                        <img 
                          src={categoryCharacters.find(char => char.id === selectedCharacterId)?.thumbnailUrl || ''} 
                          alt="Character"
                          className="w-8 h-8 rounded-full object-cover border-2 border-blue-300"
                        />
                      )}
                      <p className="text-blue-900 font-semibold">{categoryCharacters.find(char => char.id === selectedCharacterId)?.name || 'Not selected'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* COPY CONTEXT Button */}
              <div className="mb-6">
                <Button
                  onClick={async () => {
                    // Check if current context has data to copy
                    if (!rawTextAd || rawTextAd.trim().length === 0) {
                      toast.error('Current Ad has no data to copy. Please add content first.');
                      return;
                    }
                    
                    // Find all available target Ads for current context (exclude current Ad)
                    const targetAds = ads.filter(ad => 
                      ad.emotionalAngleId === selectedEmotionalAngleId && ad.id !== selectedAdId
                    );
                    
                    if (targetAds.length === 0) {
                      toast.error('No other Ads available for this Emotional Angle');
                      return;
                    }
                    
                    // Show selection dialog
                    const adNames = targetAds.map(ad => `${ad.id}. ${ad.name}`).join('\n');
                    const selection = prompt(`Copy context TO which Ad?\n\n${adNames}\n\nEnter Ad ID:`);
                    
                    if (!selection) return;
                    
                    const targetAdId = parseInt(selection);
                    const targetAd = targetAds.find(ad => ad.id === targetAdId);
                    
                    if (!targetAd) {
                      toast.error('Invalid Ad ID');
                      return;
                    }
                    
                    // Confirm action
                    if (!confirm(`Copy context FROM current Ad \"${ads.find(ad => ad.id === selectedAdId)?.name}\" TO \"${targetAd.name}\"?\n\nThis will overwrite Step 1-3 data in the target Ad.`)) {
                      return;
                    }
                    
                    // Copy Step 1-3 data to target Ad
                    const updatedSession = {
                      userId: localCurrentUser.id,
                      tamId: selectedTamId!,
                      coreBeliefId: selectedCoreBeliefId!,
                      emotionalAngleId: selectedEmotionalAngleId!,
                      adId: targetAdId,
                      characterId: selectedCharacterId!,
                      currentStep: 4, // Set to Step 4
                      rawTextAd,
                      processedTextAd,
                      adLines: JSON.stringify(adLines),
                      prompts: '[]',
                      images: '[]',
                      combinations: '[]',
                      deletedCombinations: '[]',
                      videoResults: '[]',
                      reviewHistory: '[]',
                    };
                    
                    upsertContextSessionMutation.mutate(updatedSession, {
                      onSuccess: () => {
                        toast.success(`Context copied to \"${targetAd.name}\"!`);
                      },
                      onError: (error: any) => {
                        toast.error(`Failed to copy context: ${error.message}`);
                      },
                    });
                  }}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                  disabled={!selectedAdId || !selectedCharacterId || adLines.length === 0}
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  COPY CONTEXT TO ANOTHER AD
                </Button>
                <p className="text-xs text-gray-500 mt-2">Copy Step 1-3 data from current Ad to another Ad with the same character</p>
              </div>

              {/* OLD CATEGORIES - TO BE REMOVED */}
              <div className="hidden">
                <div className="mb-4">
                  <Label className="text-blue-900 font-medium mb-2 block">Core Belief:</Label>
                  <Select 
                    value={selectedCoreBeliefId?.toString() || ''} 
                    onValueChange={async (value) => {
                      if (value === 'new') {
                        const name = prompt('Enter new Core Belief name:');
                        if (name && name.trim()) {
                          const result = await createCoreBeliefMutation.mutateAsync({
                            userId: localCurrentUser.id,
                            name: name.trim(),
                          });
                          await refetchCoreBeliefs();
                          setSelectedCoreBeliefId(result.id);
                          setSelectedEmotionalAngleId(null);
                          setSelectedAdId(null);
                          toast.success('Core Belief created!');
                        }
                      } else {
                        setSelectedCoreBeliefId(parseInt(value));
                        setSelectedEmotionalAngleId(null);
                        setSelectedAdId(null);
                      }
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select Core Belief" />
                    </SelectTrigger>
                    <SelectContent>
                      {coreBeliefs.map((cb) => (
                        <SelectItem key={cb.id} value={cb.id.toString()}>{cb.name}</SelectItem>
                      ))}
                      <SelectItem value="new">+ New Core Belief</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Emotional Angle */}
                {selectedCoreBeliefId && (
                  <div className="mb-4">
                    <Label className="text-blue-900 font-medium mb-2 block">Emotional Angle:</Label>
                    <Select 
                      value={selectedEmotionalAngleId?.toString() || ''} 
                      onValueChange={async (value) => {
                        if (value === 'new') {
                          const name = prompt('Enter new Emotional Angle name:');
                          if (name && name.trim()) {
                            const result = await createEmotionalAngleMutation.mutateAsync({
                              userId: localCurrentUser.id,
                              coreBeliefId: selectedCoreBeliefId,
                              name: name.trim(),
                            });
                            await refetchEmotionalAngles();
                            setSelectedEmotionalAngleId(result.id);
                            setSelectedAdId(null);
                            toast.success('Emotional Angle created!');
                          }
                        } else {
                          setSelectedEmotionalAngleId(parseInt(value));
                          setSelectedAdId(null);
                        }
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select Emotional Angle" />
                      </SelectTrigger>
                      <SelectContent>
                        {emotionalAngles.map((ea) => (
                          <SelectItem key={ea.id} value={ea.id.toString()}>{ea.name}</SelectItem>
                        ))}
                        <SelectItem value="new">+ New Emotional Angle</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Ad */}
                {selectedEmotionalAngleId && (
                  <div className="mb-4">
                    <Label className="text-blue-900 font-medium mb-2 block">Ad:</Label>
                    <Select 
                      value={selectedAdId?.toString() || ''} 
                      onValueChange={async (value) => {
                        if (value === 'new') {
                          const name = prompt('Enter new Ad name:');
                          if (name && name.trim()) {
                            const result = await createAdMutation.mutateAsync({
                              userId: localCurrentUser.id,
                              emotionalAngleId: selectedEmotionalAngleId,
                              name: name.trim(),
                            });
                            await refetchAds();
                            setSelectedAdId(result.id);
                            setSelectedCharacterId(null); // Reset character for new AD
                            toast.success('Ad created!');
                          }
                        } else {
                          setSelectedAdId(parseInt(value));
                        }
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select Ad" />
                      </SelectTrigger>
                      <SelectContent>
                        {ads.map((ad) => (
                          <SelectItem key={ad.id} value={ad.id.toString()}>{ad.name}</SelectItem>
                        ))}
                        <SelectItem value="new">+ New Ad</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Character (Optional) */}
                {selectedAdId && (
                  <div className="mb-4">
                    <Label className="text-blue-900 font-medium mb-2 block">Character (Optional):</Label>
                    <Select 
                      value={selectedCharacterId?.toString() || 'none'} 
                      onValueChange={async (value) => {
                        if (value === 'new') {
                          const name = prompt('Enter new Character name:');
                          if (name && name.trim()) {
                            // Check for duplicate character name
                            const isDuplicate = categoryCharacters.some(char => char.name.toLowerCase() === name.trim().toLowerCase());
                            if (isDuplicate) {
                              toast.error(`Character "${name.trim()}" already exists!`);
                              return;
                            }
                            const result = await createCharacterMutation.mutateAsync({
                              userId: localCurrentUser.id,
                              name: name.trim(),
                            });
                            await refetchCharacters();
                            setSelectedCharacterId(result.id);
                            toast.success('Character created!');
                          }
                        } else if (value === 'none') {
                          setSelectedCharacterId(null);
                        } else {
                          setSelectedCharacterId(parseInt(value));
                        }
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select Character (Optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        
                        {/* UNUSED Characters */}
                        {sortedCategoryCharacters.unused.length > 0 && (
                          <>
                            <div className="px-2 py-1.5 text-xs font-semibold text-green-600 bg-green-50">
                              ✨ UNUSED ({sortedCategoryCharacters.unused.length})
                            </div>
                            {sortedCategoryCharacters.unused.map((char) => (
                              <SelectItem key={char.id} value={char.id.toString()}>{char.name}</SelectItem>
                            ))}
                          </>
                        )}
                        
                        {/* USED Characters */}
                        {sortedCategoryCharacters.used.length > 0 && (
                          <>
                            <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 bg-gray-50 border-t">
                              📋 USED ({sortedCategoryCharacters.used.length})
                            </div>
                            {sortedCategoryCharacters.used.map((char) => (
                              <SelectItem key={char.id} value={char.id.toString()}>{char.name}</SelectItem>
                            ))}
                          </>
                        )}
                        <SelectItem value="new">+ New Character</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Show text input section only after all required categories are selected */}
              {selectedTamId && selectedCoreBeliefId && selectedEmotionalAngleId && selectedAdId && selectedCharacterId && (
                <>
                  {/* Input Method Selector */}
                  <div className="mb-6">
                    <Label className="text-blue-900 font-medium mb-2 block">Input Method:</Label>
                    <Select value={textAdMode} onValueChange={(value: 'upload' | 'paste' | 'google-doc') => setTextAdMode(value)}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="upload">Upload Ad</SelectItem>
                        <SelectItem value="paste">Paste Ad</SelectItem>
                        <SelectItem value="google-doc">Google Doc Link</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Upload Mode */}
                  {textAdMode === 'upload' && (
                    <div className="mb-6">
                      <div
                        className="border-2 border-dashed border-blue-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors cursor-pointer bg-blue-50/50"
                        onClick={() => document.getElementById('text-upload')?.click()}
                        onDrop={handleTextFileDrop}
                        onDragOver={handleTextFileDragOver}
                      >
                        {rawTextAd && uploadedFileName ? (
                          <>
                            <FileText className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                            <p className="text-blue-900 font-semibold mb-1">{uploadedFileName}</p>
                            <p className="text-sm text-gray-600 mb-2">{(rawTextAd.length / 1024).toFixed(1)} KB • {rawTextAd.length} characters</p>
                            <p className="text-xs text-blue-600 hover:text-blue-800">Click to replace</p>
                          </>
                        ) : (
                          <>
                            <Upload className="w-12 h-12 text-blue-500 mx-auto mb-4" />
                            <p className="text-blue-900 font-medium mb-2">Drop text file here or click to upload</p>
                            <p className="text-sm text-gray-500 italic">Suportă .txt, .doc, .docx</p>
                          </>
                        )}
                        <input
                          id="text-upload"
                          type="file"
                          accept=".txt,.doc,.docx"
                          className="hidden"
                          onChange={handleTextFileUpload}
                        />
                      </div>
                      {rawTextAd && (
                        <div className="mt-4 p-4 bg-white border border-blue-200 rounded-lg">
                          <p className="text-sm text-gray-700 mb-2"><strong>Preview:</strong></p>
                          <p className="text-sm text-gray-600 whitespace-pre-wrap">{rawTextAd.replace(/\n\s*\n\s*\n+/g, '\n\n').substring(0, 200)}{rawTextAd.length > 200 ? '...' : ''}</p>
                          <p className="text-xs text-gray-500 mt-2">{rawTextAd.length} characters</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Paste Mode */}
                  {textAdMode === 'paste' && (
                    <div className="mb-6">
                      <Label className="text-blue-900 font-medium mb-2 block">Paste your ad text:</Label>
                      <textarea
                        value={rawTextAd}
                        onChange={(e) => setRawTextAd(e.target.value)}
                        className="w-full h-40 p-4 border-2 border-blue-300 rounded-lg focus:border-blue-500 focus:outline-none"
                        placeholder="Paste your ad text here..."
                      />
                      {rawTextAd && (
                        <p className="text-xs text-gray-500 mt-2">{rawTextAd.length} characters</p>
                      )}
                    </div>
                  )}

                  {/* Google Doc Mode */}
                  {textAdMode === 'google-doc' && (
                    <div className="mb-6">
                      <Label className="text-blue-900 font-medium mb-2 block">Google Doc Link:</Label>
                      <input
                        type="text"
                        placeholder="Paste Google Doc link here (e.g., https://docs.google.com/document/d/...)" 
                        className="w-full p-4 border-2 border-blue-300 rounded-lg focus:border-blue-500 focus:outline-none mb-4"
                        onPaste={async (e) => {
                          const link = e.clipboardData.getData('text');
                          if (link.includes('docs.google.com/document')) {
                            try {
                              // Extract document ID from link
                              const docIdMatch = link.match(/\/d\/([a-zA-Z0-9-_]+)/);
                              if (!docIdMatch) {
                                toast.error('Invalid Google Doc link format');
                                return;
                              }
                              const docId = docIdMatch[1];
                              
                              // Convert to export URL (plain text)
                              const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`;
                              
                              toast.info('Fetching Google Doc content...');
                              
                              // Fetch the document content
                              const response = await fetch(exportUrl);
                              if (!response.ok) {
                                toast.error('Failed to fetch Google Doc. Make sure the document is publicly accessible.');
                                return;
                              }
                              
                              const text = await response.text();
                              setRawTextAd(text);
                              setUploadedFileName('Google Doc');
                              toast.success('Google Doc loaded successfully!');
                            } catch (error) {
                              console.error('Error fetching Google Doc:', error);
                              toast.error('Failed to load Google Doc');
                            }
                          } else {
                            toast.error('Please paste a valid Google Doc link');
                          }
                        }}
                      />
                      {rawTextAd && (
                        <div className="mt-4 p-4 bg-white border border-blue-200 rounded-lg">
                          <p className="text-sm text-gray-700 mb-2"><strong>Preview:</strong></p>
                          <p className="text-sm text-gray-600 whitespace-pre-wrap">{rawTextAd.substring(0, 200)}{rawTextAd.length > 200 ? '...' : ''}</p>
                          <p className="text-xs text-gray-500 mt-2">{rawTextAd.length} characters</p>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex justify-end mt-4">
                    <Button
                      onClick={processText}
                      disabled={!rawTextAd || rawTextAd.trim().length === 0 || processTextAdMutation.isPending}
                      className="bg-blue-600 hover:bg-blue-700 px-8 py-8 text-lg"
                    >
                      {processTextAdMutation.isPending ? 'Processing...' : (
                        <>
                          <FileEdit className="w-5 h-5 mr-2" />
                          Next: Prepare Ad
                          <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </>
                      )}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* STEP 2: Text Ad Document */}
        {currentStep === 2 && (
          <Card className="mb-8 border-2 border-blue-200">
            <CardHeader className="bg-blue-50">
              <CardTitle className="flex items-center gap-2 text-blue-900">
                <FileText className="w-5 h-5" />
                STEP 2 - Text Ad Document
              </CardTitle>
              <CardDescription>
                Încărcă documentul cu ad-ul (.docx). Liniile vor fi extrase automat.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 md:pt-6 px-3 md:px-6">
              {/* Document Upload (only shown when no lines available) */}
              {adLines.length === 0 && (
                <div className="mb-6 p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-yellow-900 text-sm">
                    ⚠️ No lines available from STEP 1. Please go back to STEP 1 to process text.
                  </p>
                </div>
              )}
              
              <div
                onDrop={handleAdDocumentDrop}
                onDragOver={(e) => e.preventDefault()}
                className="border-2 border-dashed border-blue-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors cursor-pointer bg-blue-50/50"
                onClick={() => !adDocument && document.getElementById('ad-upload')?.click()}
                style={{ display: adDocument || adLines.length > 0 ? 'none' : 'block' }}
              >
                <Upload className="w-12 h-12 text-blue-500 mx-auto mb-4" />
                <p className="text-blue-900 font-medium mb-2">
                  Drop document here or click to upload
                </p>
                <p className="text-sm text-gray-500 italic">Suportă .docx, .doc</p>
              </div>
              <input
                id="ad-upload"
                type="file"
                accept=".docx,.doc"
                className="hidden"
                onChange={handleAdDocumentSelect}
              />
              
              {/* Buton șterge document */}
              {adDocument && (
                <div className="mt-4">
                  <Button
                    onClick={() => {
                      setAdDocument(null);
                      setAdLines([]);
                      const input = document.getElementById('ad-upload') as HTMLInputElement;
                      if (input) input.value = '';
                      toast.success('Document șters. Poți încărca altul.');
                    }}
                    variant="outline"
                    className="border-red-300 text-red-700 hover:bg-red-50"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Șterge document
                  </Button>
                </div>
              )}

              {adLines.length > 0 && (
                <div className="mt-6">
                  {deletedLinesHistory.length > 0 && (
                    <div className="mb-4">
                      <Button
                        onClick={() => {
                          const lastDeleted = deletedLinesHistory[0];
                          setAdLines(prev => [...prev, lastDeleted]);
                          setDeletedLinesHistory(prev => prev.slice(1));
                          toast.success(`Linie restaurată: ${lastDeleted.videoName}`);
                        }}
                        variant="outline"
                        size="sm"
                        className="gap-2"
                      >
                        <Undo2 className="w-4 h-4" />
                        UNDO - Restaurează ultima linie ștearsă
                      </Button>
                    </div>
                  )}
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-medium text-blue-900">
                      {adLines.filter(l => l.categoryNumber > 0).length} linii extrase:
                    </p>
                  </div>
                  <div className="space-y-2">
                    {adLines.map((line) => {
                      // If categoryNumber is 0, this is a label (section header)
                      if (line.categoryNumber === 0) {
                        // Check if this is a subcategory (H1-H100) or main category
                        const isSubcategory = /^H\d+$/.test(line.text);
                        
                        return (
                          <div key={line.id} className="mt-4 mb-2">
                            {isSubcategory ? (
                              <h4 className="font-bold text-blue-700 text-base border-b border-blue-200 pb-1">
                                {line.text}
                              </h4>
                            ) : (
                              <h3 className="font-bold text-blue-800 text-lg border-b-2 border-blue-300 pb-1">
                                {line.text}
                              </h3>
                            )}
                          </div>
                        );
                      }
                      
                      // Otherwise, it's a content line
                      // Split text into normal (black) and added (red) parts
                      const hasRedText = line.redStart !== undefined && line.redStart >= 0 && line.redEnd !== undefined;
                      const redText = hasRedText ? line.text.substring(line.redStart, line.redEnd) : '';
                      const whiteBeforeRed = hasRedText ? line.text.substring(0, line.redStart) : '';
                      const whiteAfterRed = hasRedText ? line.text.substring(line.redEnd) : line.text;
                      
                      // Determine display order: if RED is at start (redStart = 0), show RED first
                      const redAtStart = hasRedText && line.redStart === 0;
                      
                      return (
                        <div key={line.id} className="ml-4" data-line-id={line.id}>
                          <div className="p-3 bg-white rounded border border-blue-200 text-sm relative">
                            {/* Edit and Delete Buttons */}
                            <div className="absolute top-2 right-2 flex gap-2">
                              <Button
                                onClick={() => {
                                  if (confirm(`Șterge linia "${line.videoName}"?`)) {
                                    // Save to history before deleting
                                    setDeletedLinesHistory(prev => [line, ...prev]);
                                    setAdLines(prev => prev.filter(l => l.id !== line.id));
                                    toast.success('Linie ștearsă (UNDO disponibil)');
                                  }
                                }}
                                variant="outline"
                                size="sm"
                                className="border-red-300 text-red-700 hover:bg-red-50"
                              >
                                Del
                              </Button>
                              <Button
                                onClick={() => {
                                  if (editingLineId === line.id) {
                                    setEditingLineId(null);
                                  } else {
                                    setEditingLineId(line.id);
                                    // Normalize text: remove excessive line breaks (3+ newlines → 2 newlines)
                                    const normalizedText = line.text.replace(/\n\s*\n\s*\n+/g, '\n\n');
                                    setEditingLineText(normalizedText);
                                    setEditingLineRedStart(line.redStart ?? -1);
                                    setEditingLineRedEnd(line.redEnd ?? -1);
                                  }
                                }}
                                variant="outline"
                                size="sm"
                              >
                                {editingLineId === line.id ? 'Cancel' : 'Edit'}
                              </Button>
                            </div>
                            
                            {/* Name above text */}
                            <div className="mb-1">
                              <span className="text-xs text-gray-500 italic">{line.videoName}</span>
                            </div>
                            
                            {/* Text with red highlighting */}
                            <p className="text-gray-800 mb-2 pr-16">
                              {redAtStart && <span className="text-red-600 font-medium">{redText}</span>}
                              {whiteBeforeRed}
                              {!redAtStart && hasRedText && <span className="text-red-600 font-medium">{redText}</span>}
                              {whiteAfterRed}
                            </p>
                            
                            {/* Character count */}
                            <div className="text-xs text-gray-500">
                              {line.charCount} caractere
                            </div>
                          </div>
                          
                          {/* Inline Edit Form */}
                          {editingLineId === line.id && (
                            <div className="mt-2 p-4 bg-blue-50 border-2 border-blue-300 rounded-lg space-y-3">
                              <h5 className="font-bold text-blue-900">Edit Text</h5>
                              
                              {/* Textarea */}
                              <div>
                                <Label className="text-sm text-gray-700 mb-1 block">Text:</Label>
                                <textarea
                                  value={editingLineText}
                                  onChange={(e) => {
                                    setEditingLineText(e.target.value);
                                  }}
                                  className="w-full h-20 p-2 border border-gray-300 rounded resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                  placeholder="Enter text..."
                                />
                                <div className={`text-xs mt-1 ${
                                  editingLineText.length > 125 ? 'text-orange-600 font-bold' : 'text-gray-600'
                                }`}>
                                  {editingLineText.length} / 125 characters
                                  {editingLineText.length > 125 && (
                                    <span className="ml-2">⚠️ Warning: Exceeds 125 characters!</span>
                                  )}
                                </div>
                              </div>
                              
                              {/* Mark RED/BLACK Buttons */}
                              <div>
                                <Label className="text-sm text-gray-700 mb-2 block">Mark text as RED:</Label>
                                <div className="flex gap-2">
                                  <Button
                                    onClick={() => {
                                      const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
                                      if (textarea) {
                                        const start = textarea.selectionStart;
                                        const end = textarea.selectionEnd;
                                        if (start !== end) {
                                          setEditingLineRedStart(start);
                                          setEditingLineRedEnd(end);
                                          toast.success('Text marked as RED');
                                        } else {
                                          toast.error('Please select text first');
                                        }
                                      }
                                    }}
                                    size="sm"
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    Mark as RED
                                  </Button>
                                  <Button
                                    onClick={() => {
                                      setEditingLineRedStart(-1);
                                      setEditingLineRedEnd(-1);
                                      toast.success('RED marking removed');
                                    }}
                                    size="sm"
                                    variant="outline"
                                  >
                                    Clear RED
                                  </Button>
                                </div>
                              </div>
                              
                              {/* Preview */}
                              {editingLineRedStart >= 0 && editingLineRedEnd > editingLineRedStart && (
                                <div>
                                  <Label className="text-sm text-gray-700 mb-1 block">Preview:</Label>
                                  <div className="p-3 bg-white border border-gray-300 rounded">
                                    <p className="text-gray-800">
                                      {editingLineText.substring(0, editingLineRedStart)}
                                      <span className="text-red-600 font-medium">
                                        {editingLineText.substring(editingLineRedStart, editingLineRedEnd)}
                                      </span>
                                      {editingLineText.substring(editingLineRedEnd)}
                                    </p>
                                  </div>
                                </div>
                              )}
                              
                              {/* Save Button */}
                              <div className="flex gap-2">
                                <Button
                                  onClick={() => {
                                    setAdLines(prev => prev.map(l => {
                                      if (l.id === line.id) {
                                        return {
                                          ...l,
                                          text: editingLineText,
                                          charCount: editingLineText.length,
                                          redStart: editingLineRedStart,
                                          redEnd: editingLineRedEnd,
                                        };
                                      }
                                      return l;
                                    }));
                                    // Lock system removed
                                    
                                    toast.success('Text saved!');
                                    setEditingLineId(null);
                                    
                                    // Auto-scroll back to the edited line
                                    setTimeout(() => {
                                      const element = document.querySelector(`[data-line-id="${line.id}"]`);
                                      if (element) {
                                        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                      }
                                    }, 100);
                                  }}
                                  className="bg-blue-600 hover:bg-blue-700"
                                >
                                  Save
                                </Button>
                                <Button
                                  variant="outline"
                                  onClick={() => setEditingLineId(null)}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-6 flex justify-between items-center">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentStep(1)}
                      className="px-6 py-3"
                    >
                      <ChevronLeft className="w-4 h-4 mr-2" />
                      Back
                    </Button>
                    <Button
                      onClick={() => {
                        // Save to database before moving to next step
                        if (selectedCoreBeliefId && selectedEmotionalAngleId && selectedAdId && selectedCharacterId) {
                          upsertContextSessionMutation.mutate({
                            userId: localCurrentUser.id,
                            coreBeliefId: selectedCoreBeliefId,
                            emotionalAngleId: selectedEmotionalAngleId,
                            adId: selectedAdId,
                            characterId: selectedCharacterId,
                            currentStep: 2,
                            rawTextAd,
                            processedTextAd,
                            adLines,
                            prompts,
                            images,
                            combinations,
                            deletedCombinations,
                            videoResults,
                            reviewHistory,
                          }, {
                            onSuccess: () => {
                              console.log('[Step 2] Saved before moving to Step 3');
                              setCurrentStep(3);
                            },
                            onError: (error) => {
                              console.error('[Step 2] Save failed:', error);
                              // Still move to next step (don't block user)
                              setCurrentStep(3);
                            },
                          });
                        } else {
                          setCurrentStep(3);
                        }
                      }}
                      className="bg-blue-600 hover:bg-blue-700 px-8 py-8 text-lg"
                    >
                      <MessageSquare className="w-5 h-5 mr-2" />
                      Next: Choose Prompts
                      <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Button>
                  </div>
                </div>
              )}
              
              {/* OLD CONTENT - TO BE REMOVED */}
              <div className="hidden">
              <div className="mb-6">
                <Label className="text-blue-900 font-medium mb-2 block">Tip prompturi:</Label>
                <Select value={promptMode} onValueChange={(value: 'hardcoded' | 'custom' | 'manual') => setPromptMode(value)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hardcoded">Prompturi hardcodate</SelectItem>
                    <SelectItem value="custom">Adaugă prompturi custom</SelectItem>
                    <SelectItem value="manual">Manual prompt</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Mode: Prompturi hardcodate */}
              {promptMode === 'hardcoded' && (
                <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="mb-2">
                    <span className="font-medium text-green-900">Prompturi hardcodate (întotdeauna active)</span>
                  </div>
                  <div className="text-sm text-green-700 space-y-1">
                    <p>✓ PROMPT_NEUTRAL - pentru secțiuni până la TRANSFORMATION</p>
                    <p>✓ PROMPT_SMILING - pentru TRANSFORMATION și CTA</p>
                    <p>✓ PROMPT_CTA - pentru CTA cu carte</p>
                  </div>
                </div>
              )}

              {/* Mode: Upload prompturi custom */}
              {promptMode === 'custom' && (
              <div className="mb-4">
                <p className="font-medium text-blue-900 mb-3">Adaugă prompturi custom (opțional):</p>
                
                {/* Upload .docx */}
                <div
                  onDrop={handlePromptDocumentDrop}
                  onDragOver={(e) => e.preventDefault()}
                  className="border-2 border-dashed border-blue-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors cursor-pointer bg-blue-50/50 mb-4"
                  onClick={() => document.getElementById('prompt-upload')?.click()}
                >
                  <Upload className="w-12 h-12 text-blue-500 mx-auto mb-4" />
                  <p className="text-blue-900 font-medium mb-2">
                    Drop prompt documents here or click to upload
                  </p>
                  <p className="text-sm text-gray-500 italic">Suportă .docx, .doc (maxim 3 fișiere)</p>
                  <input
                    id="prompt-upload"
                    type="file"
                    accept=".docx,.doc"
                    multiple
                    className="hidden"
                    onChange={handlePromptDocumentSelect}
                  />
                </div>

                {prompts.length > 0 && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="font-medium text-blue-900">
                        {prompts.length} prompturi custom încărcate:
                      </p>
                      <Button
                        onClick={() => {
                          setPrompts([]);
                          const input = document.getElementById('prompt-upload') as HTMLInputElement;
                          if (input) input.value = '';
                          toast.success('Toate prompturile custom au fost șterse.');
                        }}
                        variant="outline"
                        size="sm"
                        className="border-red-300 text-red-700 hover:bg-red-50"
                      >
                        <X className="w-4 h-4 mr-1" />
                        Șterge toate
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {prompts.map((prompt) => (
                        <div key={prompt.id} className="p-3 bg-white rounded border border-blue-200 flex items-center justify-between">
                          <span className="text-sm font-medium text-blue-900">{prompt.name}</span>
                          <button
                            onClick={() => removePrompt(prompt.id)}
                            className="p-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                 )}
              </div>
              )}

              {/* Mode: Manual prompt */}
              {promptMode === 'manual' && (
                <div className="mb-4">
                  <div className="border-2 border-blue-300 rounded-lg p-4 bg-white">
                    <label className="block text-sm font-medium text-blue-900 mb-2">
                      Scrie prompt manual (trebuie să conțină [INSERT TEXT]):
                    </label>
                    <textarea
                      value={manualPromptText}
                      onChange={(e) => setManualPromptText(e.target.value)}
                      placeholder="Exemplu: Generate a video with the following text: [INSERT TEXT]. Make it engaging and professional."
                      className="w-full h-32 p-3 border border-blue-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <Button
                      onClick={() => {
                        if (!manualPromptText.includes('[INSERT TEXT]')) {
                          toast.error('Promptul trebuie să conțină [INSERT TEXT]');
                          return;
                        }
                        if (manualPromptText.trim().length === 0) {
                          toast.error('Promptul nu poate fi gol');
                          return;
                        }
                        
                        const newPrompt: UploadedPrompt = {
                          id: `manual-${Date.now()}`,
                          name: `Custom Prompt #${prompts.length + 1}`,
                          template: manualPromptText,
                          file: null, // Prompt manual, fără fișier
                        };
                        
                        setPrompts(prev => [...prev, newPrompt]);
                        setManualPromptText('');
                        toast.success('Prompt manual adăugat!');
                      }}
                      disabled={!manualPromptText.includes('[INSERT TEXT]') || manualPromptText.trim().length === 0}
                      className="mt-3 bg-blue-600 hover:bg-blue-700"
                    >
                      Adaugă Prompt Manual
                    </Button>
                  </div>
                </div>
              )}

              {/* Buton continuare - întotdeauna vizibil */}
              <div className="mt-6 flex justify-between items-center">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep(1)}
                  className="px-6 py-3"
                >
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button
                  onClick={() => setCurrentStep(3)}
                  className="bg-blue-600 hover:bg-blue-700 px-8 py-8 text-lg"
                >
                  Next: Choose Prompts
                  <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Button>
              </div>
              </div>
              {/* END OLD CONTENT */}
            </CardContent>
          </Card>
        )}



        {/* STEP 3: Prompts */}
        {currentStep === 3 && (
          <Card className="mb-8 border-2 border-blue-200">
            <CardHeader className="bg-blue-50">
              <CardTitle className="flex items-center gap-2 text-blue-900">
                <FileText className="w-5 h-5" />
                STEP 3 - Prompts
              </CardTitle>
              <CardDescription>
                Prompturile hardcodate sunt întotdeauna active. Poți adăuga și prompturi custom (.docx).
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 md:pt-6 px-3 md:px-6">
              {/* Hardcoded Prompts Info */}
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="mb-2">
                  <span className="font-medium text-green-900">Prompturi hardcodate (întotdeauna active)</span>
                </div>
                <div className="text-sm text-green-700 space-y-1">
                  <p>✓ PROMPT_NEUTRAL - pentru secțiuni până la TRANSFORMATION</p>
                  <p>✓ PROMPT_SMILING - pentru TRANSFORMATION și CTA</p>
                  <p>✓ PROMPT_CTA - pentru CTA cu carte</p>
                </div>
              </div>

              {/* Upload Custom Prompts */}
              <div className="mb-4">
                <p className="font-medium text-blue-900 mb-3">Adaugă prompturi custom (opțional):</p>
                
                <div
                  onDrop={handlePromptDocumentDrop}
                  onDragOver={(e) => e.preventDefault()}
                  className="border-2 border-dashed border-blue-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors cursor-pointer bg-blue-50/50 mb-4"
                  onClick={() => document.getElementById('prompt-upload')?.click()}
                >
                  <Upload className="w-12 h-12 text-blue-500 mx-auto mb-4" />
                  <p className="text-blue-900 font-medium mb-2">
                    Drop prompt documents here or click to upload
                  </p>
                  <p className="text-sm text-gray-500 italic">Suportă .docx, .doc (maxim 3 fișiere)</p>
                  <input
                    id="prompt-upload"
                    type="file"
                    accept=".docx,.doc"
                    multiple
                    className="hidden"
                    onChange={handlePromptDocumentSelect}
                  />
                </div>
              </div>

              {/* Display uploaded prompts */}
              {prompts.length > 0 && (
                <div className="mt-4">
                  <p className="font-medium text-blue-900 mb-3">
                    {prompts.length} prompturi custom încărcate:
                  </p>
                  <Button
                    onClick={() => {
                      setPrompts([]);
                      const input = document.getElementById('prompt-upload') as HTMLInputElement;
                      if (input) input.value = '';
                      toast.success('Toate prompturile custom au fost șterse.');
                    }}
                    variant="outline"
                    size="sm"
                    className="mb-3"
                  >
                    Șterge toate prompturile
                  </Button>
                  <div className="space-y-2">
                    {prompts.map((prompt) => (
                      <div key={prompt.id} className="p-3 bg-white rounded border border-blue-200 flex justify-between items-center">
                        <div className="flex-1">
                          <p className="font-medium text-blue-900">{prompt.name}</p>
                          <p className="text-xs text-gray-500 truncate">{prompt.template.substring(0, 100)}...</p>
                        </div>
                        <Button
                          onClick={() => {
                            setPrompts(prev => prev.filter(p => p.id !== prompt.id));
                            toast.success(`Prompt "${prompt.name}" șters.`);
                          }}
                          variant="outline"
                          size="sm"
                          className="ml-2"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Continue Button */}
              <div className="mt-6 flex justify-between items-center">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep(2)}
                  className="px-6 py-3"
                >
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button
                  onClick={() => {
                    // Save to database before moving to next step
                    if (selectedCoreBeliefId && selectedEmotionalAngleId && selectedAdId && selectedCharacterId) {
                      upsertContextSessionMutation.mutate({
                        userId: localCurrentUser.id,
                        coreBeliefId: selectedCoreBeliefId,
                        emotionalAngleId: selectedEmotionalAngleId,
                        adId: selectedAdId,
                        characterId: selectedCharacterId,
                        currentStep: 3,
                        rawTextAd,
                        processedTextAd,
                        adLines,
                        prompts,
                        images,
                        combinations,
                        deletedCombinations,
                        videoResults,
                        reviewHistory,
                      }, {
                        onSuccess: () => {
                          console.log('[Step 3] Saved before moving to Step 4');
                          setCurrentStep(4);
                        },
                        onError: (error) => {
                          console.error('[Step 3] Save failed:', error);
                          // Still move to next step (don't block user)
                          setCurrentStep(4);
                        },
                      });
                    } else {
                      setCurrentStep(4);
                    }
                  }}
                  className="bg-blue-600 hover:bg-blue-700 px-8 py-8 text-lg"
                >
                  <Images className="w-5 h-5 mr-2" />
                  Next: Select Images
                  <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* STEP 4: Images */}
        {currentStep === 4 && (
          <Card className="mb-8 border-2 border-blue-200">
            <CardHeader className="bg-blue-50">
              <CardTitle className="flex items-center gap-2 text-blue-900">
                <ImageIcon className="w-5 h-5" />
                STEP 4 - Images
              </CardTitle>
              <CardDescription>
                Upload images or select from library (9:16 recommended)
              </CardDescription>
            </CardHeader>
            
            <CardContent className="pt-6">
              {/* TABS */}
              <div className="flex gap-2 mb-6 border-b-2 border-gray-200">
                <button
                  onClick={() => setStep4ActiveTab('library')}
                  className={`flex-1 py-3 px-6 font-semibold transition-all rounded-t-lg ${
                    step4ActiveTab === 'library'
                      ? 'bg-green-500 text-white border-b-4 border-green-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  📚 Select from Library ({libraryImages.length})
                </button>
                <button
                  onClick={() => setStep4ActiveTab('upload')}
                  className={`flex-1 py-3 px-6 font-semibold transition-all rounded-t-lg ${
                    step4ActiveTab === 'upload'
                      ? 'bg-blue-500 text-white border-b-4 border-blue-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  📤 Manual Upload
                </button>
              </div>
              
              {/* TAB CONTENT: Manual Upload */}
              {step4ActiveTab === 'upload' && (
                <div>
                  {/* Character Selector (only in Manual Upload) */}
                  <div className="mb-6 p-4 bg-purple-50 border-2 border-purple-300 rounded-lg">
                    <label className="block text-sm font-medium text-purple-900 mb-2">
                      Select Character *
                    </label>
                    <Select 
                      value={selectedCharacterId?.toString() || ''} 
                      onValueChange={(value) => {
                        if (value === '__new__') {
                          const newName = prompt('Nume caracter nou:');
                          if (newName && newName.trim()) {
                            createCharacterMutation.mutate({
                              userId: localCurrentUser.id,
                              name: newName.trim(),
                            }, {
                              onSuccess: (newChar) => {
                                setSelectedCharacterId(newChar.id);
                                toast.success(`Caracter "${newName}" creat!`);
                              },
                            });
                          }
                        } else {
                          setSelectedCharacterId(parseInt(value));
                        }
                      }}
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Select or create character" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__new__">+ New Character</SelectItem>
                        {categoryCharacters?.map((char) => (
                          <SelectItem key={char.id} value={char.id.toString()}>
                            {char.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!selectedCharacterId && (
                      <p className="text-sm text-red-600 mt-2">
                        ⚠️ Trebuie să selectezi un caracter înainte de a încărca imagini
                      </p>
                    )}
                  </div>
                  
                  <div
                    onDrop={handleImageDrop}
                    onDragOver={(e) => e.preventDefault()}
                    className={`border-2 border-dashed border-blue-300 rounded-lg p-12 text-center hover:border-blue-500 transition-colors ${
                      selectedCharacterId ? 'cursor-pointer bg-blue-50' : 'cursor-not-allowed opacity-50 bg-gray-50'
                    }`}
                    onClick={() => selectedCharacterId && document.getElementById('image-upload')?.click()}
                  >
                    <Upload className="w-16 h-16 text-blue-500 mx-auto mb-4" />
                    <p className="text-xl font-semibold text-blue-900 mb-2">
                      Drop images here or click to upload
                    </p>
                    <p className="text-sm text-gray-500">
                      Supports .jpg, .png, .webp (9:16 recommended)
                    </p>
                    <input
                      id="image-upload"
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleImageSelect}
                      disabled={!selectedCharacterId}
                    />
                  </div>
                  
                  {/* Upload Progress */}
                  {uploadingFiles.length > 0 && (
                    <div className="mt-4 p-4 bg-blue-50 border-2 border-blue-300 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-blue-900">
                          Uploading {uploadingFiles.length} image(s)...
                        </span>
                        <span className="text-sm font-bold text-blue-900">
                          {uploadProgress}%
                        </span>
                      </div>
                      <div className="w-full bg-blue-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {/* TAB CONTENT: Select from Library */}
              {step4ActiveTab === 'library' && (
                <div>
                  {/* Search + Filter */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        placeholder="Search images by name..."
                        value={librarySearchQuery}
                        onChange={(e) => setLibrarySearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    
                    <Select value={libraryCharacterFilter} onValueChange={setLibraryCharacterFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Filter by character" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Characters</SelectItem>
                        {libraryCharacters
                          .filter((char) => char && char.trim() !== "")
                          .map((char) => (
                            <SelectItem key={char} value={char}>
                              {char}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Images Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 max-h-[400px] overflow-y-auto mb-6 p-3 bg-green-50 rounded-lg border-2 border-green-200">
                    {libraryImages
                      .filter((img) => {
                        const query = librarySearchQuery.toLowerCase();
                        const matchesSearch = img.imageName.toLowerCase().includes(query);
                        const matchesCharacter = libraryCharacterFilter === "all" || img.characterName === libraryCharacterFilter;
                        return matchesSearch && matchesCharacter;
                      })
                      .map((img) => (
                        <div
                          key={img.id}
                          className={`relative group cursor-pointer rounded border-2 transition-all ${
                            selectedLibraryImages.includes(img.id)
                              ? 'border-green-500 ring-2 ring-green-300 shadow-lg'
                              : 'border-gray-200 hover:border-green-400 hover:shadow-md'
                          }`}
                          onClick={() => {
                            setSelectedLibraryImages((prev) =>
                              prev.includes(img.id)
                                ? prev.filter((id) => id !== img.id)
                                : [...prev, img.id]
                            );
                          }}
                        >
                          <img
                            src={img.imageUrl}
                            alt={img.imageName}
                            className="w-full aspect-[9/16] object-cover rounded"
                          />
                          {selectedLibraryImages.includes(img.id) && (
                            <div className="absolute top-1 right-1 bg-green-600 text-white rounded-full p-1">
                              <Check className="w-4 h-4" />
                            </div>
                          )}
                          <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs p-1 truncate">
                            {img.imageName}
                          </div>
                        </div>
                      ))}
                  </div>
                  
                  {/* Add Selected Button */}
                  {selectedLibraryImages.length > 0 && (
                    <Button
                      onClick={() => {
                        const existingImageIds = images.map(img => img.id);
                        const newImages = libraryImages
                          .filter((img) => selectedLibraryImages.includes(img.id))
                          .filter((img) => !existingImageIds.includes(`library-${img.id}`))
                          .map((img) => ({
                            id: `library-${img.id}`,
                            url: img.imageUrl,
                            file: null,
                            fileName: img.imageName,
                            isCTA: false,
                            fromLibrary: true,
                          }));
                        
                        if (newImages.length === 0) {
                          toast.warning('All selected images are already added!');
                          setSelectedLibraryImages([]);
                          return;
                        }
                        
                        setImages((prev) => [...prev, ...newImages]);
                        setSelectedLibraryImages([]);
                        toast.success(`${newImages.length} images added from library!`);
                      }}
                      className="bg-green-600 hover:bg-green-700 w-full text-lg py-6"
                    >
                      <Check className="w-5 h-5 mr-2" />
                      Add {selectedLibraryImages.length} Selected Image(s)
                    </Button>
                  )}
                </div>
              )}
              
              {/* SELECTED IMAGES PREVIEW (common for both tabs) */}
              {images.length > 0 && (
                <div className="mt-8 p-4 bg-gray-50 border-2 border-gray-300 rounded-lg">
                  <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <ImageIcon className="w-5 h-5" />
                    Selected Images ({images.length})
                  </h4>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                    {images.map((image) => (
                      <div key={image.id} className="relative group">
                        <img
                          src={image.url}
                          alt={image.fileName}
                          className="w-full aspect-[9/16] object-cover rounded border-2 border-gray-300"
                        />
                        <button
                          onClick={() => removeImage(image.id)}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600 transition-all shadow-lg hover:scale-110 border-2 border-white"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        {image.fromLibrary && (
                          <div className="absolute top-1 left-1 bg-purple-600 text-white text-xs px-2 py-0.5 rounded">
                            Library
                          </div>
                        )}
                        <p className="text-xs text-center mt-1 text-gray-600 truncate">
                          {image.fileName}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Next Button */}
              <div className="mt-6 flex justify-between items-center">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep(3)}
                  className="px-6 py-3"
                >
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button
                  onClick={createMappings}
                  disabled={images.length === 0}
                  className="bg-blue-600 hover:bg-blue-700 px-8 py-8 text-lg"
                >
                  <Grid3x3 className="w-5 h-5 mr-2" />
                  Next: Create Mappings ({adLines.filter(l => l.categoryNumber > 0).length})
                  <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}


        {/* STEP 5: Mapping */}
        {currentStep === 5 && combinations.length > 0 && (
          <Card className="mb-8 border-2 border-blue-200">
            <CardHeader className="bg-blue-50">
              <CardTitle className="flex items-center gap-2 text-blue-900">
                <MapIcon className="w-5 h-5" />
                STEP 5 - Mapping (Text + Image + Prompt)
              </CardTitle>
              <CardDescription>
                Configurează combinațiile de text, imagine și prompt pentru fiecare video. Maparea este făcută automat.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 md:pt-6 px-3 md:px-6">
              {deletedCombinations.length > 0 && (
                <div className="mb-4">
                  <Button
                    onClick={undoDelete}
                    variant="outline"
                    size="sm"
                    className="gap-2"
                  >
                    <Undo2 className="w-4 h-4" />
                    UNDO - Restaurează ultima combinație ștearsă
                  </Button>
                </div>
              )}

              <div className="space-y-4 max-h-[600px] overflow-y-auto mb-6">
                {combinations.map((combo, index) => (
                  <div key={combo.id} className="p-4 bg-white rounded-lg border-2 border-blue-200">
                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                      {/* Image selector */}
                      <div className="flex-shrink-0">
                        <label className="block text-xs font-medium text-blue-900 mb-2">
                          Imagine #{index + 1}
                        </label>
                        <select
                          value={combo.imageId}
                          onChange={(e) => updateCombinationImage(combo.id, e.target.value)}
                          className="w-full p-2 border border-blue-300 rounded text-sm mb-2"
                        >
                          {images.map((img) => (
                            <option key={img.id} value={img.id}>
                              {img.fileName}
                            </option>
                          ))}
                        </select>
                        <img
                          src={combo.imageUrl}
                          alt="Selected"
                          className="w-16 aspect-[9/16] object-cover rounded border-2 border-blue-300"
                        />
                      </div>

                      {/* Text and prompt selector */}
                      <div className="flex-1">
                        {/* Video Name */}
                        <label className="block text-xs font-medium text-blue-900 mb-1">
                          Video Name
                        </label>
                        <div className="text-xs text-blue-700 mb-3 font-mono bg-blue-50 p-2 rounded border border-blue-200">
                          {combo.videoName}
                        </div>
                        
                        <label className="block text-xs font-medium text-blue-900 mb-2">
                          Text pentru Dialogue
                        </label>
                        <Textarea
                          value={combo.text}
                          readOnly
                          disabled
                          className="text-sm mb-3 min-h-[80px] bg-gray-100 text-gray-600 cursor-not-allowed"
                        />
                        
                        <label className="block text-xs font-medium text-blue-900 mb-2">
                          Prompt Type
                        </label>
                        <select
                          value={combo.promptType}
                          onChange={(e) => updateCombinationPromptType(combo.id, e.target.value as PromptType)}
                          className="w-full p-2 border border-blue-300 rounded text-sm"
                        >
                          <option value="PROMPT_NEUTRAL">PROMPT_NEUTRAL</option>
                          <option value="PROMPT_SMILING">PROMPT_SMILING</option>
                          <option value="PROMPT_CTA">PROMPT_CTA</option>
                        </select>
                      </div>

                      {/* Delete button */}
                      <div className="flex-shrink-0">
                        <button
                          onClick={() => removeCombination(combo.id)}
                          className="p-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                          title="Șterge combinația"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mb-6 p-4 bg-blue-100 rounded-lg">
                <p className="text-blue-900 font-medium">
                  📊 Statistici: {combinations.length} videouri vor fi generate
                </p>
              </div>

              <div className="mt-6 flex justify-between items-center">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep(4)}
                  className="px-6 py-3"
                >
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button
                  onClick={generateVideos}
                  disabled={generateBatchMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700 px-8 py-8 text-lg"
                >
                  {generateBatchMutation.isPending ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Se generează...
                    </>
                  ) : (
                    <>
                      <Video className="w-5 h-5 mr-2" />
                      Next: Generate ({combinations.length})
                      <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* STEP 6: Generate Results */}
        {currentStep === 6 && videoResults.length > 0 && (
          <Card className="mb-8 border-2 border-blue-200">
            <CardHeader className="bg-blue-50">
              <CardTitle className="flex items-center gap-2 text-blue-900">
                <Play className="w-5 h-5" />
                STEP 6 - Videouri Generate
              </CardTitle>
              <CardDescription>
                Urmărește progresul generării videourilo și descarcă-le.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 md:pt-6 px-3 md:px-6">
              {/* Filtru videouri STEP 5 */}
              <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
                <label className="text-sm font-medium text-blue-900">Filtrează videouri:</label>
                <select
                  value={step5Filter}
                  onChange={(e) => setStep5Filter(e.target.value as 'all' | 'accepted' | 'regenerate')}
                  className="px-4 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Afișează Toate ({videoResults.length})</option>
                  <option value="accepted">Doar Acceptate ({acceptedCount})</option>
                  <option value="regenerate">Pentru Regenerare ({regenerateCount})</option>
                </select>
              </div>
              <div className="space-y-4">
                {step5FilteredVideos.map((result, index) => {
                  // Calculate real index in videoResults once to avoid multiple findIndex calls
                  const realIndex = videoResults.findIndex(v => v.videoName === result.videoName);
                  
                  return (
                  <div key={result.videoName} id={`video-card-${result.videoName}`} className="p-3 md:p-4 bg-white rounded-lg border-2 border-blue-200">
                    <div className="flex flex-row items-start gap-3">
                      <img
                        src={result.imageUrl}
                        alt="Video thumbnail"
                        className="w-20 sm:w-12 flex-shrink-0 aspect-[9/16] object-cover rounded border-2 border-blue-300"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-blue-600 font-bold mb-1">
                          {result.videoName}
                        </p>
                        <p className="text-sm text-blue-900 mb-2">
                          <span className="font-medium">Text:</span>{' '}
                          {result.redStart !== undefined && result.redEnd !== undefined && result.redStart >= 0 ? (
                            <>
                              {result.text.substring(0, result.redStart)}
                              <span className="text-red-600 font-bold">{result.text.substring(result.redStart, result.redEnd)}</span>
                              {result.text.substring(result.redEnd)}
                            </>
                          ) : (
                            result.text
                          )}
                        </p>
                        {result.taskId && (
                          <p className="text-xs text-blue-700 mb-1">
                            TaskID: {result.taskId}
                          </p>
                        )}
                        {(result as any).regenerationNote && (
                          <p className="text-xs text-orange-600 font-medium mb-1">
                            ⚠️ {(result as any).regenerationNote}
                          </p>
                        )}
                        {combinations[index]?.promptType && (
                          <p className="text-xs text-gray-600 mb-2">
                            <span className="font-medium">Prompt:</span> {combinations[index].promptType}
                          </p>
                        )}
                        {result.internalNote && (
                          <div className="bg-yellow-50 border-2 border-yellow-400 rounded p-2 mb-2">
                            <p className="text-xs text-yellow-800 font-medium mb-1">
                              📝 Internal Note:
                            </p>
                            <p className="text-xs text-yellow-900 whitespace-pre-wrap">
                              {result.internalNote}
                            </p>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          {result.status === 'pending' && (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin text-orange-600" />
                              <span className="text-sm text-orange-600 font-medium">În curs de generare... (auto-refresh la 5s)</span>
                            </>
                          )}
                          {result.status === 'success' && result.videoUrl && result.reviewStatus !== 'regenerate' && (
                            <>
                              {false && result.reviewStatus === 'regenerate' ? (
                                <div className="flex items-center gap-2 justify-between w-full">
                                  {/* Status Respinse - small, left */}
                                  <div className="flex items-center gap-2 bg-red-50 border-2 border-red-500 px-3 py-2 rounded-lg">
                                    <X className="w-5 h-5 text-red-600" />
                                    <span className="text-sm text-red-700 font-bold">Respinse</span>
                                  </div>
                                  
                                  {/* Buton Modify & Regenerate - small, right */}
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      console.log('[Modify & Regenerate] Clicked for rejected video:', result.videoName, 'realIndex:', realIndex);
                                      
                                      if (realIndex < 0) {
                                        toast.error('Video nu găsit în videoResults');
                                        return;
                                      }
                                      
                                      setModifyingVideoIndex(realIndex);
                                      const currentPromptType = combinations[realIndex]?.promptType || 'PROMPT_NEUTRAL';
                                      setModifyPromptType(currentPromptType);
                                      
                                      // Încărcă prompt text by default
                                      if (currentPromptType === 'PROMPT_CUSTOM' && customPrompts[realIndex]) {
                                        // Dacă video are PROMPT_CUSTOM salvat → afișează-l
                                        setModifyPromptText(customPrompts[realIndex]);
                                      } else {
                                        // Încărcă template-ul promptului din Prompt Library
                                        const promptFromLibrary = promptLibrary.find(p => p.promptName === currentPromptType);
                                        if (promptFromLibrary?.promptTemplate) {
                                          setModifyPromptText(promptFromLibrary.promptTemplate);
                                        } else {
                                          setModifyPromptText('');
                                        }
                                      }
                                      
                                      setModifyDialogueText(result.text);
                                      
                                      // Initialize red text positions from combination
                                      const combo = combinations[realIndex];
                                      if (combo) {
                                        // Find the original line to get red text positions
                                        const originalLine = adLines.find(l => l.text === combo.text);
                                        if (originalLine) {
                                          setModifyRedStart(originalLine.redStart ?? -1);
                                          setModifyRedEnd(originalLine.redEnd ?? -1);
                                        } else {
                                          setModifyRedStart(-1);
                                          setModifyRedEnd(-1);
                                        }
                                      }
                                      
                                      // Scroll to form
                                      setTimeout(() => {
                                        const formElement = document.querySelector(`[data-modify-form="${realIndex}"]`);
                                        if (formElement) {
                                          formElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                                        }
                                      }, 100);
                                    }}
                                    className="w-full sm:w-auto border-orange-500 text-orange-700 hover:bg-orange-50"
                                  >
                                    Modify & Regenerate
                                  </Button>
                                </div>
                              ) : (
                                <div className="inline-flex items-center gap-2 bg-green-50 border-2 border-green-500 px-3 py-2 rounded-lg">
                                  <Check className="w-5 h-5 text-green-600" />
                                  <span className="text-sm text-green-700 font-bold">Generated</span>
                                </div>
                              )}
                            </>
                          )}
                          {(result.status === 'failed' || result.status === null || result.reviewStatus === 'regenerate') && (
                            <>
                              <div className="flex-1">
                                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg mb-2 ${
                                  result.reviewStatus === 'regenerate'
                                    ? 'bg-orange-50 border-2 border-orange-500'
                                    : 'bg-red-50 border-2 border-red-500'
                                }`}>
                                  <X className={`w-5 h-5 ${
                                    result.reviewStatus === 'regenerate' ? 'text-orange-600' : 'text-red-600'
                                  }`} />
                                  <span className={`text-sm font-bold ${
                                    result.reviewStatus === 'regenerate' ? 'text-orange-700' : 'text-red-700'
                                  }`}>
                                    {result.status === 'failed' ? 'Failed' : result.status === null ? 'Not Generated Yet' : 'Rejected'}
                                  </span>
                                </div>
                                {result.status === 'failed' && (
                                  <p className="text-sm text-red-600">
                                    {result.error || 'Unknown error'}
                                  </p>
                                )}
                                <div className="hidden">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setModifyingVideoIndex(realIndex);
                                      const currentPromptType = combinations[realIndex]?.promptType || 'PROMPT_NEUTRAL';
                                      setModifyPromptType(currentPromptType);
                                      
                                      // Încărcă prompt text by default
                                      if (currentPromptType === 'PROMPT_CUSTOM' && customPrompts[realIndex]) {
                                        // Dacă video are PROMPT_CUSTOM salvat → afișează-l
                                        setModifyPromptText(customPrompts[realIndex]);
                                      } else {
                                        // Încărcă template-ul promptului din Prompt Library
                                        const promptFromLibrary = promptLibrary.find(p => p.promptName === currentPromptType);
                                        if (promptFromLibrary?.promptTemplate) {
                                          setModifyPromptText(promptFromLibrary.promptTemplate);
                                        } else {
                                          setModifyPromptText('');
                                        }
                                      }
                                      
                                      // Initialize text and red positions from videoResults
                                      setModifyDialogueText(result.text);
                                      
                                      // Load red text positions if they exist
                                      if (result.redStart !== undefined && result.redEnd !== undefined && result.redStart >= 0) {
                                        setModifyRedStart(result.redStart);
                                        setModifyRedEnd(result.redEnd);
                                        console.log('[Modify Dialog] Loading red text:', result.redStart, '-', result.redEnd);
                                      } else {
                                        setModifyRedStart(-1);
                                        setModifyRedEnd(-1);
                                        console.log('[Modify Dialog] No red text found');
                                      }
                                    }}
                                    className="flex-1 border-orange-500 text-orange-700 hover:bg-orange-50"
                                  >
                                    Modify & Regenerate
                                  </Button>
                                  
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      duplicateVideo(result.videoName);
                                    }}
                                    className="flex-1 border-blue-500 text-blue-700 hover:bg-blue-50"
                                  >
                                    Duplicate
                                  </Button>
                                  
                                  {/* Delete Duplicate button (doar pentru duplicate-uri) */}
                                  {result.isDuplicate && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        deleteDuplicate(result.videoName);
                                      }}
                                      className="flex-1 border-red-500 text-red-700 hover:bg-red-50"
                                    >
                                      Delete Duplicate
                                    </Button>
                                  )}
                                </div>
                                
                                {/* Edited X min/sec ago */}
                                {editTimestamps[realIndex] && (
                                  <div className="flex items-center gap-1 mt-2">
                                    <Clock className="w-3 h-3 text-orange-500" />
                                    <p className="text-xs text-orange-500 font-bold">
                                      Edited {(() => {
                                        const diffMs = currentTime - editTimestamps[realIndex];
                                        const minutes = Math.floor(diffMs / 60000);
                                        if (minutes >= 1) {
                                          return `${minutes} min ago`;
                                        } else {
                                          const seconds = Math.floor(diffMs / 1000);
                                          return `${seconds} sec ago`;
                                        }
                                      })()}
                                    </p>
                                  </div>
                                )}
                                
                                {/* Modify & Regenerate Form */}
                                {modifyingVideoIndex === realIndex && (
                                  <div 
                                    data-modify-form={realIndex}
                                    className="mt-4 p-3 sm:p-4 bg-white border-2 border-orange-300 rounded-lg space-y-3"
                                  >
                                    <h5 className="font-bold text-orange-900">Edit Video</h5>
                                    
                                    {/* Radio: Vrei să regenerezi mai multe videouri? - COMMENTED OUT */}
                                    {/* <div className="p-3 bg-orange-50 border border-orange-200 rounded">
                                      <label className="text-sm font-medium text-gray-700 block mb-2">Vrei să regenerezi mai multe videouri?</label>
                                      <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                          <input
                                            type="radio"
                                            name="multipleRegens"
                                            checked={!regenerateMultiple}
                                            onChange={() => {
                                              setRegenerateMultiple(false);
                                              setRegenerateVariantCount(1);
                                              setRegenerateVariants([]);
                                            }}
                                            className="w-4 h-4"
                                          />
                                          <span className="text-sm">Nu</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                          <input
                                            type="radio"
                                            name="multipleRegens"
                                            checked={regenerateMultiple}
                                            onChange={() => {
                                              setRegenerateMultiple(true);
                                              // Inițializează variante cu valorile curente
                                              const idx = modifyingVideoIndex !== null ? modifyingVideoIndex : 0;
                                              const initialVariant = {
                                                promptType: modifyPromptType,
                                                promptText: modifyPromptText,
                                                dialogueText: modifyDialogueText,
                                                imageUrl: videoResults[idx]?.imageUrl || combinations[idx]?.imageUrl || '',
                                              };
                                              // Crează array cu regenerateVariantCount variante
                                              const variants = Array(regenerateVariantCount).fill(null).map(() => ({ ...initialVariant }));
                                              setRegenerateVariants(variants);
                                              console.log('[Regenerate Multiple] Initialized', variants.length, 'variants');
                                            }}
                                            className="w-4 h-4"
                                          />
                                          <span className="text-sm">Da</span>
                                        </label>
                                      </div>
                                    </div> */}
                                    
                                    {/* Selector număr regenerări (dacă Da) */}
                                    {regenerateMultiple && (
                                      <div>
                                        <label className="text-sm font-medium text-gray-700 block mb-1">Câte regenerări vrei? (1-10):</label>
                                        <select
                                          value={regenerateVariantCount}
                                          onChange={(e) => {
                                            const count = parseInt(e.target.value);
                                            setRegenerateVariantCount(count);
                                            
                                            // Ajustează array-ul de variante
                                            const currentVariants = [...regenerateVariants];
                                            if (count > currentVariants.length) {
                                              // Adaugă variante noi (copie după prima)
                                              const idx = modifyingVideoIndex !== null ? modifyingVideoIndex : 0;
                                              const template = currentVariants[0] || {
                                                promptType: modifyPromptType,
                                                promptText: modifyPromptText,
                                                dialogueText: modifyDialogueText,
                                                imageUrl: videoResults[idx]?.imageUrl || combinations[idx]?.imageUrl || '',
                                              };
                                              while (currentVariants.length < count) {
                                                currentVariants.push({ ...template });
                                              }
                                            } else {
                                              // Șterge variante în plus
                                              currentVariants.splice(count);
                                            }
                                            setRegenerateVariants(currentVariants);
                                          }}
                                          className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                                        >
                                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                                            <option key={n} value={n}>{n} regenerări</option>
                                          ))}
                                        </select>
                                      </div>
                                    )}
                                    
                                    {/* Rendering dinamic: 1 secțiune (Nu) sau N secțiuni (Da) */}
                                    {!regenerateMultiple ? (
                                      /* Mod single (Nu) - 1 secțiune */
                                      <>
                                    {/* Select Prompt Type */}
                                    <div>
                                      <label className="text-sm font-medium text-gray-700 block mb-1">Prompt Type:</label>
                                      <select
                                        value={modifyPromptType}
                                        onChange={async (e) => {
                                          const newType = e.target.value as PromptType;
                                          setModifyPromptType(newType);
                                          
                                          // Când user selectează PROMPT_CUSTOM → încarcă textul salvat
                                          if (newType === 'PROMPT_CUSTOM' && customPrompts[modifyingVideoIndex!]) {
                                            setModifyPromptText(customPrompts[modifyingVideoIndex!]);
                                          } else if (newType !== 'PROMPT_CUSTOM') {
                                            // Încarcă template din Prompt Library (database)
                                            const promptFromLibrary = promptLibrary.find(p => p.promptName === newType);
                                            if (promptFromLibrary?.promptTemplate) {
                                              setModifyPromptText(promptFromLibrary.promptTemplate);
                                            } else {
                                              setModifyPromptText('');
                                              toast.warning(`Prompt ${newType} nu a fost găsit în sesiune`);
                                            }
                                          }
                                        }}
                                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                                      >
                                        {/* Prompturi din Prompt Library (database) */}
                                        {promptLibrary.map(p => (
                                          <option key={p.id} value={p.promptName}>{p.promptName}</option>
                                        ))}
                                        {/* PROMPT_CUSTOM apare doar dacă există în sesiune pentru acest video */}
                                        {modifyingVideoIndex !== null && customPrompts[modifyingVideoIndex] && (
                                          <option value="PROMPT_CUSTOM">PROMPT_CUSTOM (session)</option>
                                        )}
                                      </select>
                                    </div>
                                    
                                    {/* Edit Prompt Text (optional) */}
                                    <div>
                                      <label className="text-sm font-medium text-gray-700 block mb-1">Edit Prompt (optional):</label>
                                      <Textarea
                                        value={modifyPromptText}
                                        onChange={(e) => {
                                          const newText = e.target.value;
                                          setModifyPromptText(newText);
                                          
                                          // Când user editează prompt text → switch automat la PROMPT_CUSTOM și salvează în sesiune
                                          if (newText.trim().length > 0) {
                                            // Verifică dacă textul este diferit de template-ul original
                                            const originalPrompt = promptLibrary.find(p => p.promptName === modifyPromptType);
                                            const isModified = !originalPrompt || newText !== originalPrompt.promptTemplate;
                                            
                                            if (isModified && modifyPromptType !== 'PROMPT_CUSTOM') {
                                              // Switch la PROMPT_CUSTOM și salvează în sesiune
                                              setModifyPromptType('PROMPT_CUSTOM');
                                              if (modifyingVideoIndex !== null) {
                                                setCustomPrompts(prev => ({
                                                  ...prev,
                                                  [modifyingVideoIndex]: newText,
                                                }));
                                              }
                                            }
                                          }
                                        }}
                                        placeholder={
                                          modifyPromptType === 'PROMPT_CUSTOM'
                                            ? 'Introdu promptul custom aici'
                                            : `Editează ${modifyPromptType} sau lasă gol pentru a folosi promptul hardcodat`
                                        }
                                        rows={3}
                                        className="text-sm min-h-[60px] max-h-[150px] resize-y overflow-y-auto"
                                      />
                                    </div>
                                    
                                    {/* Edit Dialogue Text - Textarea Simplu */}
                                    <div>
                                      <label className="text-sm font-medium text-gray-700 block mb-1">Edit Text:</label>
                                      
                                      {/* Textarea pentru editare */}
                                      <Textarea
                                        value={modifyDialogueText}
                                        onChange={(e) => setModifyDialogueText(e.target.value)}
                                        onSelect={(e: any) => {
                                          const start = e.target.selectionStart;
                                          const end = e.target.selectionEnd;
                                          // Salvează selecția pentru marcare roșu
                                          if (end > start) {
                                            (window as any).__textSelection = { start, end };
                                          }
                                        }}
                                        className="min-h-[80px] text-sm"
                                        placeholder="Introdu textul aici..."
                                      />
                                      
                                      {/* Butoane pentru marcare roșu */}
                                      <div className="flex gap-2 mt-2">
                                        <Button
                                          onClick={() => {
                                            const selection = (window as any).__textSelection;
                                            if (selection && selection.end > selection.start) {
                                              setModifyRedStart(selection.start);
                                              setModifyRedEnd(selection.end);
                                              toast.success('Text marcat ca roșu!');
                                            } else {
                                              toast.warning('Selectează textul pe care vrei să-l marchezi ca roșu');
                                            }
                                          }}
                                          variant="outline"
                                          size="sm"
                                          className="bg-red-600 text-white hover:bg-red-700"
                                          type="button"
                                        >
                                          Mark as RED
                                        </Button>
                                        <Button
                                          onClick={() => {
                                            setModifyRedStart(-1);
                                            setModifyRedEnd(-1);
                                            toast.success('Marcare roșu ștearsă!');
                                          }}
                                          variant="outline"
                                          size="sm"
                                          type="button"
                                          disabled={modifyRedStart < 0}
                                        >
                                          Clear RED
                                        </Button>
                                      </div>
                                      
                                      {/* Preview cu text roșu */}
                                      {modifyRedStart >= 0 && modifyRedEnd > modifyRedStart && (
                                        <div className="mt-3 p-4 bg-blue-50 rounded-lg border-2 border-blue-300">
                                          <div className="flex items-center gap-2 mb-2">
                                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                            <label className="text-sm text-blue-900 font-bold">👁️ Preview: Textul cu roșu va arăta astfel:</label>
                                          </div>
                                          <div className="p-3 bg-white rounded border border-blue-200 text-sm" style={{ whiteSpace: 'pre-wrap' }}>
                                            {modifyDialogueText.substring(0, modifyRedStart)}
                                            <span style={{ color: '#dc2626', fontWeight: 600, backgroundColor: '#fee2e2', padding: '2px 4px', borderRadius: '3px' }}>
                                              {modifyDialogueText.substring(modifyRedStart, modifyRedEnd)}
                                            </span>
                                            {modifyDialogueText.substring(modifyRedEnd)}
                                          </div>
                                        </div>
                                      )}
                                      
                                      {/* Character count */}
                                      <p className={`text-xs mt-1 ${
                                        modifyDialogueText.length > 125 ? 'text-orange-600 font-bold' : 'text-gray-500'
                                      }`}>
                                        {modifyDialogueText.length} caractere{modifyDialogueText.length > 125 ? ` ⚠️ Warning: ${modifyDialogueText.length - 125} caractere depășite!` : ''}
                                      </p>
                                    </div>
                                    
                                    {/* Mini Image Library Selector */}
                                    <div className="mt-4">
                                      <label className="text-sm font-medium text-gray-700 block mb-2">🖼️ Select Image:</label>
                                      
                                      {/* Character Filter */}
                                      <div className="mb-3">
                                        <select
                                          value={modifyImageCharacterFilter || 'all'}
                                          onChange={(e) => setModifyImageCharacterFilter(e.target.value)}
                                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                                        >
                                          <option value="all">All Characters</option>
                                          {libraryCharacters.map(char => (
                                            <option key={char} value={char}>{char}</option>
                                          ))}
                                        </select>
                                      </div>
                                      
                                      {/* Image Grid */}
                                      <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto p-2 bg-gray-50 rounded border border-gray-200">
                                        {libraryImages
                                          .filter(img => modifyImageCharacterFilter === 'all' || img.characterName === modifyImageCharacterFilter)
                                          .map(img => {
                                            const isSelected = modifyingVideoIndex !== null && combinations[modifyingVideoIndex]?.imageUrl === img.imageUrl;
                                            return (
                                              <div
                                                key={img.id}
                                                onClick={() => {
                                                  if (modifyingVideoIndex !== null) {
                                                    // Update combination with new image
                                                    const updatedCombinations = [...combinations];
                                                    updatedCombinations[modifyingVideoIndex] = {
                                                      ...updatedCombinations[modifyingVideoIndex],
                                                      imageUrl: img.imageUrl,
                                                      imageId: img.id.toString(),
                                                    };
                                                    setCombinations(updatedCombinations);
                                                    
                                                    // Update video card thumbnail as well
                                                    const updatedVideoResults = [...videoResults];
                                                    if (updatedVideoResults[modifyingVideoIndex]) {
                                                      updatedVideoResults[modifyingVideoIndex] = {
                                                        ...updatedVideoResults[modifyingVideoIndex],
                                                        imageUrl: img.imageUrl,
                                                      };
                                                      setVideoResults(updatedVideoResults);
                                                    }
                                                    
                                                    // Lock system removed
                                                  }
                                                }}
                                                className={`relative cursor-pointer rounded border-2 transition-all ${
                                                  isSelected ? 'border-blue-500 ring-2 ring-blue-300' : 'border-gray-300 hover:border-blue-400'
                                                }`}
                                              >
                                                <img
                                                  src={img.thumbnailUrl || img.imageUrl}
                                                  alt={img.imageName}
                                                  className="w-full h-48 object-cover rounded"
                                                  style={{ aspectRatio: '6/16' }}
                                                />
                                                {isSelected && (
                                                  <div className="absolute top-1 right-1 bg-blue-500 text-white rounded-full p-1">
                                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                    </svg>
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          })}
                                      </div>
                                      
                                      {/* Selected Image Info */}
                                      {modifyingVideoIndex !== null && combinations[modifyingVideoIndex] && (
                                        <p className="text-xs text-gray-600 mt-2">
                                          Selected: {libraryImages.find(img => img.imageUrl === combinations[modifyingVideoIndex].imageUrl)?.imageName || 'Unknown'}
                                        </p>
                                      )}
                                    </div>
                                    
                                    {/* Buttons (mod single) */}
                                    <div className="flex flex-col sm:flex-row gap-2">
                                      <Button
                                        size="sm"
                                        onClick={() => {
                                          // SAVE: salvează modificări fără regenerare
                                          const index = modifyingVideoIndex;
                                          console.log('[Save Modify] Starting save | index:', index, '| videoResults.length:', videoResults.length, '| step5Filter:', step5Filter);
                                          
                                          // Text și pozițiile roșu sunt deja în state (modifyDialogueText, modifyRedStart, modifyRedEnd)
                                          console.log('[Save Modify] Saving text with red positions:', modifyRedStart, '-', modifyRedEnd);
                                          
                                          // Dacă user a editat prompt text → salvează ca PROMPT_CUSTOM DOAR în sesiune (nu în database)
                                          if (modifyPromptType === 'PROMPT_CUSTOM' && modifyPromptText.trim().length > 0) {
                                            // Salvează în state pentru sesiune (dispare la expirarea sesiunii)
                                            setCustomPrompts(prev => ({
                                              ...prev,
                                              [index]: modifyPromptText,
                                            }));
                                            console.log('[Prompt Save] Custom prompt saved to session (not database):', index);
                                          }
                                          
                                          const updatedCombinations = [...combinations];
                                          updatedCombinations[index] = {
                                            ...updatedCombinations[index],
                                            text: modifyDialogueText,
                                            promptType: modifyPromptType,
                                          };
                                          setCombinations(updatedCombinations);
                                          
                                          // Update adLines with red text positions
                                          setAdLines(prev => prev.map(line => {
                                            if (line.text === combinations[index].text) {
                                              return {
                                                ...line,
                                                text: modifyDialogueText,
                                                charCount: modifyDialogueText.length,
                                                redStart: modifyRedStart,
                                                redEnd: modifyRedEnd,
                                              };
                                            }
                                            return line;
                                          }));
                                          
                                          // Capture updated state BEFORE setVideoResults
                                          let updatedVideoResults: any[] = [];
                                          
                                          // Update videoResults cu noul text ȘI red positions (forțează re-render)
                                          setVideoResults(prev => {
                                            updatedVideoResults = prev.map((v, i) =>
                                              i === index ? { 
                                                ...v, 
                                                text: modifyDialogueText,
                                                redStart: modifyRedStart,
                                                redEnd: modifyRedEnd,
                                                _forceUpdate: Date.now(), // Force React to detect change
                                              } : v
                                            );
                                            console.log('[Save Modify] BEFORE return - Updated text for index', index, ':', modifyDialogueText.substring(0, 50));
                                            return [...updatedVideoResults];
                                          });
                                          
                                          console.log('[Save Modify] AFTER setVideoResults - Updated videoResults[' + index + '] with red text:', modifyRedStart, '-', modifyRedEnd);
                                          
                                          // Salvează timestamp pentru "Edited X min ago"
                                          setEditTimestamps(prev => ({
                                            ...prev,
                                            [index]: Date.now(),
                                          }));
                                          
                                          // SAVE TO DATABASE with captured updated state
                                          console.log('[Database Save] Saving after text modification...');
                                          
                                          upsertContextSessionMutation.mutate({
                                            userId: localCurrentUser.id,
                                            tamId: selectedTamId,
                                            coreBeliefId: selectedCoreBeliefId,
                                            emotionalAngleId: selectedEmotionalAngleId,
                                            adId: selectedAdId,
                                            characterId: selectedCharacterId,
                                            currentStep,
                                            rawTextAd,
                                            processedTextAd,
                                            adLines,
                                            prompts,
                                            images,
                                            combinations: updatedCombinations,
                                            deletedCombinations,
                                            videoResults: updatedVideoResults,
                                            reviewHistory,
                                          }, {
                                            onSuccess: () => {
                                              console.log('[Database Save] Modifications saved to database!');
                                            },
                                            onError: (error) => {
                                              console.error('[Database Save] Failed:', error);
                                            },
                                          });
                                          
                                          toast.success('Modificări salvate!');
                                          setModifyingVideoIndex(null);
                                          
                                          // Auto-scroll to video card after save
                                          setTimeout(() => {
                                            const videoCard = document.getElementById(`video-card-${videoResults[index]?.videoName}`);
                                            if (videoCard) {
                                              videoCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                            }
                                          }, 100);
                                        }}
                                        disabled={modifyDialogueText.trim().length === 0}
                                        className="flex-1 bg-green-600 hover:bg-green-700"
                                      >
                                        Save
                                      </Button>
                                      {/* <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => regenerateWithModifications(index)}
                                        disabled={generateBatchMutation.isPending || modifyDialogueText.trim().length === 0}
                                        className="flex-1 border-orange-500 text-orange-700 hover:bg-orange-50"
                                      >
                                        {generateBatchMutation.isPending ? (
                                          <>
                                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                            Se trimite...
                                          </>
                                        ) : (
                                          'Save & Regenerate'
                                        )}
                                      </Button> */}
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setModifyingVideoIndex(null)}
                                        className="flex-1"
                                      >
                                        Cancel
                                      </Button>
                                    </div>
                                    </>
                                    ) : (
                                      /* Mod multiple (Da) - N secțiuni */
                                      <>
                                        {regenerateVariants.map((variant, variantIndex) => (
                                          <div key={variantIndex} className="p-3 bg-gray-50 border border-gray-300 rounded space-y-2">
                                            <h6 className="font-bold text-gray-900">Varianta {variantIndex + 1}</h6>
                                            
                                            {/* Prompt Type */}
                                            <div>
                                              <label className="text-xs font-medium text-gray-700 block mb-1">Prompt Type:</label>
                                              <select
                                                value={variant.promptType}
                                                onChange={async (e) => {
                                                  const newType = e.target.value as PromptType;
                                                  const updated = [...regenerateVariants];
                                                  updated[variantIndex] = { ...updated[variantIndex], promptType: newType };
                                                  
                                                  // Încărcă text hardcodat dacă nu e CUSTOM
                                                  if (newType !== 'PROMPT_CUSTOM') {
                                                     try {
                                                       const response = await fetch(`/api/trpc/prompt.getHardcodedPrompt?batch=1&input=${encodeURIComponent(JSON.stringify({ "0": { promptType: newType } }))}`);
                                                       const data = await response.json();
                                                       if (data[0]?.result?.data?.promptText) {
                                                         updated[variantIndex].promptText = data[0].result.data.promptText;
                                                      }
                                                    } catch (error) {
                                                      console.error('Eroare la încărcare prompt:', error);
                                                    }
                                                  }
                                                  
                                                  setRegenerateVariants(updated);
                                                }}
                                                className="w-full border border-gray-300 rounded px-2 py-1 text-xs"
                                              >
                                                <option value="PROMPT_NEUTRAL">PROMPT_NEUTRAL</option>
                                                <option value="PROMPT_SMILING">PROMPT_SMILING</option>
                                                <option value="PROMPT_CTA">PROMPT_CTA</option>
                                                <option value="PROMPT_CUSTOM">PROMPT_CUSTOM</option>
                                              </select>
                                            </div>
                                            
                                            {/* Edit Prompt Text */}
                                            <div>
                                              <label className="text-xs font-medium text-gray-700 block mb-1">Edit Prompt:</label>
                                              <Textarea
                                                value={variant.promptText}
                                                onChange={(e) => {
                                                  const updated = [...regenerateVariants];
                                                  updated[variantIndex] = { ...updated[variantIndex], promptText: e.target.value };
                                                  setRegenerateVariants(updated);
                                                }}
                                                placeholder="Introdu promptul aici"
                                                className="text-xs min-h-[60px]"
                                              />
                                            </div>
                                            
                                            {/* Edit Dialogue Text */}
                                            <div>
                                              <label className="text-xs font-medium text-gray-700 block mb-1">Edit Text:</label>
                                              <Textarea
                                                value={variant.dialogueText}
                                                onChange={(e) => {
                                                  const updated = [...regenerateVariants];
                                                  updated[variantIndex] = { ...updated[variantIndex], dialogueText: e.target.value };
                                                  setRegenerateVariants(updated);
                                                }}
                                                className="text-xs min-h-[50px]"
                                              />
                                              <p className={`text-xs mt-1 ${
                                                variant.dialogueText.length > 125 ? 'text-red-600 font-bold' : 'text-gray-500'
                                              }`}>
                                                {variant.dialogueText.length} caractere{variant.dialogueText.length > 125 ? ` - ${variant.dialogueText.length - 125} depășite!` : ''}
                                              </p>
                                            </div>
                                            
                                            {/* Select Image */}
                                            <div>
                                              <label className="text-xs font-medium text-gray-700 block mb-1">Imagine:</label>
                                              <select
                                                value={variant.imageUrl}
                                                onChange={(e) => {
                                                  const updated = [...regenerateVariants];
                                                  updated[variantIndex] = { ...updated[variantIndex], imageUrl: e.target.value };
                                                  setRegenerateVariants(updated);
                                                }}
                                                className="w-full border border-gray-300 rounded px-2 py-1 text-xs"
                                              >
                                                {images.map((img) => (
                                                  <option key={img.id} value={img.url}>{img.id}</option>
                                                ))}
                                              </select>
                                            </div>
                                          </div>
                                        ))}
                                        
                                        {/* Buttons (mod multiple) - SAVE + REGENERATE ALL */}
                                        <div className="space-y-2">
                                          <div className="flex gap-2">
                                            <Button
                                              size="sm"
                                              onClick={() => {
                                                // SAVE toate variantele
                                                toast.success(`${regenerateVariants.length} variante salvate!`);
                                                setModifyingVideoIndex(null);
                                              }}
                                              className="flex-1 bg-green-600 hover:bg-green-700"
                                            >
                                              Save All
                                            </Button>
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              onClick={() => setModifyingVideoIndex(null)}
                                              className="flex-1"
                                            >
                                              Cancel
                                            </Button>
                                          </div>
                                          
                                          {/* Regenerate All - trimite toate variantele pentru generare
                                          <Button
                                            size="sm"
                                            onClick={async () => {
                                              if (modifyingVideoIndex === null || modifyingVideoIndex < 0) {
                                                toast.error('Selectează un video pentru regenerare');
                                                return;
                                              }
                                              
                                              // Validare: toate variantele trebuie să aibă text valid
                                              const invalidVariants = regenerateVariants.filter(v => 
                                                v.dialogueText.trim().length === 0
                                              );
                                              
                                              if (invalidVariants.length > 0) {
                                                toast.error('Toate variantele trebuie să aibă text valid');
                                                return;
                                              }
                                              
                                              try {
                                                // Detectare setări identice
                                                const firstVariant = regenerateVariants[0];
                                                const allIdentical = regenerateVariants.every(v => 
                                                  v.promptType === firstVariant.promptType &&
                                                  v.promptText === firstVariant.promptText &&
                                                  v.dialogueText === firstVariant.dialogueText &&
                                                  v.imageUrl === firstVariant.imageUrl
                                                );
                                                
                                                if (allIdentical && regenerateVariants.length > 1) {
                                                  toast.info(`Se vor face ${regenerateVariants.length} regenerări cu aceleași setări (nu se vor crea duplicate)`);
                                                } else {
                                                  toast.info(`Se regenerează ${regenerateVariants.length} variant${regenerateVariants.length > 1 ? 'e' : 'ă'} în paralel...`);
                                                }
                                                
                                                // Pregătește variantele pentru backend
                                                const variantsForBackend = regenerateVariants.map((variant) => ({
                                                  promptType: variant.promptType,
                                                  promptText: variant.promptText || undefined,
                                                  dialogueText: variant.dialogueText,
                                                  imageUrl: variant.imageUrl,
                                                }));
                                                
                                                // Trimite toate variantele la backend pentru generare paralelă
                                                const result = await generateMultipleVariantsMutation.mutateAsync({
                                                  variants: variantsForBackend,
                                                });
                                                
                                                // Procesează rezultatele
                                                if (allIdentical && regenerateVariants.length > 1) {
                                                  // Setări identice: TOATE regenerările înlocuiesc același video (nu creăm duplicate)
                                                  // Folosim doar prima variantă (toate sunt identice)
                                                  const firstResult = result.results[0];
                                                  const firstVariant = regenerateVariants[0];
                                                  
                                                  if (firstResult.success) {
                                                    setVideoResults(prev =>
                                                      prev.map((v, i) =>
                                                        i === modifyingVideoIndex
                                                          ? {
                                                              ...v,
                                                              text: firstVariant.dialogueText,
                                                              imageUrl: firstVariant.imageUrl,
                                                              taskId: firstResult.taskId || '',
                                                              status: 'pending' as const,
                                                              error: undefined,
                                                              videoUrl: undefined,
                                                              regenerationNote: `${regenerateVariants.length} regenerări cu aceleași setări`,
                                                            }
                                                          : v
                                                      )
                                                    );
                                                    
                                                    setCombinations(prev =>
                                                      prev.map((c, i) =>
                                                        i === modifyingVideoIndex
                                                          ? {
                                                              ...c,
                                                              text: firstVariant.dialogueText,
                                                              imageUrl: firstVariant.imageUrl,
                                                              promptType: firstVariant.promptType,
                                                            }
                                                          : c
                                                      )
                                                    );
                                                  }
                                                } else {
                                                  // Setări diferite: creăm duplicate pentru variantele 2, 3, etc.
                                                  for (let variantIndex = 0; variantIndex < result.results.length; variantIndex++) {
                                                    const newResult = result.results[variantIndex];
                                                    const variant = regenerateVariants[variantIndex];
                                                    
                                                    if (variantIndex === 0 && newResult.success) {
                                                      // Prima variantă înlocuiește videoul original
                                                      setVideoResults(prev =>
                                                        prev.map((v, i) =>
                                                          i === modifyingVideoIndex
                                                            ? {
                                                                ...v,
                                                                text: variant.dialogueText,
                                                                imageUrl: variant.imageUrl,
                                                                taskId: newResult.taskId || '',
                                                                status: 'pending' as const,
                                                                error: undefined,
                                                                videoUrl: undefined,
                                                              }
                                                            : v
                                                        )
                                                      );
                                                      
                                                      // Update combinations
                                                      setCombinations(prev =>
                                                        prev.map((c, i) =>
                                                          i === modifyingVideoIndex
                                                            ? {
                                                                ...c,
                                                                text: variant.dialogueText,
                                                                imageUrl: variant.imageUrl,
                                                                promptType: variant.promptType,
                                                              }
                                                            : c
                                                        )
                                                      );
                                                    } else if (variantIndex > 0 && newResult.success) {
                                                      // Variantele următoare se adaugă ca videouri noi
                                                      const originalVideo = videoResults[modifyingVideoIndex];
                                                      const originalCombo = combinations[modifyingVideoIndex];
                                                      
                                                      setVideoResults(prev => [
                                                        ...prev,
                                                        {
                                                          text: variant.dialogueText,
                                                          imageUrl: variant.imageUrl,
                                                          taskId: newResult.taskId || '',
                                                          status: 'pending' as const,
                                                          error: undefined,
                                                          videoName: `${originalVideo.videoName}_V${variantIndex + 1}`,
                                                          section: originalVideo.section,
                                                          categoryNumber: originalVideo.categoryNumber,
                                                          reviewStatus: null,
                                                        },
                                                      ]);
                                                      
                                                      setCombinations(prev => [
                                                        ...prev,
                                                        {
                                                          ...originalCombo,
                                                          text: variant.dialogueText,
                                                          imageUrl: variant.imageUrl,
                                                          promptType: variant.promptType,
                                                          videoName: `${originalCombo.videoName}_V${variantIndex + 1}`,
                                                        },
                                                      ]);
                                                    }
                                                  }
                                                }
                                                
                                                // Toast final cu rezultate
                                                const successCount = result.results.filter((r: any) => r.success).length;
                                                const failCount = result.results.filter((r: any) => !r.success).length;
                                                
                                                if (successCount > 0) {
                                                  toast.success(`${successCount} variant${successCount > 1 ? 'e trimise' : 'ă trimisă'} pentru generare!`);
                                                }
                                                if (failCount > 0) {
                                                  toast.error(`${failCount} variant${failCount > 1 ? 'e au eșuat' : 'ă a eșuat'}`);
                                                }
                                                
                                                // Reset form
                                                setModifyingVideoIndex(null);
                                                setRegenerateVariants([]);
                                              } catch (error: any) {
                                                toast.error(`Eroare la regenerare: ${error.message}`);
                                              }
                                            }}
                                            disabled={generateMultipleVariantsMutation.isPending}
                                            className="w-full bg-orange-600 hover:bg-orange-700"
                                          >
                                            {generateMultipleVariantsMutation.isPending ? (
                                              <>
                                                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                                Se regenerează...
                                              </>
                                            ) : (
                                              `Regenerate All (${regenerateVariants.length} variante)`
                                            )}
                                          </Button> */}
                                        </div>
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                              
                            </>
                          )}
                          
                          {/* NULL Status (duplicate negenerat) */}
                          {result.status === null && result.isDuplicate && (
                            <>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 bg-gray-50 border-2 border-gray-400 px-3 py-2 rounded-lg mb-2">
                                  <Clock className="w-5 h-5 text-gray-600" />
                                  <span className="text-sm text-gray-700 font-bold">
                                    Not Generated Yet (Duplicate {result.duplicateNumber})
                                  </span>
                                </div>
                                <div className="hidden">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setModifyingVideoIndex(realIndex);
                                      const currentPromptType = combinations[realIndex]?.promptType || 'PROMPT_NEUTRAL';
                                      setModifyPromptType(currentPromptType);
                                      
                                      // Încărcă prompt text by default
                                      if (currentPromptType === 'PROMPT_CUSTOM' && customPrompts[realIndex]) {
                                        // Dacă video are PROMPT_CUSTOM salvat → afișează-l
                                        setModifyPromptText(customPrompts[realIndex]);
                                      } else {
                                        // Încărcă template-ul promptului din Prompt Library
                                        const promptFromLibrary = promptLibrary.find(p => p.promptName === currentPromptType);
                                        if (promptFromLibrary?.promptTemplate) {
                                          setModifyPromptText(promptFromLibrary.promptTemplate);
                                        } else {
                                          setModifyPromptText('');
                                        }
                                      }
                                      
                                      setModifyDialogueText(result.text);
                                      
                                      if (result.redStart !== undefined && result.redEnd !== undefined && result.redStart >= 0) {
                                        setModifyRedStart(result.redStart);
                                        setModifyRedEnd(result.redEnd);
                                      } else {
                                        setModifyRedStart(-1);
                                        setModifyRedEnd(-1);
                                      }
                                    }}
                                    className="flex-1 border-orange-500 text-orange-700 hover:bg-orange-50"
                                  >
                                    Modify & Regenerate
                                  </Button>
                                  
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      deleteDuplicate(result.videoName);
                                    }}
                                    className="flex-1 border-red-500 text-red-700 hover:bg-red-50"
                                  >
                                    Delete Duplicate
                                  </Button>
                                </div>
                                
                                {/* Modify & Regenerate Form pentru duplicate */}
                                {modifyingVideoIndex === realIndex && (
                                  <div 
                                    data-modify-form={realIndex}
                                    className="mt-4 p-3 sm:p-4 bg-white border-2 border-orange-300 rounded-lg space-y-3"
                                  >
                                    <h5 className="font-bold text-orange-900">Edit Video</h5>
                                    
                                    {/* Aici va fi formularul - va folosi același formular ca pentru failed */}
                                    {/* TODO: Add form fields */}
                                  </div>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                      
                      {/* Butoane verticale în dreapta */}
                      <div className="flex flex-col gap-1 flex-shrink-0">
                          {/* Edit button */}
                          <button
                            onClick={() => {
                              console.log('[Edit Modal] Opening for:', result.videoName, '| realIndex:', realIndex, '| step5Filter:', step5Filter);
                              if (realIndex === -1) {
                                console.error('[Edit Modal] Cannot open - video not found in videoResults:', result.videoName);
                                return;
                              }
                              setModifyingVideoIndex(realIndex);
                              const currentPromptType = combinations[realIndex]?.promptType || 'PROMPT_NEUTRAL';
                              setModifyPromptType(currentPromptType);
                              
                              if (currentPromptType === 'PROMPT_CUSTOM' && customPrompts[realIndex]) {
                                setModifyPromptText(customPrompts[realIndex]);
                              } else {
                                const promptFromLibrary = promptLibrary.find(p => p.promptName === currentPromptType);
                                if (promptFromLibrary?.promptTemplate) {
                                  setModifyPromptText(promptFromLibrary.promptTemplate);
                                } else {
                                  setModifyPromptText('');
                                }
                              }
                              
                              setModifyDialogueText(result.text);
                              
                              if (result.redStart !== undefined && result.redEnd !== undefined && result.redStart >= 0) {
                                setModifyRedStart(result.redStart);
                                setModifyRedEnd(result.redEnd);
                              } else {
                                setModifyRedStart(-1);
                                setModifyRedEnd(-1);
                              }
                              
                              // Preselect character in Select Image dropdown
                              const currentImageUrl = combinations[realIndex]?.imageUrl;
                              if (currentImageUrl) {
                                const currentImage = libraryImages.find(img => img.imageUrl === currentImageUrl);
                                if (currentImage?.characterName) {
                                  setModifyImageCharacterFilter(currentImage.characterName);
                                } else {
                                  setModifyImageCharacterFilter('all');
                                }
                              } else {
                                setModifyImageCharacterFilter('all');
                              }
                            }}
                            className="px-2 py-1.5 border border-orange-500 text-orange-700 hover:bg-orange-50 rounded flex items-center gap-1.5 transition-colors text-xs font-medium"
                            title="Edit"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            <span>Edit</span>
                          </button>
                          
                          {/* Regenerate button */}
                          <button
                            onClick={() => {
                              regenerateSingleVideo(realIndex);
                            }}
                            className="px-2 py-1.5 border border-green-500 text-green-700 hover:bg-green-50 rounded flex items-center gap-1.5 transition-colors text-xs font-medium"
                            title="Regenerate"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            <span>Regen</span>
                          </button>
                          
                          {/* Duplicate button */}
                          <button
                            onClick={() => {
                              duplicateVideo(result.videoName);
                            }}
                            className="px-2 py-1.5 border border-blue-500 text-blue-700 hover:bg-blue-50 rounded flex items-center gap-1.5 transition-colors text-xs font-medium"
                            title="Duplicate"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                            </svg>
                            <span>Dupl</span>
                          </button>
                          
                          {/* Delete button - available for all videos */}
                          <button
                            onClick={() => {
                              deleteDuplicate(result.videoName);
                            }}
                            className="px-2 py-1.5 border border-red-500 text-red-700 hover:bg-red-50 rounded flex items-center gap-1.5 transition-colors text-xs font-medium"
                            title="Delete"
                          >
                               <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            <span>Del</span>
                          </button>
                        </div>
                    </div>
                  </div>
                  );
                })}
              </div>
              
              {/* Buton Regenerate ALL (Failed + Rejected) */}
              {videoResults.some(v => v.status === 'failed' || v.reviewStatus === 'regenerate') && modifyingVideoIndex === null && (
                <div className="mt-6">
                  <Button
                    onClick={regenerateAll}
                    disabled={generateBatchMutation.isPending}
                    className="bg-red-600 hover:bg-red-700 w-full py-4 text-base"
                  >
                    {generateBatchMutation.isPending ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Se regenerează...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-5 h-5 mr-2" />
                        Regenerate ALL ({(() => {
                          const failedCount = videoResults.filter(v => v.status === 'failed').length;
                          const rejectedCount = videoResults.filter(v => v.reviewStatus === 'regenerate').length;
                          // Rejected videos use regenerateVariantCount if regenerateMultiple is enabled
                          const rejectedTotal = regenerateMultiple ? rejectedCount * regenerateVariantCount : rejectedCount;
                          return failedCount + rejectedTotal;
                        })()})
                      </>
                    )}
                  </Button>
                </div>
              )}
              

              {/* Buton pentru a trece la STEP 7 */}
              {videoResults.some(v => v.status === 'success') && (
                <div className="mt-6 flex justify-between items-center">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentStep(5)}
                    className="px-6 py-3"
                  >
                    <ChevronLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                  <Button
                    onClick={goToCheckVideos}
                    className="bg-green-600 hover:bg-green-700 px-8 py-8 text-lg"
                  >
                    <CheckCircle2 className="w-5 h-5 mr-2" />
                    Next: Check ({videoResults.filter(v => v.status === 'success').length})
                    <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* STEP 7 REMOVED - Nu mai există, funcționalitatea e în STEP 5 */}
        {false && (
          <Card className="mb-8 border-2 border-orange-200">
            <CardHeader className="bg-orange-50">
              <CardTitle className="flex items-center gap-2 text-orange-900">
                <Undo2 className="w-5 h-5" />
                STEP 7 - Regenerare Avansată
              </CardTitle>
              <CardDescription>
                Regenerează videouri cu setări personalizate. Poți crea multiple variante pentru fiecare video.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 md:pt-6 px-3 md:px-6">
              {/* Selectare video pentru regenerare */}
              <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <p className="font-medium text-orange-900 mb-3">
                  Selectează videoul care trebuie regenerat:
                </p>
                <select
                  className="w-full p-3 border border-orange-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  value={selectedVideoIndex}
                  onChange={(e) => {
                    const index = parseInt(e.target.value);
                    setSelectedVideoIndex(index);
                    
                    if (index >= 0) {
                      const video = videoResults[index];
                      const combo = combinations[index];
                      // Inițializează prima variantă cu datele actuale
                      setRegenerateVariants([{
                        promptType: combo?.promptType || 'PROMPT_NEUTRAL',
                        promptText: '',
                        dialogueText: video.text,
                        imageUrl: video.imageUrl,
                      }]);
                    } else {
                      setRegenerateVariants([]);
                    }
                  }}
                >
                  <option value="-1">Selectează un video...</option>
                  {videoResults.map((video, index) => (
                    <option key={index} value={index}>
                      {video.videoName} - {video.status === 'failed' ? 'FAILED' : video.text.substring(0, 50)}...
                    </option>
                  ))}
                </select>
              </div>

              {regenerateVariants.length > 0 && (
                <>
                  {/* Radio button: Vrei să regenerezi mai multe videouri? */}
                  <div className="mb-6 p-4 bg-white border-2 border-orange-300 rounded-lg">
                    <p className="font-medium text-orange-900 mb-3">
                      Vrei să regenerezi mai multe videouri?
                    </p>
                    <div className="flex gap-4 mb-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="regenerateMultiple"
                          checked={!regenerateMultiple}
                          onChange={() => {
                            setRegenerateMultiple(false);
                            setRegenerateVariantCount(1);
                            // Păstrează doar prima variantă
                            setRegenerateVariants(prev => [prev[0]]);
                          }}
                          className="w-4 h-4"
                        />
                        <span className="text-orange-900">Nu</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="regenerateMultiple"
                          checked={regenerateMultiple}
                          onChange={() => setRegenerateMultiple(true)}
                          className="w-4 h-4"
                        />
                        <span className="text-orange-900">Da</span>
                      </label>
                    </div>

                    {/* Selector număr variante (1-10) */}
                    {regenerateMultiple && (
                      <div className="mt-4">
                        <label className="block text-sm font-medium text-orange-900 mb-2">
                          Câte variante vrei să generezi? (1-10)
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={regenerateVariantCount}
                          onChange={(e) => {
                            const count = Math.min(10, Math.max(1, parseInt(e.target.value) || 1));
                            setRegenerateVariantCount(count);
                            
                            // Ajustează array-ul de variante
                            setRegenerateVariants(prev => {
                              const newVariants = [...prev];
                              while (newVariants.length < count) {
                                newVariants.push({
                                  promptType: 'PROMPT_NEUTRAL',
                                  promptText: '',
                                  dialogueText: prev[0]?.dialogueText || '',
                                  imageUrl: prev[0]?.imageUrl || '',
                                });
                              }
                              return newVariants.slice(0, count);
                            });
                          }}
                          className="w-full p-3 border border-orange-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                      </div>
                    )}
                  </div>

                  {/* UI pentru fiecare variantă */}
                  <div className="space-y-6 mb-6">
                    {regenerateVariants.map((variant, variantIndex) => (
                      <div key={variantIndex} className="p-4 bg-white border-2 border-orange-300 rounded-lg">
                        <h4 className="font-bold text-orange-900 mb-4 text-lg border-b-2 border-orange-200 pb-2">
                          Variantă #{variantIndex + 1}
                        </h4>
                        
                        {/* Select Prompt Type */}
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-orange-900 mb-2">
                            Tip Prompt:
                          </label>
                          <select
                            value={variant.promptType}
                            onChange={(e) => {
                              setRegenerateVariants(prev =>
                                prev.map((v, i) =>
                                  i === variantIndex
                                    ? { ...v, promptType: e.target.value as PromptType | 'custom' }
                                    : v
                                )
                              );
                            }}
                            className="w-full p-3 border border-orange-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                          >
                            <option value="PROMPT_NEUTRAL">PROMPT_NEUTRAL</option>
                            <option value="PROMPT_SMILING">PROMPT_SMILING</option>
                            <option value="PROMPT_CTA">PROMPT_CTA</option>
                            <option value="custom">Custom (scrie manual)</option>
                            {prompts.map(p => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                        </div>

                        {/* Textarea Prompt Custom (dacă e selectat custom sau vrea să modifice) */}
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-orange-900 mb-2">
                            Prompt Text (opțional - override hardcoded):
                          </label>
                          <textarea
                            value={variant.promptText}
                            onChange={(e) => {
                              setRegenerateVariants(prev =>
                                prev.map((v, i) =>
                                  i === variantIndex
                                    ? { ...v, promptText: e.target.value }
                                    : v
                                )
                              );
                            }}
                            placeholder="Lasă gol pentru a folosi promptul selectat mai sus, sau scrie aici pentru a-l modifica temporar..."
                            className="w-full h-24 p-3 border border-orange-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-orange-500"
                          />
                        </div>

                        {/* Select Imagine */}
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-orange-900 mb-2">
                            Imagine:
                          </label>
                          <select
                            value={variant.imageUrl}
                            onChange={(e) => {
                              setRegenerateVariants(prev =>
                                prev.map((v, i) =>
                                  i === variantIndex
                                    ? { ...v, imageUrl: e.target.value }
                                    : v
                                )
                              );
                            }}
                            className="w-full p-3 border border-orange-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                          >
                            {images.map(img => (
                              <option key={img.id} value={img.url}>
                                {img.url.split('/').pop()?.substring(0, 50)}
                              </option>
                            ))}
                          </select>
                          {/* Preview imagine */}
                          {variant.imageUrl && (
                            <img
                              src={variant.imageUrl}
                              alt="Preview"
                              className="mt-2 w-32 h-32 object-cover rounded border-2 border-orange-300"
                            />
                          )}
                        </div>

                        {/* Textarea Text Dialogue */}
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-orange-900 mb-2">
                            Text Dialogue:
                          </label>
                          <textarea
                            value={variant.dialogueText}
                            onChange={(e) => {
                              setRegenerateVariants(prev =>
                                prev.map((v, i) =>
                                  i === variantIndex
                                    ? { ...v, dialogueText: e.target.value }
                                    : v
                                )
                              );
                            }}
                            className={`w-full h-24 p-3 border rounded-lg resize-none focus:outline-none focus:ring-2 ${
                              variant.dialogueText.length > 125
                                ? 'border-red-500 focus:ring-red-500'
                                : 'border-orange-300 focus:ring-orange-500'
                            }`}
                          />
                          <p className={`text-sm mt-1 ${
                            variant.dialogueText.length > 125 ? 'text-red-600 font-bold' : 'text-gray-600'
                          }`}>
                            {variant.dialogueText.length} caractere{variant.dialogueText.length > 125 ? ` - ${variant.dialogueText.length - 125} caractere depășite!` : ''}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Butoane acțiune */}
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                    <Button
                      onClick={async () => {
                        if (selectedVideoIndex < 0) {
                          toast.error('Selectează un video pentru regenerare');
                          return;
                        }

                        // Validare: toate variantele trebuie să aibă text valid (nu mai blochez pentru > 125)
                        const invalidVariants = regenerateVariants.filter(v => 
                          v.dialogueText.trim().length === 0
                        );
                        
                        if (invalidVariants.length > 0) {
                          toast.error('Toate variantele trebuie să aibă text valid (minim 1 caracter)');
                          return;
                        }

                        try {
                          toast.info(`Se regenerează ${regenerateVariants.length} variant${regenerateVariants.length > 1 ? 'e' : 'ă'} în paralel...`);
                          
                          // Pregătește toate variantele pentru backend
                          const variantsForBackend = regenerateVariants.map((variant, variantIndex) => {
                            // Determină prompt template
                            let promptTemplate: string = '';
                            let promptText: string | undefined = undefined;
                            
                            if (variant.promptText.trim().length > 0) {
                              // Folosește prompt custom scris manual
                              promptText = variant.promptText;
                            } else if (variant.promptType === 'custom') {
                              // Skip - va fi gestionat de backend
                              promptText = '';
                            } else {
                              // Folosește prompt custom din listă
                              const customPrompt = prompts.find(p => p.id === variant.promptType);
                              if (customPrompt) {
                                promptText = customPrompt.template;
                              }
                            }
                            
                            return {
                              promptType: variant.promptType,
                              promptText: promptText,
                              dialogueText: variant.dialogueText,
                              imageUrl: variant.imageUrl,
                            };
                          });
                          
                          // Trimite toate variantele la backend pentru generare paralelă
                          const result = await generateMultipleVariantsMutation.mutateAsync({
                            variants: variantsForBackend,
                          });
                          
                          // Procesează rezultatele
                          for (let variantIndex = 0; variantIndex < result.results.length; variantIndex++) {
                            const newResult = result.results[variantIndex];
                            const variant = regenerateVariants[variantIndex];
                            
                            // Actualizează videoResults: adaugă sau înlocuiește
                            if (variantIndex === 0 && newResult.success) {
                              // Prima variantă înlocuiește videoul original
                              setVideoResults(prev =>
                                prev.map((v, i) =>
                                  i === selectedVideoIndex
                                    ? {
                                        ...v,
                                        text: variant.dialogueText,
                                        imageUrl: variant.imageUrl,
                                        taskId: newResult.taskId,
                                        status: newResult.success ? 'pending' as const : 'failed' as const,
                                        error: newResult.error,
                                        videoUrl: undefined,
                                      }
                                    : v
                                )
                              );
                              
                              // Update combinations
                              setCombinations(prev =>
                                prev.map((c, i) =>
                                  i === selectedVideoIndex
                                    ? {
                                        ...c,
                                        text: variant.dialogueText,
                                        imageUrl: variant.imageUrl,
                                      }
                                    : c
                                )
                              );
                            } else if (variantIndex > 0 && newResult.success) {
                              // Variantele următoare se adaugă ca videouri noi
                              const originalVideo = videoResults[selectedVideoIndex];
                              const originalCombo = combinations[selectedVideoIndex];
                              
                              setVideoResults(prev => [
                                ...prev,
                                {
                                  text: variant.dialogueText,
                                  imageUrl: variant.imageUrl,
                                  taskId: newResult.taskId || '',
                                  status: 'pending' as const,
                                  error: undefined,
                                  videoName: `${originalVideo.videoName}_V${variantIndex + 1}`,
                                  section: originalVideo.section,
                                  categoryNumber: originalVideo.categoryNumber,
                                  reviewStatus: null,
                                },
                              ]);
                              
                              setCombinations(prev => [
                                ...prev,
                                {
                                  ...originalCombo,
                                  text: variant.dialogueText,
                                  imageUrl: variant.imageUrl,
                                  videoName: `${originalCombo.videoName}_V${variantIndex + 1}`,
                                },
                              ]);
                            }
                          }
                          
                          // Toast final cu rezultate
                          const successCount = result.results.filter((r: any) => r.success).length;
                          const failCount = result.results.filter((r: any) => !r.success).length;
                          
                          if (successCount > 0) {
                            toast.success(`${successCount} variant${successCount > 1 ? 'e trimise' : 'ă trimisă'} pentru generare!`);
                          }
                          if (failCount > 0) {
                            toast.error(`${failCount} variant${failCount > 1 ? 'e au eșuat' : 'ă a eșuat'}`);
                          }

                          // Reset form
                          setSelectedVideoIndex(-1);
                          setRegenerateVariants([]);
                          setRegenerateMultiple(false);
                          setRegenerateVariantCount(1);
                          
                          // Revino la STEP 6 pentru a verifica progresul
                          setCurrentStep(6);
                          toast.success('Regenerare completă! Verifică progresul la STEP 6.');
                        } catch (error: any) {
                          toast.error(`Eroare la regenerare: ${error.message}`);
                        }
                      }}
                      disabled={generateBatchMutation.isPending || selectedVideoIndex < 0}
                      className="flex-1 bg-orange-600 hover:bg-orange-700 py-6 text-lg"
                    >
                      {generateBatchMutation.isPending ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          Se regenerează...
                        </>
                      ) : (
                        <>
                          <Undo2 className="w-5 h-5 mr-2" />
                          Regenerate ({regenerateVariants.length} variant{regenerateVariants.length > 1 ? 'e' : 'ă'})
                        </>
                      )}
                    </Button>

                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* STEP 7: Check Videos (Final Review) */}
        {currentStep === 7 && videoResults.length > 0 && (() => {
          console.log('STEP 7 RENDER - videoResults:', videoResults.map(v => ({
            videoName: v.videoName,
            status: v.status,
            hasVideoUrl: !!v.videoUrl,
            videoUrl: v.videoUrl?.substring(0, 50) + '...',
          })));
          return true;
        })() && (
          <Card className="mb-8 border-2 border-green-200">
            <CardHeader className="bg-green-50">
              <CardTitle className="flex items-center gap-2 text-green-900">
                <Video className="w-5 h-5" />
                STEP 7 - Check Videos
              </CardTitle>
              <CardDescription>
                Review videourilo generate. Acceptă sau marchează pentru regenerare.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 md:pt-6 px-3 md:px-6">
              {/* Filtru videouri + Sample Merge button */}
              <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
                  <label className="text-sm font-medium text-green-900">Filtrează videouri:</label>
                  <select
                    value={videoFilter}
                    onChange={(e) => setVideoFilter(e.target.value as 'all' | 'accepted' | 'failed' | 'no_decision')}
                    className="px-4 py-2 border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="all">Afișează Toate ({videoResults.length})</option>
                    <option value="accepted">Doar Acceptate ({acceptedCount})</option>
                    <option value="failed">Doar Failed/Pending ({failedCount})</option>
                    <option value="no_decision">Doar Fără Decizie ({videosWithoutDecisionCount})</option>
                  </select>
                  <span className="text-xs text-gray-500 italic">Filtru funcționează doar la refresh</span>
                </div>
                

              </div>
              
              {/* Buton UNDO */}
              {reviewHistory.length > 0 && (
                <div className="mb-6">
                  <Button
                    onClick={undoReview}
                    variant="outline"
                    className="border-orange-500 text-orange-700 hover:bg-orange-50"
                  >
                    <Undo2 className="w-4 h-4 mr-2" />
                    UNDO ({reviewHistory.length} acțiuni)
                  </Button>
                </div>
              )}

              {/* Organizare pe categorii */}
              {['HOOKS', 'MIRROR', 'DCS', 'TRANZITION', 'NEW_CAUSE', 'MECHANISM', 'EMOTIONAL_PROOF', 'TRANSFORMATION', 'CTA'].map(category => {
                // Filtrare videouri: doar cele generate cu succes (status === 'success' și videoUrl există)
                // Use step6FilteredVideos to prevent auto-remove on decision change
                let categoryVideos = step6FilteredVideos.filter(v => 
                  v.section === category && 
                  v.status === 'success' && 
                  v.videoUrl
                );
                
                if (categoryVideos.length === 0) return null;
                
                return (
                  <div key={category} className="mb-8">
                    <h3 className="text-xl font-bold text-green-900 mb-4 border-b-2 border-green-300 pb-2">
                      {category}
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {categoryVideos.map((video) => {
                        console.log(`Rendering video ${video.videoName}:`, {
                          status: video.status,
                          hasVideoUrl: !!video.videoUrl,
                          videoUrl: video.videoUrl,
                        });
                        return (
                        <div key={video.videoName} className="p-4 bg-white rounded-lg border-2 border-green-200">
                          {/* TITLE */}
                          <div className="mb-2">
                            {editingVideoName === video.videoName ? (
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <Input
                                    type="text"
                                    value={editedVideoNameText}
                                    onChange={(e) => setEditedVideoNameText(e.target.value)}
                                    className="flex-1 text-sm font-bold"
                                    autoFocus
                                  />
                                </div>
                                <div className="flex items-center gap-2">
                                  <label className="text-sm font-medium text-gray-700 min-w-[80px]">Category:</label>
                                  <select
                                    value={editingCategory}
                                    onChange={(e) => setEditingCategory(e.target.value)}
                                    className="flex-1 p-2 border border-gray-300 rounded text-sm"
                                  >
                                    <option value="HOOKS">HOOKS</option>
                                    <option value="MIRROR">MIRROR</option>
                                    <option value="DCS">DCS</option>
                                    <option value="TRANZITION">TRANZITION</option>
                                    <option value="NEW_CAUSE">NEW_CAUSE</option>
                                    <option value="MECHANISM">MECHANISM</option>
                                    <option value="EMOTIONAL_PROOF">EMOTIONAL_PROOF</option>
                                    <option value="TRANSFORMATION">TRANSFORMATION</option>
                                    <option value="CTA">CTA</option>
                                    <option value="OTHER">OTHER</option>
                                  </select>
                                </div>
                                <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  onClick={async () => {
                                    // Save to database
                                    const oldVideoName = video.videoName;
                                    const newVideoName = editedVideoNameText.trim();
                                    
                                    if (!newVideoName) {
                                      toast.error('Numele video nu poate fi gol!');
                                      return;
                                    }
                                    
                                    // Check if name already exists
                                    const nameExists = videoResults.some(v => v.videoName === newVideoName && v.videoName !== oldVideoName);
                                    if (nameExists) {
                                      toast.error('Un video cu acest nume există deja!');
                                      return;
                                    }
                                    
                                    // Update local state (name + category)
                                    setVideoResults(prev => prev.map(v =>
                                      v.videoName === oldVideoName
                                        ? { ...v, videoName: newVideoName, section: editingCategory as any }
                                        : v
                                    ));
                                    
                                    // Save to database
                                    try {
                                      await upsertContextSessionMutation.mutateAsync({
                                        userId: localCurrentUser.id,
                                        tamId: selectedTamId || undefined,
                                        coreBeliefId: selectedCoreBeliefId!,
                                        emotionalAngleId: selectedEmotionalAngleId!,
                                        adId: selectedAdId!,
                                        characterId: selectedCharacterId!,
                                        sessionData: {
                                          currentStep,
                                          rawTextAd,
                                          processedTextAd,
                                          adLines,
                                          prompts,
                                          images,
                                          combinations,
                                          deletedCombinations,
                                          videoResults: videoResults.map(v =>
                                            v.videoName === oldVideoName
                                              ? { ...v, videoName: newVideoName, section: editingCategory as any }
                                              : v
                                          ),
                                          reviewHistory,
                                          hookMergedVideos,
                                          bodyMergedVideoUrl,
                                          finalVideos
                                        }
                                      }, {
                                        onSuccess: () => {
                                          toast.success(`Nume video actualizat: ${newVideoName}`);
                                          setEditingVideoName(null);
                                        },
                                        onError: (error: any) => {
                                          toast.error(`Eroare la salvare: ${error.message}`);
                                        }
                                      });
                                    } catch (error: any) {
                                      toast.error(`Eroare la salvare: ${error.message}`);
                                    }
                                  }}
                                  className="bg-green-600 hover:bg-green-700 text-white"
                                >
                                  <Check className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setEditingVideoName(null);
                                    setEditedVideoNameText('');
                                  }}
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <h4 className="font-bold text-green-900 text-lg flex-1">{video.videoName}</h4>
                                <button
                                  onClick={() => {
                                    setEditingVideoName(video.videoName);
                                    setEditedVideoNameText(video.videoName);
                                    setEditingCategory(video.section);
                                  }}
                                  className="text-gray-500 hover:text-green-600 transition-colors"
                                  title="Edit name and category"
                                >
                                  <FileEdit className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </div>
                          
                          {/* Text with red highlighting */}
                          <p className="text-sm text-gray-700 mb-3">
                            {video.redStart !== undefined && video.redStart >= 0 && video.redEnd !== undefined && video.redEnd >= 0 ? (
                              <>
                                {video.text.substring(0, video.redStart)}
                                <span className="text-red-600 font-bold">
                                  {video.text.substring(video.redStart, video.redEnd)}
                                </span>
                                {video.text.substring(video.redEnd)}
                              </>
                            ) : (
                              video.text
                            )}
                          </p>
                          
                          {/* VIDEO PLAYER SIMPLU */}
                          {video.videoUrl ? (
                            <video
                              controls
                              preload="metadata"
                              className="w-full max-w-[300px] mx-auto aspect-[9/16] object-cover rounded border-2 border-green-300 mb-3"
                            >
                              <source src={video.videoUrl} type="video/mp4" />
                              Browserul tău nu suportă video HTML5.
                            </video>
                          ) : (
                            <div className="w-full max-w-[300px] mx-auto aspect-[9/16] bg-blue-50 border-2 border-blue-300 rounded mb-3 flex flex-col items-center justify-center p-4">
                              <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-2" />
                              <p className="text-sm text-blue-700 font-medium">Se încarcă video...</p>
                            </div>
                          )}
                          
                          {/* BUTOANE ACCEPT/REGENERATE/DOWNLOAD */}
                          <div className="space-y-2">
                            {/* Butoane Accept/Regenerate - dispar după click */}
                            {!video.reviewStatus ? (
                              <div className="flex gap-2">
                                <Button
                                  onClick={() => acceptVideo(video.videoName)}
                                  size="sm"
                                  className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs py-1"
                                >
                                  <Check className="w-3 h-3 mr-1" />
                                  Accept
                                </Button>
                                
                                <Button
                                  onClick={() => regenerateVideo(video.videoName)}
                                  size="sm"
                                  className="flex-1 bg-red-600 hover:bg-red-700 text-white text-xs py-1"
                                >
                                  <X className="w-4 h-4 mr-1" />
                                  Regenerate
                                </Button>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <div className="flex gap-2 items-center">
                                  {/* Status după decizie */}
                                  <div className={`flex-1 px-3 py-2 rounded text-xs font-medium text-center ${
                                    video.reviewStatus === 'accepted' 
                                      ? 'bg-green-100 text-green-700 border border-green-300'
                                      : 'bg-red-100 text-red-700 border border-red-300'
                                  }`}>
                                    {video.reviewStatus === 'accepted' ? (
                                      <><Check className="w-3 h-3 inline mr-1" />Acceptat</>
                                    ) : (
                                      <><X className="w-3 h-3 inline mr-1" />Regenerare</>
                                    )}
                                  </div>
                                  
                                  {/* UNDO individual */}
                                  <Button
                                    onClick={() => undoReviewDecision(video.videoName)}
                                    size="sm"
                                    variant="outline"
                                    className="border-gray-400 text-gray-700 hover:bg-gray-100 text-xs py-1"
                                  >
                                    <Undo2 className="w-3 h-3 mr-1" />
                                    Undo
                                  </Button>
                                </div>
                                
                                {/* Add Note button (doar pentru Regenerare) */}
                                {video.reviewStatus === 'regenerate' && (
                                  <div>
                                    {editingNoteVideoName === video.videoName ? (
                                      <div className="bg-yellow-50 border-2 border-yellow-400 rounded p-3 space-y-2">
                                        <textarea
                                          value={noteText}
                                          onChange={(e) => setNoteText(e.target.value)}
                                          placeholder="Add internal note..."
                                          className="w-full p-2 border border-yellow-300 rounded text-xs bg-white"
                                          rows={3}
                                        />
                                        <div className="flex gap-2">
                                          <Button
                                            onClick={() => {
                                              // Save note - update state first
                                              const updatedVideoResults = videoResults.map(v =>
                                                v.videoName === video.videoName
                                                  ? { ...v, internalNote: noteText }
                                                  : v
                                              );
                                              
                                              setVideoResults([...updatedVideoResults]);
                                              
                                              // Save to DB with updated results
                                              upsertContextSessionMutation.mutate({
                                                userId: localCurrentUser.id,
                                                tamId: selectedTamId,
                                                coreBeliefId: selectedCoreBeliefId,
                                                emotionalAngleId: selectedEmotionalAngleId,
                                                adId: selectedAdId,
                                                characterId: selectedCharacterId,
                                                currentStep,
                                                rawTextAd,
                                                processedTextAd,
                                                adLines,
                                                prompts,
                                                images,
                                                combinations,
                                                deletedCombinations,
                                                videoResults: updatedVideoResults,
                                                reviewHistory,
                                              });
                                              
                                              toast.success('Note saved!');
                                              setEditingNoteVideoName(null);
                                              setNoteText('');
                                            }}
                                            size="sm"
                                            className="flex-1 bg-green-600 hover:bg-green-700 text-xs"
                                          >
                                            Save
                                          </Button>
                                          <Button
                                            onClick={() => {
                                              setEditingNoteVideoName(null);
                                              setNoteText('');
                                            }}
                                            size="sm"
                                            variant="outline"
                                            className="flex-1 text-xs"
                                          >
                                            Cancel
                                          </Button>
                                        </div>
                                      </div>
                                    ) : (
                                      <Button
                                        onClick={() => {
                                          setEditingNoteVideoName(video.videoName);
                                          setNoteText(video.internalNote || '');
                                        }}
                                        size="sm"
                                        className="w-full bg-yellow-500 hover:bg-yellow-600 text-white text-xs py-1"
                                      >
                                        {video.internalNote ? '📝 Edit Note' : '📝 Add Note'}
                                      </Button>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                            
                            {/* Buton Download Individual */}
                            {video.videoUrl && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={async () => {
                                  try {
                                    toast.info(`Descarcă ${video.videoName}...`);
                                    const response = await fetch(video.videoUrl!);
                                    const blob = await response.blob();
                                    const url = window.URL.createObjectURL(blob);
                                    const link = document.createElement('a');
                                    link.href = url;
                                    link.download = `${video.videoName}.mp4`;
                                    document.body.appendChild(link);
                                    link.click();
                                    document.body.removeChild(link);
                                    window.URL.revokeObjectURL(url);
                                    toast.success(`${video.videoName} descărcat!`);
                                  } catch (error) {
                                    console.error('Download error:', error);
                                    toast.error(`Eroare la descărcare: ${error}`);
                                  }
                                }}
                                className="w-full border-blue-500 text-blue-700 hover:bg-blue-50 text-xs py-1"
                              >
                                <Download className="w-3 h-3 mr-1" />
                                Download
                              </Button>
                            )}
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              
              {/* Statistici și Buton Next Step */}
              <div className="mt-8 p-6 bg-gray-50 border-2 border-gray-300 rounded-lg">
                {/* Statistici */}
                <div className="mb-4">
                  <p className="text-lg font-semibold text-gray-900 mb-2">Statistici Review:</p>
                  <div className="flex gap-4 text-sm">
                    <span className="text-green-700">
                      <Check className="w-4 h-4 inline mr-1" />
                      {acceptedCount} acceptate
                    </span>
                    <span className="text-red-700">
                      <X className="w-4 h-4 inline mr-1" />
                      {regenerateCount} pentru regenerare
                    </span>
                    <span className="text-gray-600">
                      {videosWithoutDecision.length} fără decizie
                    </span>
                  </div>
                </div>
                

                {/* Buton Regenerate Selected - afișează întotdeauna dacă există videouri marcate */}
                {videoResults.some(v => v.reviewStatus === 'regenerate') && (
                  <Button
                    onClick={() => {
                      // Setează filtrul la 'regenerate' în Step 6
                      setStep5Filter('regenerate');
                      toast.info('Regenerare videouri marcate...');
                      setCurrentStep(6);
                    }}
                    className="w-full bg-red-600 hover:bg-red-700 py-6 text-lg mb-4"
                  >
                    <RefreshCw className="w-5 h-5 mr-2" />
                    Regenerate Selected ({regenerateCount})
                  </Button>
                )}
                
                {/* Warning pentru videouri fără decizie */}
                {videosWithoutDecision.length > 0 && (
                  <div className="bg-red-100 border-2 border-red-700 rounded p-4 text-center">
                    <p className="text-red-900 font-medium">
                      ⚠️ {videosWithoutDecision.length} videouri fără decizie
                    </p>
                    <p className="text-sm text-red-800 mt-1">
                      Poți regenera videouri marcate chiar dacă nu ai luat decizie pentru toate.
                    </p>
                  </div>
                )}
                
                {/* Download buttons - moved inside Statistics container */}
                {acceptedVideosWithUrl.length > 0 && (
                  <div className="mt-4">
                    <Button
                      onClick={async () => {
                        const acceptedVideos = acceptedVideosWithUrl;
                      
                      if (acceptedVideos.length === 0) {
                        toast.error('Nu există videouri acceptate pentru download');
                        return;
                      }
                      
                      setIsDownloadZipModalOpen(true);
                      setDownloadZipProgress('Pregătesc arhiva ZIP...');
                      
                      try {
                        const zip = new JSZip();
                        
                        // Order videos by category: HOOKS, MIRROR, DCS, TRANZITION, NEW_CAUSE, MECHANISM, EMOTIONAL_PROOF, TRANSFORMATION, CTA
                        const categoryOrder = ['HOOKS', 'MIRROR', 'DCS', 'TRANZITION', 'NEW_CAUSE', 'MECHANISM', 'EMOTIONAL_PROOF', 'TRANSFORMATION', 'CTA'];
                        const orderedVideos: typeof acceptedVideos = [];
                        
                        categoryOrder.forEach(category => {
                          const categoryVideos = acceptedVideos.filter(v => v.section === category);
                          orderedVideos.push(...categoryVideos);
                        });
                        
                        // Download and add each video to ZIP with numbered prefix
                        for (let i = 0; i < orderedVideos.length; i++) {
                          const video = orderedVideos[i];
                          const videoNumber = i + 1;
                          
                          setDownloadZipProgress(`Descarc video ${videoNumber}/${orderedVideos.length}: ${video.videoName}...`);
                          
                          try {
                            const response = await fetch(video.videoUrl!);
                            const blob = await response.blob();
                            
                            // Add numbered prefix to filename
                            const filename = `${videoNumber}. ${video.videoName}.mp4`;
                            zip.file(filename, blob);
                          } catch (error) {
                            console.error(`Eroare la download ${video.videoName}:`, error);
                            toast.error(`Eroare la download ${video.videoName}`);
                          }
                        }
                        
                        setDownloadZipProgress('Creez arhiva ZIP...');
                        const zipBlob = await zip.generateAsync({ type: 'blob' });
                        
                        setDownloadZipProgress('Descarc arhiva...');
                        const url = window.URL.createObjectURL(zipBlob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = `Accepted_Videos_${new Date().toISOString().split('T')[0]}.zip`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        window.URL.revokeObjectURL(url);
                        
                        toast.success(`Arhiva ZIP cu ${orderedVideos.length} videouri descărcată!`);
                        setIsDownloadZipModalOpen(false);
                        setDownloadZipProgress('');
                      } catch (error: any) {
                        console.error('Eroare la crearea arhivei ZIP:', error);
                        toast.error(`Eroare: ${error.message}`);
                        setIsDownloadZipModalOpen(false);
                        setDownloadZipProgress('');
                      }
                    }}
                      className="w-auto mx-auto block border-2 border-blue-600 bg-white hover:bg-blue-50 text-blue-600 px-4 py-2 text-sm"
                    >
                      <Download className="w-4 h-4 mr-2 inline" />
                      Download Videos ({acceptedVideosWithUrl.length})
                    </Button>
                    
                    {/* Link pentru descărcare document Word cu liniile din Step 2 */}
                    <div className="mt-3 text-center">
                      <button
                        onClick={generateWordDocument}
                        className="text-blue-600 hover:text-blue-800 text-sm underline"
                      >
                        Descarcă document Word cu toate liniile extrase
                      </button>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Buton Video Editing - Step 8 */}
              {acceptedVideosWithUrl.length > 0 && (
                <div className="mt-8 flex justify-between items-center">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentStep(6)}
                      className="px-6 py-3"
                    >
                      <ChevronLeft className="w-4 h-4 mr-2" />
                      Back
                    </Button>
                    <div className="flex flex-col items-center gap-0">
                    <Button
                      onClick={async () => {
                        console.log('[Video Editing] 🔍 Total videos in videoResults:', videoResults.length);
                        console.log('[Video Editing] 🔍 All video names:', videoResults.map(v => v.videoName));
                        
                        // Filter only approved videos with trimmedVideoUrl
                        const approvedVideos = videoResults.filter(v => {
                          const isAccepted = v.reviewStatus === 'accepted';
                          const isSuccess = v.status === 'success';
                          const hasTrimmedUrl = !!v.trimmedVideoUrl;
                          
                          console.log(`[Video Editing] 🔍 ${v.videoName}:`, {
                            reviewStatus: v.reviewStatus,
                            isAccepted,
                            status: v.status,
                            isSuccess,
                            hasTrimmedUrl,
                            trimmedVideoUrl: v.trimmedVideoUrl?.substring(0, 50) + '...',
                            PASSES_FILTER: isAccepted && isSuccess && hasTrimmedUrl
                          });
                          
                          return isAccepted && isSuccess && hasTrimmedUrl;
                        });
                        
                        if (approvedVideos.length === 0) {
                          toast.error('Nu există videouri acceptate cu URL valid pentru editare');
                          return;
                        }
                        
                        // Process ALL approved videos (with or without red text)
                        const videosToProcess = approvedVideos;
                        
                        if (videosToProcess.length === 0) {
                          toast.error('❌ Nu există videouri acceptate! Verifică Step 7.');
                          return;
                        }
                        
                        console.log(`[Video Editing] ✅ Approved videos (${approvedVideos.length}):`, approvedVideos.map(v => v.videoName));
                        console.log(`[Video Editing] Starting batch processing for ${videosToProcess.length} videos (with and without red text)`);
                        console.log(`[Video Editing] 📋 Videos to process:`, videosToProcess.map(v => ({
                          name: v.videoName,
                          hasRedText: v.redStart !== undefined && v.redEnd !== undefined,
                          redStart: v.redStart,
                          redEnd: v.redEnd
                        })));
                        
                        // CLEAR old Step 8 data (editStatus, whisperTranscript, cutPoints, etc.) before starting new batch
                        // This preserves videos in Step 7 while removing Step 8 processing data
                        setVideoResults(prev => prev.map(v => 
                          v.editStatus === 'processed' 
                            ? { 
                                ...v, 
                                editStatus: null,
                                whisperTranscript: undefined,
                                cutPoints: undefined,
                                words: undefined,
                                audioUrl: undefined,
                                waveformData: undefined,
                                trimStatus: null,
                                trimmedVideoUrl: undefined,
                                acceptRejectStatus: null
                              }
                            : v
                        ));
                        
                        // Reset progress BEFORE opening modal to avoid showing old value
                        setProcessingProgress({ 
                          ffmpeg: { current: 0, total: videosToProcess.length },
                          whisper: { current: 0, total: videosToProcess.length },
                          cleanvoice: { current: 0, total: videosToProcess.length },
                          currentVideoName: '' 
                        });
                        setProcessingStep(null);
                        
                        // Open ProcessingModal and start batch processing
                        setShowProcessingModal(true);
                        
                        try {
                          await batchProcessVideosWithWhisper(videosToProcess);
                          
                          // Check if there are failed videos
                          const failedCount = processingProgress.failedVideos.length;
                          
                          // Keep modal open - user will click Continue or Retry Failed
                          if (failedCount > 0) {
                            toast.warning(`⚠️ Processing complete: ${processingProgress.successVideos.length} success, ${failedCount} failed. Please retry failed videos.`);
                          } else {
                            toast.success(`✅ ${videosToProcess.length} videouri procesate cu succes! Click Continue to proceed.`);
                          }
                        } catch (error: any) {
                          console.error('[Video Editing] Batch processing error:', error);
                          setShowProcessingModal(false);
                          toast.error(`Eroare la procesarea videouri: ${error.message}`);
                        }
                      }}
                      className="bg-purple-600 hover:bg-purple-700 px-8 py-8 text-lg"
                      disabled={acceptedVideosWithUrl.length === 0}
                    >
                      <div className="flex items-center">
                        Next: Auto-Prepare for Cutting ({acceptedVideosWithUrl.length})
                        <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </Button>
                    <div className="text-center mt-0">
                      <span className="text-xs opacity-70 font-normal">GO TO STEP 8</span>
                    </div>
                    </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* STEP 8: Video Editing */}
        {currentStep === 8 && (() => {
          // Filter approved videos that have videoUrl
          let approvedVideos = videoResults.filter(v => 
            v.reviewStatus === 'accepted' && 
            v.status === 'success' && 
            v.videoUrl
          );
          
          // Apply Step 8 filter
          if (step8Filter === 'accepted') {
            // Show videos that are accepted OR don't have recutStatus set yet (null/undefined)
            approvedVideos = approvedVideos.filter(v => v.recutStatus === 'accepted' || !v.recutStatus);
          } else if (step8Filter === 'recut') {
            approvedVideos = approvedVideos.filter(v => v.recutStatus === 'recut');
          } else if (step8Filter === 'unlocked') {
            approvedVideos = approvedVideos.filter(v => !v.isStartLocked || !v.isEndLocked);
          } else if (step8Filter === 'problems') {
            // Filter videos with problems (status is NOT 'success')
            // This checks the final badge status (green/yellow/red) from VideoEditorV2
            approvedVideos = approvedVideos.filter(v => 
              v.editingDebugInfo?.status && v.editingDebugInfo.status !== 'success'
            );
          } else if (step8Filter === 'with_notes') {
            // Filter videos with step9Note
            approvedVideos = approvedVideos.filter(v => v.step9Note);
          }
          return (
            <Card className="mb-8 border-2 border-purple-200">
              <CardHeader className="bg-purple-50">
                <CardTitle className="flex items-center gap-2 text-purple-900">
                  <Video className="w-5 h-5" />
                  STEP 8 - Video Editing
                </CardTitle>
                <CardDescription>
                  Editează videouri approved: ajustează START și END pentru tăiere în Step 9.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                {/* Filter Dropdown */}
                <div className="mb-6 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 w-full">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium text-purple-900">Filtrează videouri:</label>
                      <select
                        value={step8Filter}
                        onChange={(e) => setStep8Filter(e.target.value as 'all' | 'accepted' | 'recut' | 'unlocked' | 'problems' | 'with_notes')}
                        className="px-4 py-2 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="all">Toate ({videoResults.filter(v => v.reviewStatus === 'accepted' && v.status === 'success' && v.videoUrl).length})</option>
                        <option value="accepted">Acceptate ({videoResults.filter(v => v.reviewStatus === 'accepted' && v.status === 'success' && v.videoUrl && (v.recutStatus === 'accepted' || !v.recutStatus)).length})</option>
                        <option value="recut">Necesită Retăiere ({videoResults.filter(v => v.reviewStatus === 'accepted' && v.status === 'success' && v.videoUrl && v.recutStatus === 'recut').length})</option>
                        <option value="unlocked">Fără Lock ({videoResults.filter(v => v.reviewStatus === 'accepted' && v.status === 'success' && v.videoUrl && (!v.isStartLocked || !v.isEndLocked)).length})</option>
                        <option value="problems">Possible Problems ({videoResults.filter(v => v.reviewStatus === 'accepted' && v.status === 'success' && v.videoUrl && v.editingDebugInfo?.status && v.editingDebugInfo.status !== 'success').length})</option>
                        <option value="with_notes">With Notes ({videoResults.filter(v => v.reviewStatus === 'accepted' && v.status === 'success' && v.videoUrl && v.step9Note).length})</option>
                      </select>
                    </div>
                    
                    {/* Check Video with Problems link */}
                    {videoResults.filter(v => v.reviewStatus === 'accepted' && v.status === 'success' && v.videoUrl && v.editingDebugInfo?.status && v.editingDebugInfo.status !== 'success').length > 0 && (
                      <button
                        onClick={() => setStep8Filter('problems')}
                        className="text-sm text-red-600 hover:text-red-700 underline font-medium"
                      >
                        Check Video with Problems
                      </button>
                    )}
                  </div>
                  
                  {/* Sample Merge ALL Videos button */}
                  {videoResults.filter(v => v.reviewStatus === 'accepted' && v.status === 'success' && v.trimmedVideoUrl).length > 1 && (
                    <div className="flex flex-col items-end gap-1">
                    <Button
                      onClick={() => {
                        // Get ALL accepted videos with trimmed videos
                        const allAcceptedVideos = videoResults.filter(v => v.reviewStatus === 'accepted' && v.status === 'success' && v.trimmedVideoUrl);
                        handleSampleMerge(allAcceptedVideos);
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap"
                      size="sm"
                    >
                      🎬 Sample Merge ALL Videos
                    </Button>
                    {/* Open Last Sample link */}
                    {lastSampleVideoUrl && (
                      <button
                        onClick={() => {
                          // Reopen modal with last sample video
                          const allAcceptedVideos = videoResults.filter(v => v.reviewStatus === 'accepted' && v.status === 'success' && v.trimmedVideoUrl);
                          const videoList = allAcceptedVideos.map(v => ({
                            name: v.videoName,
                            note: v.step9Note || ''
                          }));
                          setSampleMergeVideos(videoList);
                          setSampleMergedVideoUrl(lastSampleVideoUrl);
                          setIsSampleMergeModalOpen(true);
                          setSampleMergeProgress('');
                        }}
                        className="text-blue-600 hover:text-blue-800 underline text-sm"
                      >
                        Open Last Sample
                      </button>
                    )}
                    </div>
                  )}
                </div>
                

                {approvedVideos.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-600">Nu există videouri approved pentru editare.</p>
                    <Button
                      onClick={() => setCurrentStep(7)}
                      className="mt-4"
                    >
                      Înapoi la Step 7
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {/* Video Editors - One per approved video */}
                    {approvedVideos.map((video, videoIndex) => {
                      // Convert waveformData JSON string to data URI for Peaks.js
                      // Use proper UTF-8 to base64 encoding (btoa doesn't handle UTF-8 correctly)
                      const peaksUrl = video.waveformData 
                        ? `data:application/json;base64,${btoa(unescape(encodeURIComponent(video.waveformData)))}`
                        : '';
                      
                      // Calculate duration from whisperTranscript (actual audio duration)
                      // DO NOT use cutPoints.endKeep as it changes when user adjusts markers!
                      // Whisper returns duration in seconds, use directly
                      const duration = video.whisperTranscript?.duration || 10; // Use actual audio duration in seconds
                      
                      return (
                        <div key={video.videoName} className="space-y-4">
                          <VideoEditorV2
                            key={`${video.videoName}-${video.audioUrl || 'no-audio'}-${video.step9Note || 'no-note'}`}
                            video={{
                            id: video.videoName, // Use videoName as unique identifier
                            videoName: video.videoName,
                            videoUrl: `/api/proxy-video?url=${encodeURIComponent(video.videoUrl!)}`,
                            audioUrl: video.audioUrl || '',
                            peaksUrl: peaksUrl,
                            cutPoints: video.cutPoints || { startKeep: 0, endKeep: duration * 1000 }, // Default: full video
                            duration: duration,
                            text: video.text,
                            redStart: video.redStart,
                            redEnd: video.redEnd,
                            // Restore persisted lock state
                            isStartLocked: video.isStartLocked,
                            isEndLocked: video.isEndLocked,
                            step9Note: video.step9Note,
                            editingDebugInfo: video.editingDebugInfo,
                            }}
                            previousVideo={videoIndex > 0 ? {
                              videoName: approvedVideos[videoIndex - 1].videoName,
                              videoUrl: approvedVideos[videoIndex - 1].videoUrl!,
                              cutPoints: approvedVideos[videoIndex - 1].cutPoints || { startKeep: 0, endKeep: 10000 },
                            } : null}
                            nextVideo={videoIndex < approvedVideos.length - 1 ? {
                              videoName: approvedVideos[videoIndex + 1].videoName,
                              videoUrl: approvedVideos[videoIndex + 1].videoUrl!,
                              cutPoints: approvedVideos[videoIndex + 1].cutPoints || { startKeep: 0, endKeep: 10000 },
                            } : null}
                            onCutAndMerge={async (previousVideo, currentVideo, nextVideo) => {
                              // Collect all videos to merge (previous + current + next)
                              const videosToMerge = [
                                previousVideo,
                                currentVideo,
                                nextVideo
                              ].filter(Boolean); // Remove null values
                              
                              console.log('[Cut & Merge] Starting merge:', videosToMerge.map(v => v.videoName).join(' + '));
                              
                              setIsMergeModalOpen(true);
                              
                              // Smart cache: check if markers were modified
                              // Skip if any video has no cutPoints
                              const hasInvalidCutPoints = videosToMerge.some(v => !v.cutPoints);
                              if (hasInvalidCutPoints) {
                                toast.error('❌ Cannot merge videos without cut points');
                                return;
                              }
                              
                              // Create hash from all videos
                              const currentHash = JSON.stringify(
                                videosToMerge.map(v => ({
                                  name: v.videoName,
                                  start: Math.round(v.cutPoints.startKeep),
                                  end: Math.round(v.cutPoints.endKeep),
                                }))
                              );
                              
                              console.log('[Cut & Merge] Cache check:');
                              console.log('[Cut & Merge]   Initial hash:', initialPairHash);
                              console.log('[Cut & Merge]   Current hash:', currentHash);
                              console.log('[Cut & Merge]   Last merged hash:', lastMergedPairHash);
                              console.log('[Cut & Merge]   Has cached video:', !!mergedVideoUrl);
                              
                              // Check if we have a cached video with the same hash
                              if (currentHash === lastMergedPairHash && mergedVideoUrl) {
                                console.log('[Cut & Merge] ✅ Cache hit! Using cached video.');
                                setMergeProgress('');
                                return;
                              }
                              
                              // Check if this is first click (no initial hash set)
                              const isFirstClick = !initialPairHash;
                              
                              if (isFirstClick) {
                                // First click: set initial hash and proceed with merge
                                setInitialPairHash(currentHash);
                                console.log('[Cut & Merge] 🆕 First click - Initial pair hash set:', currentHash);
                              } else {
                                // Subsequent clicks: check if markers were modified
                                const markersModified = currentHash !== initialPairHash;
                                if (markersModified) {
                                  console.log('[Cut & Merge] ⚠️ Markers were modified, retransmitting to FFmpeg...');
                                  // Update initial hash to current for next comparison
                                  setInitialPairHash(currentHash);
                                } else {
                                  console.log('[Cut & Merge] 🔁 Re-merge with same markers (cache miss).');
                                }
                              }
                              
                              // Clear old video before starting new merge
                              setMergedVideoUrl(null);
                              setMergeProgress('Uploading videos to FFmpeg API...');
                              
                              try{
                                // Extract original URLs from proxy URLs
                                const extractOriginalUrl = (proxyUrl: string) => {
                                  if (proxyUrl.startsWith('/api/proxy-video?url=')) {
                                    const urlParam = new URLSearchParams(proxyUrl.split('?')[1]).get('url');
                                    return urlParam ? decodeURIComponent(urlParam) : proxyUrl;
                                  }
                                  return proxyUrl;
                                };
                                
                                // Prepare all videos for merge
                                const videos = videosToMerge.map(v => ({
                                  url: extractOriginalUrl(v.videoUrl),
                                  name: v.videoName,
                                  startMs: v.cutPoints.startKeep,
                                  endMs: v.cutPoints.endKeep,
                                }));
                                
                                console.log('[Cut & Merge] Merging', videos.length, 'videos:', videos.map(v => v.name).join(' + '));
                                
                                const result = await cutAndMergeAllMutation.mutateAsync({
                                  videos,
                                  ffmpegApiKey: localCurrentUser.ffmpegApiKey || '',
                                });
                                
                                if (result.success && result.downloadUrl) {
                                  setMergedVideoUrl(result.downloadUrl);
                                  setLastMergedPairHash(currentHash);
                                  setMergeProgress('Merge complete!');
                                } else {
                                  throw new Error('Merge failed');
                                }
                              } catch (error: any) {
                                console.error('[Cut & Merge] Error:', error);
                                toast.error(`Merge failed: ${error.message}`);
                                setIsMergeModalOpen(false);
                              }
                            }}
                            onReprocess={async (videoName) => {
                              console.log('[Reprocesare] Starting re-processing for:', videoName);
                              
                              // Find the video to re-process
                              const videoToReprocess = videoResults.find(v => v.videoName === videoName);
                              if (!videoToReprocess) {
                                toast.error('Video not found!');
                                return;
                              }
                              
                              // Log BEFORE reprocesare
                              console.log('[Reprocesare] BEFORE - cutPoints:', {
                                startKeep: videoToReprocess.cutPoints?.startKeep,
                                endKeep: videoToReprocess.cutPoints?.endKeep,
                                redPosition: videoToReprocess.cutPoints?.redPosition,
                                confidence: videoToReprocess.cutPoints?.confidence
                              });
                              
                              // Reset progress and open modal
                              setProcessingProgress({ 
                                ffmpeg: { current: 0, total: 1 },
                                whisper: { current: 0, total: 1 },
                                cleanvoice: { current: 0, total: 1 },
                                currentVideoName: videoName 
                              });
                              setProcessingStep(null);
                              setShowProcessingModal(true);
                              
                              try {
                                // Call batch processing with single video
                                // batchProcessVideosWithWhisper already updates videoResults internally
                                const resultsMap = await batchProcessVideosWithWhisper([videoToReprocess]);
                                
                                // Check if processing was successful
                                const result = resultsMap.get(videoName);
                                if (result) {
                                  // Log AFTER reprocesare (from backend)
                                  console.log('[Reprocesare] AFTER (from backend) - cutPoints:', {
                                    startKeep: result.cutPoints?.startKeep,
                                    endKeep: result.cutPoints?.endKeep,
                                    redPosition: result.cutPoints?.redPosition,
                                    confidence: result.cutPoints?.confidence
                                  });
                                  
                                  // Log AFTER state update
                                  setTimeout(() => {
                                    const updatedVideo = videoResults.find(v => v.videoName === videoName);
                                    console.log('[Reprocesare] AFTER (in state) - cutPoints:', {
                                      startKeep: updatedVideo?.cutPoints?.startKeep,
                                      endKeep: updatedVideo?.cutPoints?.endKeep,
                                      redPosition: updatedVideo?.cutPoints?.redPosition,
                                      confidence: updatedVideo?.cutPoints?.confidence
                                    });
                                  }, 100);
                                  
                                  toast.success(`✅ ${videoName} reprocesed successfully!`);
                                } else {
                                  toast.error(`❌ Failed to reprocess ${videoName}`);
                                }
                              } catch (error: any) {
                                console.error('[Reprocesare] Error:', error);
                                toast.error(`Error: ${error.message}`);
                              } finally {
                                setShowProcessingModal(false);
                              }
                            }}
                            onTrimChange={(videoId, cutPoints, isStartLocked, isEndLocked) => {
                            // Update local state when user adjusts trim markers or lock state
                            // videoId is actually videoName (unique identifier)
                            console.log('[DEBUG onTrimChange] 🔵 CALLED', {
                              videoId,
                              cutPoints: {
                                startKeep: cutPoints.startKeep,
                                endKeep: cutPoints.endKeep
                              },
                              isStartLocked,
                              isEndLocked,
                              matchingVideo: videoResults.find(v => v.videoName === videoId)?.videoName
                            });
                            
                            // Use functional update to get the LATEST state and prevent race conditions
                            setVideoResults(prev => {
                              const updatedVideoResults = prev.map(v =>
                                v.videoName === videoId
                                  ? { 
                                      ...v, 
                                      cutPoints,
                                      isStartLocked: isStartLocked,
                                      isEndLocked: isEndLocked,
                                    }
                                  : v
                              );
                              
                              // Immediate save to database using the UPDATED state
                              // This ensures we save the correct values even when changing markers rapidly
                              if (selectedCoreBeliefId && selectedEmotionalAngleId && selectedAdId && selectedCharacterId) {
                                const thisVideoCutPoints = updatedVideoResults.find(v => v.videoName === videoId)?.cutPoints;
                                console.log('[VideoEditorV2] 🟢 SAVING TO DB', {
                                  videoId,
                                  cutPoints_param: `start=${cutPoints.startKeep} end=${cutPoints.endKeep}`,
                                  cutPoints_inUpdatedArray: `start=${thisVideoCutPoints?.startKeep} end=${thisVideoCutPoints?.endKeep}`,
                                  isStartLocked,
                                  isEndLocked,
                                  updatedVideoResults_length: updatedVideoResults.length
                                });
                                
                                upsertContextSessionMutation.mutate({
                                  userId: currentUser.id,
                                  coreBeliefId: selectedCoreBeliefId,
                                  emotionalAngleId: selectedEmotionalAngleId,
                                  adId: selectedAdId,
                                  characterId: selectedCharacterId,
                                  currentStep,
                                  rawTextAd,
                                  processedTextAd,
                                  adLines,
                                  prompts,
                                  images,
                                  combinations,
                                  deletedCombinations,
                                  videoResults: updatedVideoResults,
                                  reviewHistory,
                                }, {
                                  onSuccess: () => {
                                    console.log('[VideoEditorV2] ✅ DB SAVE SUCCESS', {
                                      videoId,
                                      savedCutPoints: updatedVideoResults.find(v => v.videoName === videoId)?.cutPoints
                                    });
                                  },
                                  onError: (error) => {
                                    console.error('[VideoEditorV2] ❌ DB SAVE FAILED', {
                                      videoId,
                                      error: error.message
                                    });
                                  },
                                });
                              }
                              
                              return updatedVideoResults;
                            });
                          }}
                          />
                        </div>
                      );
                    })}

                    {/* Navigation Buttons */}
                    <div className="flex flex-col gap-3">
                      <div className="flex justify-between items-center">
                        <Button
                          onClick={() => setCurrentStep(7)}
                          variant="outline"
                          className="px-6 py-3"
                        >
                          <ChevronLeft className="w-4 h-4 mr-2" />
                          Back
                        </Button>

                        {/* Center buttons group */}
                        <div className="flex flex-row items-center gap-2 flex-nowrap">
                          {/* Sample Merge Video button */}
                          {videoResults.filter(v => v.reviewStatus === 'accepted' && v.status === 'success' && v.trimmedVideoUrl).length > 1 && (
                            <div className="flex flex-col items-end gap-1">
                            <Button
                              onClick={() => handleSampleMerge(approvedVideos)}
                              className="bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap"
                              size="sm"
                              >
                                🎬 Sample Merge ALL Videos
                              </Button>
                              {/* Open Last Sample link */}
                              {lastSampleVideoUrl && (
                              <button
                                onClick={() => {
                                  // Reopen modal with last sample video
                                  const videoList = approvedVideos.map(v => ({
                                    name: v.videoName,
                                    note: v.step9Note || ''
                                  }));
                                  setSampleMergeVideos(videoList);
                                  setSampleMergedVideoUrl(lastSampleVideoUrl);
                                  setIsSampleMergeModalOpen(true);
                                  setSampleMergeProgress('');
                                }}
                                className="text-blue-600 hover:text-blue-800 underline text-sm"
                              >
                                Open Last Sample
                              </button>
                            )}
                            </div>
                          )}
                        </div>

                        {/* Action buttons - stacked vertically */}
                        <div className="flex flex-col gap-4 items-center mt-4">
                          {/* Open Last Sample link (above button) */}
                          {lastSampleVideoUrl && (
                            <button
                              onClick={() => {
                                // Reconstruct video list from localStorage
                                const videoList = videoResults
                                  .filter(v => v.reviewStatus === 'accepted' && v.status === 'success')
                                  .map(v => ({
                                    name: v.videoName,
                                    note: v.step9Note || ''
                                  }));
                                setSampleMergeVideos(videoList);
                                setSampleMergedVideoUrl(lastSampleVideoUrl);
                                setIsSampleMergeModalOpen(true);
                                setSampleMergeProgress('');
                              }}
                              className="text-blue-600 hover:text-blue-800 underline text-sm"
                            >
                              🔗 Open Last Sample
                            </button>
                          )}
                          
                          {/* Buton STEP 1: SIMPLE CUT - doar cutting fără merge */}
                          <Button
                            onClick={() => {
                              // Open trimming modal
                              setIsTrimmingModalOpen(true);
                              // Start simple cut process (no merge)
                              handleSimpleCut();
                            }}
                            className="bg-blue-600 hover:bg-blue-700 px-8 py-8 text-lg w-full max-w-md"
                          >
                            {(() => {
                              const count = videoResults.filter(v => v.reviewStatus === 'accepted' && v.status === 'success' && v.videoUrl).length;
                              return (
                                <>
                                  STEP 1: Simple Cut ({count})
                                  <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" />
                                  </svg>
                                </>
                              );
                            })()}
                          </Button>
                          <div className="text-center -mt-4">
                            <span className="text-xs text-blue-600">CUT ONLY - NO MERGE</span>
                          </div>

                          {/* Buton TRIM ALL VIDEOS - va trimite la FFmpeg API pentru cutting */}
                          <Button
                            onClick={() => {
                              // Open trimming modal
                              setIsTrimmingModalOpen(true);
                              // Start trimming process - ALWAYS reprocess ALL videos (ignore recutStatus)
                              handleTrimAllVideos();
                            }}
                            className="bg-red-600 hover:bg-red-700 px-8 py-8 text-lg w-full max-w-md"
                          >
                            {(() => {
                              // Always count ALL accepted videos, ignore recutStatus
                              const count = videoResults.filter(v => v.reviewStatus === 'accepted' && v.status === 'success' && v.videoUrl).length;
                              return (
                                <>
                                  Next: Trim All Videos ({count})
                                  <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                  </svg>
                                </>
                              );
                            })()}
                          </Button>
                          <div className="text-center -mt-4">
                            <span className="text-xs text-red-600">GO TO STEP 9</span>
                          </div>

                          {/* STEP 2: Prepare for Merge button - only show if we have trimmed videos */}
                          {videoResults.some(v => v.trimmedVideoUrl) && (
                            <>
                            <Button
                              onClick={() => {
                                setIsMergingStep10(true);
                                handlePrepareForMerge();
                              }}
                              className="bg-purple-600 hover:bg-purple-700 px-8 py-8 text-lg w-full max-w-md"
                            >
                              {(() => {
                                const trimmedCount = videoResults.filter(v => v.trimmedVideoUrl).length;
                                return (
                                  <>
                                    STEP 2: Prepare for Merge ({trimmedCount})
                                    <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                    </svg>
                                  </>
                                );
                              })()}
                            </Button>
                            <div className="text-center -mt-4">
                              <span className="text-xs text-purple-600">MERGE HOOKS & BODY</span>
                            </div>
                            </>
                          )}

                          {/* Check Videos button - only show if we have trimmed videos */}
                          {videoResults.some(v => v.trimmedVideoUrl) && (
                            <>
                            <Button
                              onClick={() => setCurrentStep(9)}
                              className="bg-green-600 hover:bg-green-700 px-8 py-8 text-lg w-full max-w-md"
                            >
                              {(() => {
                                const count = approvedVideos.filter(v => v.trimmedVideoUrl).length;
                                return (
                                  <>
                                    Next: Check Videos ({count})
                                    <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                  </>
                                );
                              })()}
                            </Button>
                            <div className="text-center -mt-4">
                              <span className="text-xs text-green-600">GO TO STEP 9</span>
                            </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })()}

        {/* STEP 9: Final Trimmed Videos */}
        {currentStep === 9 && (() => {
          let trimmedVideos = videoResults.filter(v => 
            v.reviewStatus === 'accepted' && 
            v.trimmedVideoUrl
          );
          
          // Apply filter
          if (step9Filter === 'accepted') {
            trimmedVideos = trimmedVideos.filter(v => v.recutStatus === 'accepted');
          } else if (step9Filter === 'recut') {
            trimmedVideos = trimmedVideos.filter(v => v.recutStatus === 'recut');
          }
          
          return (
            <Card className="mb-8 border-2 border-blue-200">
              <CardHeader className="bg-blue-50">
                <CardTitle className="flex items-center gap-2 text-blue-900">
                  <Video className="w-5 h-5" />
                  Cut Videos
                </CardTitle>
                <CardDescription>
                  Videoclipurile tăiate și gata pentru download.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                {trimmedVideos.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-600">Nu există videouri trimmed încă.</p>
                    <Button
                      onClick={() => setCurrentStep(8)}
                      className="mt-4"
                    >
                      Înapoi la Step 8
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Filter and Sample Merge button */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-blue-900">Filtrează videouri:</label>
                        <select
                          value={step9Filter || 'all'}
                          onChange={(e) => setStep9Filter(e.target.value as 'all' | 'accepted' | 'recut')}
                          className="px-4 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="all">Toate ({trimmedVideos.length})</option>
                          <option value="accepted">Acceptate ({trimmedVideos.filter(v => v.recutStatus === 'accepted').length})</option>
                          <option value="recut">Necesită Retăiere ({trimmedVideos.filter(v => v.recutStatus === 'recut').length})</option>
                        </select>
                      </div>
                      

                      
                      {/* UNDO Button */}
                      {recutHistory.length > 0 && (
                        <Button
                          onClick={() => {
                            const lastAction = recutHistory[recutHistory.length - 1];
                            // Restore previous status
                            setVideoResults(prev => prev.map(v =>
                              v.videoName === lastAction.videoName
                                ? { ...v, recutStatus: lastAction.previousStatus }
                                : v
                            ));
                            // Remove from history
                            setRecutHistory(prev => prev.slice(0, -1));
                            toast.success(`Acțiune anulată pentru ${lastAction.videoName}`);
                          }}
                          variant="outline"
                          className="border-orange-500 text-orange-700 hover:bg-orange-50"
                        >
                          <Undo2 className="w-4 h-4 mr-2" />
                          UNDO ({recutHistory.length} acțiuni)
                        </Button>
                      )}
                    </div>
                    
                    {/* Grid de videoclipuri */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {trimmedVideos.map((video) => (
                        <div key={video.id} className="border-2 border-blue-200 rounded-lg p-4 bg-white">
                          {/* Video Name */}
                          <h3 className="text-sm font-bold text-gray-900 mb-2 text-center">
                            {video.videoName}
                          </h3>
                          
                          {/* Video Player with milliseconds display */}
                          <div className="relative bg-black rounded-lg overflow-hidden mb-3" style={{ aspectRatio: '9/16' }}>
                            <video
                              src={video.trimmedVideoUrl}
                              className="absolute top-0 left-0 w-full h-full object-contain"
                              controls
                              playsInline
                            />
                          </div>
                          
                          {/* Video Text (white text only) */}
                          {video.text && (
                            <p className="text-xs text-gray-700 mb-3 text-center">
                              {(() => {
                                const text = video.text || '';
                                // Remove red text using redStart and redEnd from database
                                if (video.redStart !== undefined && video.redEnd !== undefined) {
                                  const beforeRed = text.substring(0, video.redStart);
                                  const afterRed = text.substring(video.redEnd);
                                  return (beforeRed + afterRed).trim();
                                }
                                return text.trim();
                              })()}
                            </p>
                          )}
                          
                          {/* Trim Info Display */}
                          {video.cutPoints && (
                            <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
                              <p className="text-gray-700">
                                <strong>Trimmed:</strong> {(video.cutPoints.startKeep / 1000).toFixed(1)}s → {(video.cutPoints.endKeep / 1000).toFixed(1)}s 
                                ({((video.cutPoints.endKeep - video.cutPoints.startKeep) / 1000).toFixed(1)}s total)
                              </p>
                            </div>
                          )}
                          
                          {/* Step 9 Note Display */}
                          {video.step9Note && (
                            <div className="mb-3 p-2 bg-yellow-50 border border-yellow-300 rounded text-xs">
                              <p className="text-gray-700"><strong>Note:</strong> {video.step9Note}</p>
                            </div>
                          )}
                          
                          {/* Accept/Recut Buttons - same design as Step 7 */}
                          <div className="space-y-2 mb-3">
                            {!video.recutStatus ? (
                              <div className="flex gap-2">
                                <Button
                                  onClick={() => {
                                    setVideoResults(prev => prev.map(v =>
                                      v.videoName === video.videoName
                                        ? { ...v, recutStatus: 'accepted' }
                                        : v
                                    ));
                                    toast.success(`✅ ${video.videoName} acceptat!`);
                                  }}
                                  size="sm"
                                  className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs py-1"
                                >
                                  <Check className="w-3 h-3 mr-1" />
                                  Accept
                                </Button>
                                
                                <Button
                                  onClick={() => {
                                    setVideoResults(prev => prev.map(v =>
                                      v.videoName === video.videoName
                                        ? { ...v, recutStatus: 'recut' }
                                        : v
                                    ));
                                    toast.info(`✂️ ${video.videoName} marcat pentru retăiere!`);
                                  }}
                                  size="sm"
                                  className="flex-1 bg-red-600 hover:bg-red-700 text-white text-xs py-1"
                                >
                                  <RefreshCw className="w-3 h-3 mr-1" />
                                  Recut
                                </Button>
                              </div>
                            ) : (
                              <div className="flex gap-2 items-center">
                                {/* Status badge after decision */}
                                <div className={`flex-1 px-3 py-2 rounded text-xs font-medium text-center ${
                                  video.recutStatus === 'accepted' 
                                    ? 'bg-green-100 text-green-700 border border-green-300'
                                    : 'bg-red-100 text-red-700 border border-red-300'
                                }`}>
                                  {video.recutStatus === 'accepted' ? (
                                    <><Check className="w-3 h-3 inline mr-1" />Acceptat</>
                                  ) : (
                                    <><RefreshCw className="w-3 h-3 inline mr-1" />Recut</>
                                  )}
                                </div>
                                
                                {/* UNDO button */}
                                <Button
                                  onClick={() => {
                                    setVideoResults(prev => prev.map(v =>
                                      v.videoName === video.videoName
                                        ? { ...v, recutStatus: null }
                                        : v
                                    ));
                                    toast.info('Decizie anulată');
                                  }}
                                  size="sm"
                                  variant="outline"
                                  className="border-gray-400 text-gray-700 hover:bg-gray-100 text-xs py-1"
                                >
                                  <Undo2 className="w-3 h-3 mr-1" />
                                  Undo
                                </Button>
                              </div>
                            )}
                          </div>
                          
                          {/* Add Note Button (doar pentru Recut) */}
                          {video.recutStatus === 'recut' && (
                            <div className="mb-3">
                              {editingStep9NoteVideoName === video.videoName ? (
                                <div className="bg-yellow-50 border-2 border-yellow-400 rounded p-3 space-y-2">
                                  <textarea
                                    value={step9NoteText}
                                    onChange={(e) => setStep9NoteText(e.target.value)}
                                    placeholder="Add internal note..."
                                    className="w-full p-2 border border-yellow-300 rounded text-xs bg-white"
                                    rows={3}
                                  />
                                  <div className="flex gap-2">
                                    <Button
                                      onClick={() => {
                                        // Save note to state
                                        const updatedVideoResults = videoResults.map(v =>
                                          v.videoName === video.videoName
                                            ? { ...v, step9Note: step9NoteText }
                                            : v
                                        );
                                        setVideoResults(updatedVideoResults);
                                        
                                        // Save to database immediately
                                        if (selectedCoreBeliefId && selectedEmotionalAngleId && selectedAdId && selectedCharacterId) {
                                          upsertContextSessionMutation.mutate({
                                            userId: currentUser.id,
                                            coreBeliefId: selectedCoreBeliefId,
                                            emotionalAngleId: selectedEmotionalAngleId,
                                            adId: selectedAdId,
                                            characterId: selectedCharacterId,
                                            currentStep,
                                            rawTextAd,
                                            processedTextAd,
                                            adLines,
                                            prompts,
                                            images,
                                            combinations,
                                            deletedCombinations,
                                            videoResults: updatedVideoResults,
                                            reviewHistory,
                                          }, {
                                            onSuccess: () => {
                                              console.log('[Step9] Note saved to DB');
                                              toast.success(`Note saved for ${video.videoName}`);
                                            },
                                          });
                                        }
                                        
                                        setEditingStep9NoteVideoName(null);
                                        setStep9NoteText('');
                                      }}
                                      size="sm"
                                      className="flex-1 bg-green-600 hover:bg-green-700 text-xs py-1"
                                    >
                                      Save
                                    </Button>
                                    <Button
                                      onClick={() => {
                                        setEditingStep9NoteVideoName(null);
                                        setStep9NoteText('');
                                      }}
                                      size="sm"
                                      variant="outline"
                                      className="flex-1 text-xs py-1"
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <Button
                                  onClick={() => {
                                    setEditingStep9NoteVideoName(video.videoName);
                                    setStep9NoteText(video.step9Note || '');
                                  }}
                                  size="sm"
                                  className="w-full bg-yellow-500 hover:bg-yellow-600 text-white text-xs py-1"
                                >
                                  {video.step9Note ? '📝 Edit Note' : '📝 Add Note'}
                                </Button>
                              )}
                            </div>
                          )}
                          
                          {/* Download Link */}
                          <button
                            onClick={async () => {
                              try {
                                // Fetch video as blob to force download
                                const response = await fetch(video.trimmedVideoUrl!);
                                const blob = await response.blob();
                                const url = URL.createObjectURL(blob);
                                
                                const link = document.createElement('a');
                                link.href = url;
                                link.download = `${video.videoName}.mp4`;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                                
                                // Clean up blob URL
                                setTimeout(() => URL.revokeObjectURL(url), 100);
                                
                                toast.success(`Downloading ${video.videoName}...`);
                              } catch (error: any) {
                                toast.error(`Download failed: ${error.message}`);
                              }
                            }}
                            className="text-sm text-blue-600 hover:text-blue-700 underline flex items-center justify-center gap-1"
                          >
                            <Download className="w-3 h-3" />
                            Download
                          </button>
                        </div>
                      ))}
                    </div>
                    
                    {/* Navigation Buttons */}
                    <div className="flex justify-between items-center mt-6">
                      <Button
                        onClick={() => setCurrentStep(8)}
                        variant="outline"
                        className="px-8 py-6 text-base"
                      >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Back
                      </Button>
                      
                      <div className="flex flex-col items-center gap-0">
                      <Button
                        onClick={() => {
                          setIsMergingStep10(true);
                          handlePrepareForMerge();
                        }}
                        className="bg-purple-600 hover:bg-purple-700 px-8 py-8 text-base"
                        disabled={isMergingStep10}
                      >
                        {isMergingStep10 ? (
                          <>
                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                            {mergeStep10Progress.message || 'Merging...'}
                          </>
                        ) : (
                          <>
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                            </svg>
                            Next: Prepare for Merge ({videoResults.filter(v => v.reviewStatus === 'accepted' && v.status === 'success' && v.trimmedVideoUrl).length})
                            <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </>
                        )}
                      </Button>
                      {!isMergingStep10 && (
                        <div className="text-center mt-0">
                          <span className="text-xs text-purple-600">GO TO STEP 10</span>
                        </div>
                      )}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })()}

        {/* STEP 10: Merge Videos */}
        {currentStep === 10 && (
          <Card className="mb-8 border-2 border-indigo-200">
            <CardHeader className="bg-indigo-50">
              <CardTitle className="flex items-center gap-2 text-indigo-900">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                STEP 10 - Merge Videos
              </CardTitle>
              <CardDescription>
                Select hooks and body video to create final merged video
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-8">
                {/* STEP 1 - Choose Hooks */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-indigo-900">STEP 1 - Choose Hooks</h3>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const hookVideos = videoResults.filter(v => 
                            v.trimmedVideoUrl && 
                            v.videoName.toLowerCase().includes('hook')
                          );
                          setSelectedHooks(hookVideos.map(v => v.videoName));
                        }}
                      >
                        Select All
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedHooks([])}
                      >
                        Deselect All
                      </Button>
                    </div>
                  </div>
                  
                  {(() => {
                    let hookVideos = videoResults.filter(v => 
                      v.trimmedVideoUrl && 
                      v.videoName.toLowerCase().includes('hook')
                    );
                                        // Filter out ALL individual variations - show ONLY merged hooks
                    const displayHooks = hookVideos.filter(v => {
                      // Check if this video has variations (A, B, C, D suffix)
                      const hasVariation = /HOOK\d+[A-Z]_/.test(v.videoName);
                      if (hasVariation) {
                        // Always hide individual variations
                        return false;
                      }
                      
                      // Check if this is a base hook (no variation suffix)
                      const isBaseHook = /HOOK\d+_/.test(v.videoName) && !/HOOK\d+[A-Z]_/.test(v.videoName);
                      if (isBaseHook) {
                        // Extract base name pattern: T1_C1_E1_AD1_HOOK3_TEST_ALINA_1 → T1_C1_E1_AD1_HOOK3_TEST_ALINA_1
                        // Check if merged version exists in hookMergedVideos
                        const hookMatch = v.videoName.match(/(.*)(HOOK\d+)(.*)/); 
                        if (hookMatch) {
                          const prefix = hookMatch[1]; // T1_C1_E1_AD1_
                          const hookBase = hookMatch[2]; // HOOK3
                          const suffix = hookMatch[3]; // _TEST_ALINA_1
                          const baseName = `${prefix}${hookBase}${suffix}`; // Full base name
                          // Hide base if merged exists
                          return !hookMergedVideos[baseName];
                        }
                      }
                      
                      return true;
                    });
                    
                    // Add merged hooks to display
                    const mergedHooksList = Object.entries(hookMergedVideos).map(([baseName, cdnUrl]) => {
                      // Find all variations for this base hook
                      // baseName format: T1_C1_E1_AD1_HOOK3_TEST_ALINA_1
                      // Variations: T1_C1_E1_AD1_HOOK3A_TEST_ALINA_1, T1_C1_E1_AD1_HOOK3B_TEST_ALINA_1
                      const hookMatch = baseName.match(/(.*)(HOOK\d+)(.*)/); 
                      if (!hookMatch) return { videoName: baseName.replace(/(HOOK\d+)/, '$1M'), trimmedVideoUrl: cdnUrl, text: '' };
                      
                      const prefix = hookMatch[1]; // T1_C1_E1_AD1_
                      const hookBase = hookMatch[2]; // HOOK3
                      const suffix = hookMatch[3]; // _TEST_ALINA_1
                      
                      const variations = hookVideos.filter(v => {
                        // Match: T1_C1_E1_AD1_HOOK3A_TEST_ALINA_1 should match T1_C1_E1_AD1_HOOK3_TEST_ALINA_1
                        const vMatch = v.videoName.match(/(.*)(HOOK\d+)([A-Z])?(.*)/); 
                        if (!vMatch) return false;
                        return vMatch[1] === prefix && vMatch[2] === hookBase && vMatch[4] === suffix;
                      });
                      
                      // Concatenate white texts ONLY (extract using redStart/redEnd from database)
                      const mergedText = variations.map(v => {
                        const text = v.text || '';
                        // Extract white text using database redStart/redEnd positions
                        if (v.redStart !== undefined && v.redEnd !== undefined && v.redStart >= 0 && v.redEnd > v.redStart) {
                          // Remove red text portion
                          const beforeRed = text.substring(0, v.redStart);
                          const afterRed = text.substring(v.redEnd);
                          return (beforeRed + afterRed).trim();
                        }
                        // No red text, return full text
                        return text.trim();
                      }).filter(t => t).join(' ');
                      
                      return {
                        videoName: baseName.replace(/(HOOK\d+)/, '$1M'),
                        trimmedVideoUrl: cdnUrl,
                        text: mergedText,
                      };
                    });
                    
                    const allHooks = [...displayHooks, ...mergedHooksList];
                    
                    if (allHooks.length === 0) {
                      return (
                        <p className="text-gray-600 text-sm">No hook videos available</p>
                      );
                    }
                    
                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {allHooks.map(video => {
                          const isSelected = selectedHooks.includes(video.videoName);
                          return (
                            <div 
                              key={video.videoName} 
                              onClick={() => {
                                if (isSelected) {
                                  setSelectedHooks(selectedHooks.filter(h => h !== video.videoName));
                                } else {
                                  setSelectedHooks([...selectedHooks, video.videoName]);
                                }
                              }}
                              className={`cursor-pointer p-4 rounded-lg transition-all ${
                                isSelected 
                                  ? 'border-4 border-blue-500 bg-blue-50 shadow-lg' 
                                  : 'border-2 border-gray-300 bg-white hover:border-gray-400 shadow-sm hover:shadow-md'
                              }`}
                            >
                              <div className="space-y-3">
                              {/* Selection Indicator */}
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-semibold text-gray-900 text-center flex-1">
                                  {video.videoName}
                                </p>
                                  <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                                    isSelected ? 'bg-blue-500' : 'bg-gray-300'
                                  }`}>
                                    {isSelected && (
                                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                      </svg>
                                    )}
                                  </div>
                                </div>
                                
                                {/* Video Player */}
                                <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '9/16' }}>
                                  <video
                                    src={video.trimmedVideoUrl}
                                    className="absolute top-0 left-0 w-full h-full object-contain"
                                    controls
                                    playsInline
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </div>
                                
                              {/* Video Text (white text only) */}
                              <p className="text-xs text-gray-600 text-center">
                                  {(() => {
                                    const text = video.text || '';
                                    // Extract white text using database redStart/redEnd positions
                                    // For merged videos, text is already concatenated white text
                                    // For individual videos, extract white text by removing red portion
                                    if (video.videoName.includes('M_TEST')) {
                                      // Merged video - text is already white only
                                      return text.trim();
                                    }
                                    // Individual video - extract white text
                                    const videoData = videoResults.find(v => v.videoName === video.videoName);
                                    if (videoData && videoData.redStart !== undefined && videoData.redEnd !== undefined && 
                                        videoData.redStart >= 0 && videoData.redEnd > videoData.redStart) {
                                      const beforeRed = text.substring(0, videoData.redStart);
                                      const afterRed = text.substring(videoData.redEnd);
                                      return (beforeRed + afterRed).trim();
                                    }
                                    // No red text, return full text
                                    return text.trim();
                                  })()}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
                
                {/* STEP 2 - Choose Body */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-indigo-900">STEP 2 - Choose Body</h3>
                  
                  {(() => {
                    // Check if we have merged body video
                    if (bodyMergedVideoUrl) {
                      const isSelected = selectedBody === 'body_merged';
                      
                      // Extract body video name from first body video in videoResults
                      const firstBodyVideo = videoResults.find(v => 
                        v.trimmedVideoUrl && 
                        !v.videoName.toLowerCase().includes('hook')
                      );
                      
                      // Construct merged body name
                      let mergedBodyName = 'Body (Merged)';
                      if (firstBodyVideo) {
                        // Extract context from video name (e.g., T1_C1_E1_AD1)
                        const contextMatch = firstBodyVideo.videoName.match(/^(T\d+_C\d+_E\d+_AD\d+)/);
                        const context = contextMatch ? contextMatch[1] : '';
                        
                        // Extract character and imageName from video name
                        // Format: T1_C1_E1_AD1_MIRROR_TEST_ALINA_1
                        // Extract: TEST (character) and ALINA_1 (imageName)
                        const nameMatch = firstBodyVideo.videoName.match(/_([A-Z]+)_([A-Z]+_\d+)$/);
                        const character = nameMatch ? nameMatch[1] : 'TEST';
                        const imageName = nameMatch ? nameMatch[2] : '';
                        
                        // Construct full merged body name
                        mergedBodyName = imageName 
                          ? `${context}_BODY_${character}_${imageName}`
                          : `${context}_BODY_${character}`;
                      }
                      
                      return (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          <div 
                            onClick={() => setSelectedBody(isSelected ? null : 'body_merged')}
                            className={`cursor-pointer p-4 rounded-lg transition-all ${
                              isSelected 
                                ? 'border-4 border-green-500 bg-green-50 shadow-lg' 
                                : 'border-2 border-gray-300 bg-white hover:border-gray-400 shadow-sm hover:shadow-md'
                            }`}
                          >
                            <div className="space-y-3">
                              {/* Selection Indicator */}
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-semibold text-gray-900 text-center flex-1">
                                  {mergedBodyName}
                                </p>
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                                  isSelected ? 'bg-green-500' : 'bg-gray-300'
                                }`}>
                                  {isSelected && (
                                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                  )}
                                </div>
                              </div>
                              
                              {/* Video Player */}
                              <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '9/16' }}>
                                <video
                                  src={bodyMergedVideoUrl}
                                  className="absolute top-0 left-0 w-full h-full object-contain"
                                  controls
                                  playsInline
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                              
                              {/* Info */}
                              <p className="text-xs text-gray-600 text-center">
                                All body videos merged
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    
                    // Fallback: Show first body video
                    const bodyVideos = videoResults.filter(v => 
                      v.trimmedVideoUrl && 
                      !v.videoName.toLowerCase().includes('hook')
                    );
                    
                    if (bodyVideos.length === 0) {
                      return (
                        <p className="text-gray-600 text-sm">No body videos available. Click "Next: Merge Videos" in Step 9 first.</p>
                      );
                    }
                    
                    const bodyVideo = bodyVideos[0];
                    const isSelected = selectedBody === bodyVideo.videoName;
                    
                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div 
                          onClick={() => setSelectedBody(isSelected ? null : bodyVideo.videoName)}
                          className={`cursor-pointer p-4 rounded-lg transition-all ${
                            isSelected 
                              ? 'border-4 border-green-500 bg-green-50 shadow-lg' 
                              : 'border-2 border-gray-300 bg-white hover:border-gray-400 shadow-sm hover:shadow-md'
                          }`}
                        >
                          <div className="space-y-3">
                            {/* Selection Indicator */}
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-semibold text-gray-900 text-center flex-1">
                                {bodyVideo.videoName}
                              </p>
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                                isSelected ? 'bg-green-500' : 'bg-gray-300'
                              }`}>
                                {isSelected && (
                                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                )}
                              </div>
                            </div>
                            
                            {/* Video Player */}
                            <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '9/16' }}>
                              <video
                                src={bodyVideo.trimmedVideoUrl}
                                className="absolute top-0 left-0 w-full h-full object-contain"
                                controls
                                playsInline
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>
                            
                            {/* Video Text */}
                            <p className="text-xs text-gray-600 text-center">
                              {bodyVideo.text}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
                
                {/* Final Videos (combinations) Preview */}
                <div className="space-y-4 mt-8">
                  <h3 className="text-lg font-semibold text-indigo-900">Final Videos (combinations)</h3>
                  
                  {(() => {
                    // Calculate combinations based on selected hooks and body
                    const combinations: string[] = [];
                    
                    if (selectedHooks.length > 0 && selectedBody) {
                      // Extract context and character from body or first hook
                      const referenceVideo = selectedBody === 'body_merged' 
                        ? videoResults.find(v => !v.videoName.toLowerCase().includes('hook'))
                        : videoResults.find(v => v.videoName === selectedBody);
                      
                      if (!referenceVideo && selectedHooks.length > 0) {
                        // Fallback to first hook
                        const firstHookName = selectedHooks[0];
                        const hookVideo = videoResults.find(v => v.videoName === firstHookName);
                        if (hookVideo) {
                          const contextMatch = hookVideo.videoName.match(/^(T\d+_C\d+_E\d+_AD\d+)/);
                          const characterMatch = hookVideo.videoName.match(/_([^_]+)$/);
                          const context = contextMatch ? contextMatch[1] : 'MERGED';
                          const character = characterMatch ? characterMatch[1] : 'TEST';
                          
                        selectedHooks.forEach((hookName) => {
                          // Use hook name directly, just remove M for merged hooks
                          // T1_C1_E1_AD1_HOOK3M_TEST_ALINA_1 → T1_C1_E1_AD1_HOOK3_TEST_ALINA_1
                          const finalName = hookName.replace(/(HOOK\d+)M/, '$1');
                          combinations.push(finalName);
                        });
                        }
                      } else if (referenceVideo) {
                        const contextMatch = referenceVideo.videoName.match(/^(T\d+_C\d+_E\d+_AD\d+)/);
                        const characterMatch = referenceVideo.videoName.match(/_([^_]+)$/);
                        const context = contextMatch ? contextMatch[1] : 'MERGED';
                        const character = characterMatch ? characterMatch[1] : 'TEST';
                        
                        selectedHooks.forEach((hookName) => {
                          // Use hook name directly, just remove M for merged hooks
                          // T1_C1_E1_AD1_HOOK3M_TEST_ALINA_1 → T1_C1_E1_AD1_HOOK3_TEST_ALINA_1
                          const finalName = hookName.replace(/(HOOK\d+)M/, '$1');
                          combinations.push(finalName);
                        });
                      }
                    }
                    
                    // Check if body is selected
                    if (!selectedBody) {
                      return (
                        <div className="bg-yellow-50 p-4 rounded-lg border-2 border-yellow-400">
                          <p className="text-sm font-semibold text-yellow-800">
                            ⚠️ Please select a body video to create combinations
                          </p>
                        </div>
                      );
                    }
                    
                    // Check if hooks are selected
                    if (selectedHooks.length === 0) {
                      return (
                        <div className="bg-yellow-50 p-4 rounded-lg border-2 border-yellow-400">
                          <p className="text-sm font-semibold text-yellow-800">
                            ⚠️ Please select at least one hook to create combinations
                          </p>
                        </div>
                      );
                    }
                    
                    if (combinations.length === 0) {
                      return (
                        <p className="text-gray-600 text-sm">Select hooks and body to preview final video combinations</p>
                      );
                    }
                    
                    // Deduplicate combinations (same hook number should appear only once)
                    const uniqueCombinations = Array.from(new Set(combinations));
                    
                    return (
                      <div className="bg-gray-50 p-4 rounded-lg border border-gray-300">
                        <p className="text-xs text-gray-600 mb-2">
                          {uniqueCombinations.length} final video{uniqueCombinations.length > 1 ? 's' : ''} will be created:
                        </p>
                        <div className="space-y-1">
                          {uniqueCombinations.map((name, index) => (
                            <p key={index} className="text-xs font-mono text-gray-800">
                              {name}
                            </p>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
                
                {/* Navigation Buttons */}
                <div className="flex justify-between items-center mt-6">
                  <Button
                    onClick={() => setCurrentStep(9)}
                    variant="outline"
                    className="px-8 py-6 text-base"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back
                  </Button>
                  
                  <div className="flex flex-col items-center gap-0">
                    <Button
                      onClick={handleMergeFinalVideos}
                      className="bg-green-600 hover:bg-green-700 px-8 py-8 text-base"
                      disabled={selectedHooks.length === 0 || !selectedBody || isMergingFinalVideos}
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Next: Merge Final Videos ({selectedHooks.length})
                      <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Button>
                    <div className="text-center mt-0">
                      <span className="text-xs text-green-600">GO TO STEP 11</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* STEP 11: Final Videos */}
        {currentStep === 11 && (
          <Card className="shadow-xl border-2 border-green-500">
            <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50">
              <CardTitle className="text-3xl font-bold text-green-900 flex items-center gap-3">
                <span className="bg-green-600 text-white w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold shadow-lg">11</span>
                🎬 Final Videos
              </CardTitle>
              <CardDescription className="text-base text-gray-700 mt-2">
                Your final video combinations are ready! Download individual videos or all at once.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-6">
                {finalVideos.length === 0 ? (
                  <p className="text-gray-600 text-center py-8">No final videos yet. Go back to Step 10 to merge videos.</p>
                ) : (
                  <>
                    {/* Videos Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {finalVideos.map((video, index) => (
                        <div key={index} className="space-y-3 p-4 border border-gray-300 rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow">
                          {/* Video Name */}
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {video.videoName}
                          </p>
                          
                          {/* Video Player */}
                          <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '9/16' }}>
                            <video
                              src={video.cdnUrl}
                              className="absolute top-0 left-0 w-full h-full object-contain"
                              controls
                              playsInline
                            />
                          </div>
                          
                          {/* Download Button */}
                          <button
                            onClick={async () => {
                              try {
                                toast.info(`📥 Downloading ${video.videoName}...`);
                                const response = await fetch(video.cdnUrl);
                                const blob = await response.blob();
                                const url = URL.createObjectURL(blob);
                                const link = document.createElement('a');
                                link.href = url;
                                link.download = `${video.videoName}.mp4`;
                                link.click();
                                URL.revokeObjectURL(url);
                                toast.success(`✅ ${video.videoName} downloaded!`);
                              } catch (error) {
                                console.error('Download failed:', error);
                                toast.error('Download failed!');
                              }
                            }}
                            className="text-blue-600 hover:text-blue-800 underline text-sm text-center block cursor-pointer bg-transparent border-0"
                          >
                            Download
                          </button>
                        </div>
                      ))}
                    </div>
                    
                    {/* Download All ZIP Button */}
                    <div className="flex justify-center mt-8">
                      <Button
                        onClick={async () => {
                          try {
                            toast.info('📦 Preparing ZIP archive...');
                            
                            // Dynamically import JSZip
                            const JSZip = (await import('jszip')).default;
                            const zip = new JSZip();
                            
                            // Generate folder name from first video (all have same context/character/image)
                            const firstVideo = finalVideos[0];
                            if (!firstVideo) {
                              toast.error('No videos to download');
                              return;
                            }
                            
                            // Extract folder name from video name (e.g., T1_C1_E1_AD1_HOOK1_TEST_ALINA_1 → T1_C1_E1_AD1_TEST_ALINA_1)
                            // Remove HOOK{number}_ from the name
                            const folderName = firstVideo.videoName.replace(/_HOOK\d+_/, '_');
                            
                            // Download all videos and add to ZIP inside folder
                            for (const video of finalVideos) {
                              try {
                                const response = await fetch(video.cdnUrl);
                                const blob = await response.blob();
                                // Add video to folder inside ZIP
                                zip.file(`${folderName}/${video.videoName}.mp4`, blob);
                              } catch (error) {
                                console.error(`Failed to download ${video.videoName}:`, error);
                                toast.error(`Failed to download ${video.videoName}`);
                              }
                            }
                            
                            // Generate ZIP and download with folder name
                            const zipBlob = await zip.generateAsync({ type: 'blob' });
                            const link = document.createElement('a');
                            link.href = URL.createObjectURL(zipBlob);
                            link.download = `${folderName}.zip`;
                            link.click();
                            
                            toast.success('🎉 All videos downloaded!');
                          } catch (error) {
                            console.error('ZIP download failed:', error);
                            toast.error('Failed to create ZIP archive');
                          }
                        }}
                        className="bg-green-600 hover:bg-green-700 px-12 py-8 text-xl font-bold shadow-xl"
                      >
                        <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download All Videos ({finalVideos.length})
                        <svg className="w-6 h-6 ml-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </Button>
                    </div>
                  </>
                )}
                
                {/* Back Button */}
                <div className="mt-8 flex justify-start">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentStep(10)}
                    className="px-6 py-3"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        </>
        )}
      </div>
    </div>
  );
}
