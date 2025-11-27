import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import JSZip from 'jszip';
import { useLocation } from "wouter";
import EditProfileModal from '@/components/EditProfileModal';

import { VideoEditorV2 } from '@/components/VideoEditorV2';
import { ProcessingModal } from '@/components/ProcessingModal';
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
import { Upload, X, Check, Loader2, Video, FileText, Image as ImageIcon, Map as MapIcon, Play, Download, Undo2, ChevronLeft, RefreshCw, Clock, Search, FileEdit, MessageSquare, Images, Grid3x3, Scissors, CheckCircle2, Folder, Settings as SettingsIcon, LogOut, Sparkles } from "lucide-react";

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
    currentVideoName: '' 
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
  
  // Current step
  const [currentStep, setCurrentStep] = useState(1);
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  
  // Session management
  const [currentSessionId, setCurrentSessionId] = useState<string>('default');
  
  // Edit Profile modal
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [localCurrentUser, setLocalCurrentUser] = useState(currentUser);
  // Step 8 → Step 9: Trimming modal
  const [isTrimmingModalOpen, setIsTrimmingModalOpen] = useState(false);
  const [trimmingProgress, setTrimmingProgress] = useState<{
    current: number;
    total: number;
    currentVideo: string;
    status: 'idle' | 'processing' | 'complete' | 'partial';
    message: string;
    successVideos: Array<{name: string}>;
    failedVideos: Array<{name: string; error: string; retries: number}>;
    inProgressVideos: Array<{name: string}>;
  }>({
    current: 0,
    total: 0,
    currentVideo: '',
    status: 'idle',
    message: '',
    successVideos: [],
    failedVideos: [],
    inProgressVideos: []
  });
  
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
  const [mergeStep10Progress, setMergeStep10Progress] = useState<string>('');
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
  
  // DISABLED: localStorage restore - using database as single source of truth
  // Auto-restore session la mount
  useEffect(() => {
    // DISABLED: No longer restoring from localStorage
    // Database is the only source of truth
    setIsRestoringSession(false);
  }, []);
  
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
      setIsRestoringSession(false);
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
      
      // Update previousCharacterIdRef to track initial character
      if (selectedCharacterId) {
        previousCharacterIdRef.current = selectedCharacterId;
      }
      
      // toast.success('Context data loaded from database!'); // Hidden per user request
    } else {
      // No context session in database - reset to empty state
      console.log('[Context Session] No database session found, resetting to empty state');
      setCurrentStep(1);
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

  // Save selectedAdId and selectedCharacterId to localStorage
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
      // Pre-select all hooks
      const hookVideos = videoResults.filter(v => 
        v.trimmedVideoUrl && 
        v.videoName.toLowerCase().includes('hook')
      );
      setSelectedHooks(hookVideos.map(v => v.videoName));
      
      // Pre-select body (first body video or merged body)
      if (bodyMergedVideoUrl) {
        setSelectedBody('body_merged');
      } else {
        const bodyVideos = videoResults.filter(v => 
          v.trimmedVideoUrl && 
          !v.videoName.toLowerCase().includes('hook')
        );
        if (bodyVideos.length > 0) {
          setSelectedBody(bodyVideos[0].videoName);
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
        });
        console.log('[Auto-save] ✅ currentStep saved successfully');
      } catch (error) {
        console.error('[Auto-save] ❌ Failed to save currentStep:', error);
      }
    }, 500); // 500ms debounce
    
    return () => clearTimeout(saveTimeout);
  }, [currentStep, selectedTamId, selectedCoreBeliefId, selectedEmotionalAngleId, selectedAdId, selectedCharacterId, localCurrentUser]);
  
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

  // Step 8: Batch process videos with Whisper + FFmpeg API (SMART rate limiting)
  const batchProcessVideosWithWhisper = async (videos: VideoResult[]) => {
    const batchStartTime = Date.now();
    console.log('[Batch Processing] ⏱️ BATCH START at', new Date().toISOString());
    console.log('[Batch Processing] 🚀 Starting SMART processing with', videos.length, 'videos');
    console.log('[Batch Processing] 📋 Video list:', videos.map(v => v.videoName).join(', '));
    
    // Initialize progress bars
    setProcessingProgress({
      ffmpeg: { current: 0, total: videos.length, status: 'idle', activeVideos: [] },
      whisper: { current: 0, total: videos.length, status: 'idle', activeVideos: [] },
      cleanvoice: { current: 0, total: videos.length, status: 'idle', activeVideos: [] },
      currentVideoName: ''
    });
    
    let successCount = 0;
    let failCount = 0;
    let ffmpegCompletedCount = 0;
    let whisperCompletedCount = 0;
    let cleanvoiceCompletedCount = 0;
    let activeFfmpegRequests = 0;  // Track LIVE FFmpeg requests
    
    // Collect all results in a Map
    const resultsMap = new Map<string, any>();
    const MAX_FFMPEG_CONCURRENT = 5;  // Max 5 FFmpeg requests at once (API limit)
    const BATCH_SIZE = 3;  // Wait for 3 to complete before sending more
    const DELAY_AFTER_BATCH = 3000;  // 3 seconds delay after receiving batch
    
    // Helper: Process single video with retry
    const processVideoWithRetry = async (video: VideoResult, retries = 3): Promise<any> => {
      const videoStartTime = Date.now();
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          console.log(`[Batch Processing] ⏱️ ${video.videoName} - START at ${new Date().toISOString()}`);
          console.log(`[Batch Processing] 🎬 ${video.videoName} - Attempt ${attempt}/${retries}`);
          console.log(`[Batch Processing] 📊 Active FFmpeg requests: ${activeFfmpegRequests}/${MAX_FFMPEG_CONCURRENT} (API limit: 5)`);
          
          // Increment active FFmpeg counter BEFORE request
          activeFfmpegRequests++;
          setProcessingStep('extract');
          
          // Add video to FFmpeg and CleanVoice (they start together with video URL)
          // Whisper will be added later after FFmpeg extracts audio
          setProcessingProgress(prev => ({
            ...prev,
            ffmpeg: { 
              ...prev.ffmpeg, 
              status: 'processing', 
              activeVideos: [...prev.ffmpeg.activeVideos, video.videoName]
            },
            cleanvoice: {
              ...prev.cleanvoice,
              status: 'processing',
              activeVideos: [...prev.cleanvoice.activeVideos, video.videoName]
            }
          }));
          
          // Extract red text from video
          const hasRedText = video.redStart !== undefined && 
                            video.redEnd !== undefined && 
                            video.redStart >= 0 && 
                            video.redEnd > video.redStart;
          
          const redText = hasRedText
            ? video.text.substring(video.redStart, video.redEnd)
            : '';
          
          // Calculate red text position from redStart/redEnd (undefined if no red text)
          // Check if red text is at the END of the original text (not just redStart position)
          const textLength = video.text.length;
          const redTextPosition: 'START' | 'END' | undefined = hasRedText
            ? ((video.redEnd || 0) >= textLength - 10 ? 'END' : 'START')  // If redEnd is near end of text, it's at END
            : undefined;
          
          if (!hasRedText || !redText) {
            console.log(`[Batch Processing] ⚪ ${video.videoName} - No red text, processing as white-text-only`);
          }
          
          // Process with FFmpeg + Whisper (this includes both FFmpeg audio extraction AND Whisper transcription)
          console.log(`[Batch Processing] 📤 Sending API request for ${video.videoName}:`, {
            videoUrl: video.videoUrl,
            videoId: parseInt(video.id || '0'),
            videoName: video.videoName,
            fullText: video.text.substring(0, 50) + '...',
            redText: redText,
            redTextPosition: redTextPosition
          });
          
          const result = await processVideoForEditingMutation.mutateAsync({
            videoUrl: video.videoUrl!,
            videoId: parseInt(video.id || '0'),
            videoName: video.videoName,  // Pass video name for unique file naming
            fullText: video.text,
            redText: redText,
            redTextPosition: redTextPosition,
            marginMs: 50,
            userApiKey: localCurrentUser.openaiApiKey || undefined,
            ffmpegApiKey: localCurrentUser.ffmpegApiKey || undefined,
            cleanvoiceApiKey: localCurrentUser.cleanvoiceApiKey || undefined,
            userId: localCurrentUser.id,
          });
          
          // Decrement active FFmpeg counter AFTER response
          activeFfmpegRequests--;
          
          // Add to Whisper active list NOW (FFmpeg extracted audio, Whisper starts transcription)
          setProcessingProgress(prev => ({
            ...prev,
            whisper: {
              ...prev.whisper,
              status: 'processing',
              activeVideos: [...prev.whisper.activeVideos, video.videoName]
            }
          }));
          
          const videoDuration = Date.now() - videoStartTime;
          console.log(`[Batch Processing] ✅ ${video.videoName} - Success in ${videoDuration}ms (${(videoDuration/1000).toFixed(2)}s)!`);
          console.log(`[Batch Processing] 📥 Received result for ${video.videoName} (took ${videoDuration}ms):`, {
            audioUrl: result.audioUrl,
            cutPoints: result.cutPoints,
            whisperTranscript: typeof result.whisperTranscript === 'string' 
              ? result.whisperTranscript.substring(0, 50) + '...'
              : JSON.stringify(result.whisperTranscript).substring(0, 50) + '...'
          });
          
          // Update FFmpeg progress (audio extraction complete) - remove from active list
          ffmpegCompletedCount++;
          setProcessingProgress(prev => ({ 
            ...prev,
            ffmpeg: { 
              current: ffmpegCompletedCount, 
              total: videos.length,
              status: ffmpegCompletedCount === videos.length ? 'complete' : 'processing',
              activeVideos: prev.ffmpeg.activeVideos.filter(v => v !== video.videoName)
            },
            currentVideoName: video.videoName 
          }));
          
          // Update Whisper progress (transcription complete) - remove from active list
          whisperCompletedCount++;
          setProcessingProgress(prev => ({ 
            ...prev,
            whisper: { 
              current: whisperCompletedCount, 
              total: videos.length,
              status: whisperCompletedCount === videos.length ? 'complete' : 'processing',
              activeVideos: prev.whisper.activeVideos.filter(v => v !== video.videoName)
            },
            currentVideoName: video.videoName 
          }));
          
          // Update CleanVoice progress (audio processing complete) - remove from active list
          cleanvoiceCompletedCount++;
          setProcessingProgress(prev => ({ 
            ...prev,
            cleanvoice: { 
              current: cleanvoiceCompletedCount, 
              total: videos.length,
              status: cleanvoiceCompletedCount === videos.length ? 'complete' : 'processing',
              activeVideos: prev.cleanvoice.activeVideos.filter(v => v !== video.videoName)
            },
            currentVideoName: video.videoName 
          }));
          
          console.log(`[Batch Processing] 📊 Progress: FFmpeg ${ffmpegCompletedCount}/${videos.length}, Whisper ${whisperCompletedCount}/${videos.length}, CleanVoice ${cleanvoiceCompletedCount}/${videos.length}`);
          
          // Log CleanVoice result
          console.log(`[Batch Processing] 🎵 ${video.videoName} - CleanVoice URL:`, result.cleanvoiceAudioUrl || 'NULL (CleanVoice failed or not configured)');
          
          return {
            videoName: video.videoName,
            success: true,
            result: {
              whisperTranscript: result.whisperTranscript,
              cutPoints: result.cutPoints,
              words: result.words,
              audioUrl: result.audioUrl,
              waveformData: result.waveformJson,
              editingDebugInfo: result.editingDebugInfo,
              cleanvoiceAudioUrl: result.cleanvoiceAudioUrl,
              noCutNeeded: false,
            }
          };
        } catch (error: any) {
          // Decrement counter on error
          activeFfmpegRequests--;
          
          console.error(`[Batch Processing] ❌ ${video.videoName} - Attempt ${attempt} failed:`, error.message);
          
          // Update progress even on failure (last attempt) - remove from all active lists
          if (attempt === retries) {
            ffmpegCompletedCount++;
            whisperCompletedCount++;
            cleanvoiceCompletedCount++;
            setProcessingProgress(prev => ({ 
              ...prev,
              ffmpeg: { 
                current: ffmpegCompletedCount, 
                total: videos.length,
                status: ffmpegCompletedCount === videos.length ? 'complete' : 'processing',
                activeVideos: prev.ffmpeg.activeVideos.filter(v => v !== video.videoName)
              },
              whisper: { 
                current: whisperCompletedCount, 
                total: videos.length,
                status: whisperCompletedCount === videos.length ? 'complete' : 'processing',
                activeVideos: prev.whisper.activeVideos.filter(v => v !== video.videoName)
              },
              cleanvoice: { 
                current: cleanvoiceCompletedCount, 
                total: videos.length,
                status: cleanvoiceCompletedCount === videos.length ? 'complete' : 'processing',
                activeVideos: prev.cleanvoice.activeVideos.filter(v => v !== video.videoName)
              },
              currentVideoName: video.videoName 
            }));
          }
          
          if (attempt === retries) {
            console.error(`[Batch Processing] 🚫 ${video.videoName} - All ${retries} attempts failed`);
            return {
              videoName: video.videoName,
              success: false,
              error: error.message
            };
          }
          
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
        }
      }
    };
    
    // SMART PROCESSING QUEUE with FFmpeg rate limiting
    const processQueueSmart = async (): Promise<any[]> => {
      const results: any[] = [];
      let currentIndex = 0;
      const pendingPromises: Map<number, Promise<any>> = new Map();
      
      console.log('[Batch Processing] 🚀 Phase 1: Sending first 5 videos (API limit)...');
      
      // Phase 1: Send first 5 videos (or less if total < 5)
      const initialBatch = Math.min(MAX_FFMPEG_CONCURRENT, videos.length);
      for (let i = 0; i < initialBatch; i++) {
        const video = videos[i];
        const index = i;
        const promise = processVideoWithRetry(video)
          .then(result => {
            results[index] = result;
            pendingPromises.delete(index);
            return result;
          })
          .catch(error => {
            console.error(`[Batch Processing] Error processing ${video.videoName}:`, error);
            results[index] = null;
            pendingPromises.delete(index);
            return null;
          });
        pendingPromises.set(index, promise);
        currentIndex++;
      }
      
      // Phase 2: Wait for batches and send more
      while (currentIndex < videos.length) {
        // Poll until activeFfmpegRequests <= (MAX_FFMPEG_CONCURRENT - BATCH_SIZE)
        // This means BATCH_SIZE have completed, so we can send BATCH_SIZE more
        // With MAX=5 and BATCH=3: wait until active <= 2, then send 3 more
        const targetActive = MAX_FFMPEG_CONCURRENT - BATCH_SIZE;
        
        console.log(`[Batch Processing] ⏳ Waiting for active requests to drop to ${targetActive}...`);
        
        while (activeFfmpegRequests > targetActive) {
          // Poll every 500ms
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        console.log(`[Batch Processing] ✅ Active requests dropped to ${activeFfmpegRequests}!`);
        console.log(`[Batch Processing] ⏱️  Waiting ${DELAY_AFTER_BATCH}ms before next batch...`);
        
        // Delay 3 seconds before sending next batch
        await new Promise(resolve => setTimeout(resolve, DELAY_AFTER_BATCH));
        
        // Send next BATCH_SIZE videos
        const nextBatchSize = Math.min(BATCH_SIZE, videos.length - currentIndex);
        console.log(`[Batch Processing] 🚀 Sending next ${nextBatchSize} videos...`);
        
        for (let i = 0; i < nextBatchSize; i++) {
          const video = videos[currentIndex];
          const index = currentIndex;
          const promise = processVideoWithRetry(video)
            .then(result => {
              results[index] = result;
              pendingPromises.delete(index);
              return result;
            })
            .catch(error => {
              console.error(`[Batch Processing] Error processing ${video.videoName}:`, error);
              results[index] = null;
              pendingPromises.delete(index);
              return null;
            });
          pendingPromises.set(index, promise);
          currentIndex++;
        }
      }
      
      // Wait for all remaining promises to complete
      console.log(`[Batch Processing] ⏳ Waiting for remaining ${pendingPromises.size} videos...`);
      await Promise.all(Array.from(pendingPromises.values()));
      
      console.log('[Batch Processing] 🎉 All videos processed!');
      return results;
    };
    
    // Start smart processing
    setProcessingStep('extract');
    const allResults = await processQueueSmart();
    
    console.log('[Batch Processing] 🎉 All videos processed!');
    
    // Count successes and failures
    for (const result of allResults) {
      if (result && result.success) {
        successCount++;
        resultsMap.set(result.videoName, result.result);
      } else {
        failCount++;
        if (result) {
          toast.error(`❌ ${result.videoName}: ${result.error}`);
        }
      }
    }
    
    console.log(`[Batch Processing] 🎉 COMPLETE! Success: ${successCount}, Failed: ${failCount}`);
    
    if (successCount === 0) {
      throw new Error('Toate videouri au eșuat la procesare!');
    }
    
    // Apply all results at once to avoid React state closure issues
    console.log('[Batch Processing] 🔄 Applying all results to state...', {
      totalResults: resultsMap.size,
      videoNames: Array.from(resultsMap.keys())
    });
    
    setVideoResults(prev => prev.map(v => {
      const result = resultsMap.get(v.videoName);
      if (result) {
        console.log(`[Batch Processing] ✅ Applying result for ${v.videoName}:`, {
          cutPoints: result.cutPoints,
          noCutNeeded: result.noCutNeeded
        });
        
        // If video has no red text, set default markers (0 to duration)
        if (result.noCutNeeded) {
          return {
            ...v,
            whisperTranscript: null,
            cutPoints: null,
            words: null,
            audioUrl: null,
            waveformData: null,
            editStatus: 'no_cut_needed',
            noCutNeeded: true
          };
        }
        
        // Normal processing with FFMPEG/Whisper
        // Backend now adds timestamp to filename, so URL is unique
        return {
          ...v,
          whisperTranscript: result.whisperTranscript,
          cutPoints: result.cutPoints,
          words: result.words,
          audioUrl: result.audioUrl,
          waveformData: result.waveformData,
          editingDebugInfo: result.editingDebugInfo,
          cleanvoiceAudioUrl: result.cleanvoiceAudioUrl,
          editStatus: 'processed',
          noCutNeeded: false,
          // Set START and END locked by default
          isStartLocked: true,
          isEndLocked: true
        };
      }
      return v;
    }));
    
    const batchTotalDuration = Date.now() - batchStartTime;
    console.log('[Batch Processing] ✅ All results applied to state!');
    console.log(`[Batch Processing] ⏱️ BATCH COMPLETE in ${batchTotalDuration}ms (${(batchTotalDuration/1000).toFixed(2)}s)`);
    console.log(`[Batch Processing] 📈 SUMMARY: ${successCount} success, ${failCount} failed out of ${videos.length} total`);
    console.log(`[Batch Processing] ⏱️ Average time per video: ${(batchTotalDuration/videos.length/1000).toFixed(2)}s`);
    
    // Return resultsMap for onReprocess callback
    return resultsMap;
  };

  // Step 9 → Step 10: Merge videos (body + hook variations)
  const handleMergeVideos = async () => {
    console.log('[Step 9→Step 10] 🚀 Starting merge process...');
    console.log('[Step 9→Step 10] 📊 Total videoResults:', videoResults.length);
    
    const trimmedVideos = videoResults.filter(v => 
      v.reviewStatus === 'accepted' && 
      v.status === 'success' && 
      v.trimmedVideoUrl
    );
    
    console.log('[Step 9→Step 10] ✅ Trimmed videos found:', trimmedVideos.length);
    console.log('[Step 9→Step 10] 📋 Trimmed videos:', trimmedVideos.map(v => v.videoName));
    
    // 1. Merge body videos (exclude hooks)
    const bodyVideos = trimmedVideos.filter(v => !v.videoName.toLowerCase().includes('hook'));
    console.log('[Step 9→Step 10] 📺 Body videos (non-hook):', bodyVideos.length);
    console.log('[Step 9→Step 10] 📺 Body video names:', bodyVideos.map(v => v.videoName));
    
    // 2. Group hook variations (A, B, C, D)
    const hookVideos = trimmedVideos.filter(v => v.videoName.toLowerCase().includes('hook'));
    console.log('[Step 9→Step 10] 🎣 Hook videos:', hookVideos.length);
    console.log('[Step 9→Step 10] 🎣 Hook video names:', hookVideos.map(v => v.videoName));
    
    if (bodyVideos.length === 0 && hookVideos.length === 0) {
      console.error('[Step 9→Step 10] ❌ No videos to merge!');
      toast.error('No videos to merge!');
      return;
    }
    
    console.log('[Step 9→Step 10] 🔄 Setting merge state...');
    setIsMergingStep10(true);
    setMergeStep10Progress('Starting merge process...');
    
    try {
      // Merge body videos
      if (bodyVideos.length > 0) {
        console.log('[Step 9→Step 10] 📺 Starting BODY merge...');
        setMergeStep10Progress(`Merging ${bodyVideos.length} body videos...`);
        
        const bodyVideoUrls = bodyVideos.map(v => v.trimmedVideoUrl!).filter(Boolean);
        console.log('[Step 9→Step 10] 🔗 Body video URLs:', bodyVideoUrls);
        
        // Extract context from first video name (e.g., T1_C1_E1_AD2)
        const firstVideoName = bodyVideos[0].videoName;
        const contextMatch = firstVideoName.match(/^(T\d+_C\d+_E\d+_AD\d+)/);
        const context = contextMatch ? contextMatch[1] : 'MERGED';
        
        // Extract character name (last part after underscore)
        const characterMatch = firstVideoName.match(/_([^_]+)$/);
        const characterName = characterMatch ? characterMatch[1] : 'TEST';
        
        // NEW NAMING: T1_C1_E1_AD2_BODY_TEST
        const outputName = `${context}_BODY_${characterName}`;
        
        console.log('[Step 9→Step 10] 🎯 Body merge output name:', outputName);
        console.log('[Step 9→Step 10] 📤 Calling mergeVideosMutation...');
        
        const bodyResult = await mergeVideosMutation.mutateAsync({
          videoUrls: bodyVideoUrls,
          outputVideoName: outputName,
          ffmpegApiKey: localCurrentUser.ffmpegApiKey || '',
        });
        
        console.log('[Step 9→Step 10] ✅ Body merge result:', bodyResult);
        setBodyMergedVideoUrl(bodyResult.cdnUrl);
        console.log('[Step 9→Step 10] ✅ Body merge complete:', bodyResult.cdnUrl);
      }
      
      // Merge hook variations (group by base name)
      if (hookVideos.length > 0) {
        console.log('[Step 9→Step 10] 🎣 Starting HOOK merge...');
        setMergeStep10Progress('Merging hook variations...');
        
        // Group hooks by base name
        const hookGroups: Record<string, typeof hookVideos> = {};
        
        hookVideos.forEach(video => {
          const match = video.videoName.match(/(.*HOOK\d+)[A-Z]?(.*)/);
          if (match) {
            const baseName = match[1] + match[2];
            if (!hookGroups[baseName]) {
              hookGroups[baseName] = [];
            }
            hookGroups[baseName].push(video);
          }
        });
        
        console.log('[Step 9→Step 10] 📋 Hook groups:', hookGroups);
        console.log('[Step 9→Step 10] 📋 Hook group count:', Object.keys(hookGroups).length);
        
        // Merge each group
        const mergedHooks: Record<string, string> = {};
        
        for (const [baseName, videos] of Object.entries(hookGroups)) {
          if (videos.length > 1) {
            setMergeStep10Progress(`Merging ${baseName} (${videos.length} variations)...`);
            
            const sortedVideos = videos.sort((a, b) => a.videoName.localeCompare(b.videoName));
            const hookVideoUrls = sortedVideos.map(v => v.trimmedVideoUrl!).filter(Boolean);
            
            const outputName = baseName.replace(/(_[^_]+)$/, 'M$1');
            
            console.log(`[Step 9→Step 10] Merging ${baseName} → ${outputName}`);
            
            const hookResult = await mergeVideosMutation.mutateAsync({
              videoUrls: hookVideoUrls,
              outputVideoName: outputName,
              ffmpegApiKey: localCurrentUser.ffmpegApiKey || '',
            });
            
            mergedHooks[baseName] = hookResult.cdnUrl;
            console.log(`[Step 9→Step 10] ${baseName} merge complete:`, hookResult.cdnUrl);
          }
        }
        
        setHookMergedVideos(mergedHooks);
      }
      
      console.log('[Step 9→Step 10] 🎉 All merges complete!');
      setMergeStep10Progress('');
      setIsMergingStep10(false);
      
      console.log('[Step 9→Step 10] ➡️ Moving to Step 10...');
      setCurrentStep(10);
      toast.success('✅ Merge complete! Go to Step 10.');
    } catch (error: any) {
      console.error('[Step 9→Step 10] ❌ Merge error:', error);
      console.error('[Step 9→Step 10] ❌ Error stack:', error.stack);
      setMergeStep10Progress(`Error: ${error.message}`);
      setIsMergingStep10(false);
      toast.error(`Merge failed: ${error.message}`);
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
    }
    
    if (!bodyUrl) {
      toast.error('Body video URL not found!');
      return;
    }
    
    // Get hook URLs
    const hookUrls: Array<{ name: string; url: string; hookNumber: string }> = [];
    
    for (const hookName of selectedHooks) {
      let hookUrl: string | null = null;
      
      // Check if this is a merged hook
      const baseName = Object.keys(hookMergedVideos).find(bn => {
        const mergedName = bn.replace(/(_[^_]+)$/, 'M$1');
        return hookName === mergedName;
      });
      
      if (baseName) {
        hookUrl = hookMergedVideos[baseName];
      } else {
        const hookVideo = videoResults.find(v => v.videoName === hookName);
        hookUrl = hookVideo?.trimmedVideoUrl || null;
      }
      
      if (hookUrl) {
        const hookMatch = hookName.match(/HOOK(\d+)[A-Z]?/);
        const hookNumber = hookMatch ? hookMatch[1] : '1';
        hookUrls.push({ name: hookName, url: hookUrl, hookNumber });
      }
    }
    
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
        // Find the hook video to get imageUrl
        const hookVideo = videoResults.find(v => v.videoName === hook.name);
        
        // Extract image name from imageUrl
        let imageName = '';
        if (hookVideo && hookVideo.imageUrl) {
          // Extract filename from URL: .../Alina_1-1763565542441-8ex9ipx3ruv.png → Alina_1
          const urlParts = hookVideo.imageUrl.split('/');
          const filename = urlParts[urlParts.length - 1];
          const nameMatch = filename.match(/^(.+?)-\d+/);
          imageName = nameMatch ? nameMatch[1] : '';
        }
        
        const finalVideoName = imageName 
          ? `${context}_${character}_${imageName}_HOOK${hook.hookNumber}`
          : `${context}_${character}_HOOK${hook.hookNumber}`;
        
        setMergeFinalProgress(prev => ({
          ...prev,
          current: completedCount + 1,
          currentVideo: finalVideoName
        }));
        
        try {
          const result = await mergeVideosMutation.mutateAsync({
            videoUrls: [hook.url, bodyUrl!],
            outputVideoName: finalVideoName,
            ffmpegApiKey: localCurrentUser.ffmpegApiKey || '',
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
