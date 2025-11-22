import { useState, useEffect, useMemo, useCallback, useRef } from "react";
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
import { Upload, X, Check, Loader2, Video, FileText, Image as ImageIcon, Map as MapIcon, Play, Download, Undo2, ChevronLeft, RefreshCw, Clock, Search } from "lucide-react";

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
  // Step 9: Trimmed video fields
  trimmedVideoUrl?: string; // Trimmed video URL from Bunny CDN

  recutStatus?: 'accepted' | 'recut' | null; // Review status in Step 9
  step9Note?: string;       // Internal note added by user in Step 9
}

interface HomeProps {
  currentUser: { id: number; username: string; profileImageUrl: string | null; kieApiKey: string | null; openaiApiKey: string | null; ffmpegApiKey: string | null };
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
  const [processingProgress, setProcessingProgress] = useState({ current: 0, total: 0, currentVideoName: '' });
  const [processingStep, setProcessingStep] = useState<'download' | 'extract' | 'whisper' | 'detect' | 'save' | null>(null);
  
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
  
  // Session management
  const [currentSessionId, setCurrentSessionId] = useState<string>('default');
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  
  // Edit Profile modal
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [localCurrentUser, setLocalCurrentUser] = useState(currentUser);
  // Step 8 → Step 9: Trimming modal
  const [isTrimmingModalOpen, setIsTrimmingModalOpen] = useState(false);
  const [trimmingProgress, setTrimmingProgress] = useState<{
    current: number;
    total: number;
    currentVideo: string;
    status: 'idle' | 'processing' | 'complete';
    message: string;
  }>({
    current: 0,
    total: 0,
    currentVideo: '',
    status: 'idle',
    message: ''
  });
  
  // Cut & Merge modal
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [mergedVideoUrl, setMergedVideoUrl] = useState<string | null>(null);
  const [mergeProgress, setMergeProgress] = useState<string>('');
  
  // Sample Merge modal
  const [isSampleMergeModalOpen, setIsSampleMergeModalOpen] = useState(false);
  const [sampleMergedVideoUrl, setSampleMergedVideoUrl] = useState<string | null>(null);
  const [sampleMergeProgress, setSampleMergeProgress] = useState<string>('');
  const [sampleMergeVideos, setSampleMergeVideos] = useState<Array<{name: string, note: string}>>([]);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState<string>('');
  // Cache for Sample Merge to avoid re-cutting if videos haven't changed
  const [lastMergedVideosHash, setLastMergedVideosHash] = useState<string>('');
  
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
  const [step8Filter, setStep8Filter] = useState<'all' | 'accepted' | 'recut' | 'unlocked'>('all');
  
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
      if (session.videoResults) setVideoResults(session.videoResults);
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
      
      // Load all workflow data from context session (database)
      if (contextSession.currentStep) setCurrentStep(contextSession.currentStep);
      if (contextSession.rawTextAd) setRawTextAd(contextSession.rawTextAd);
      if (contextSession.processedTextAd) setProcessedTextAd(contextSession.processedTextAd);
      // Parse all JSON fields - ensure they're always arrays
      const parseJsonField = (field: any) => {
        if (!field) return [];
        const parsed = typeof field === 'string' ? JSON.parse(field) : field;
        return Array.isArray(parsed) ? parsed : [];
      };
      
      setAdLines(parseJsonField(contextSession.adLines));
      setPrompts(parseJsonField(contextSession.prompts));
      setImages(parseJsonField(contextSession.images));
      setCombinations(parseJsonField(contextSession.combinations));
      setDeletedCombinations(parseJsonField(contextSession.deletedCombinations));
      
      // Only load videoResults if they are empty (first load)
      // Don't reload if videoResults already exist - this prevents overwriting manual marker changes
      const loadedVideoResults = parseJsonField(contextSession.videoResults);
      if (videoResults.length === 0) {
        console.log('[Context Session] Loading videoResults from database (first load)');
        setVideoResults(loadedVideoResults);
      } else {
        console.log('[Context Session] Skipping videoResults reload - already loaded');
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
  
  // Auto-save to context session when data changes (debounced)
  // ONLY save to database after video generation (STEP 6+)
  useEffect(() => {
    if (!selectedTamId || !selectedCoreBeliefId || !selectedEmotionalAngleId || !selectedAdId || !selectedCharacterId) {
      return; // Don't save if context not complete
    }
    
    if (isRestoringSession) return; // Don't save during restore
    
    const timeoutId = setTimeout(() => {
      // For STEP 1-5: Save only currentStep to preserve navigation state
      // For STEP 6+: Save full workflow data
      if (currentStep < 6) {
        console.log('[Context Session] Saving workflow data for STEP', currentStep);
        upsertContextSessionMutation.mutate({
          userId: localCurrentUser.id,
          coreBeliefId: selectedCoreBeliefId,
          emotionalAngleId: selectedEmotionalAngleId,
          adId: selectedAdId,
          characterId: selectedCharacterId,
          currentStep,
          rawTextAd, // SAVE Ad document data
          processedTextAd, // SAVE Ad document data
          adLines, // SAVE Ad lines
          prompts, // SAVE prompts
          images, // SAVE images
          combinations, // SAVE combinations
          deletedCombinations, // SAVE deleted combinations
          videoResults: [], // Don't save video results until STEP 6+
          reviewHistory: [],
        }, {
          onSuccess: () => {
            console.log('[Context Session] CurrentStep saved successfully');
          },
          onError: (error) => {
            console.error('[Context Session] CurrentStep save failed:', error);
          },
        });
      } else {
        console.log('[Context Session] Auto-saving full workflow data...');
        upsertContextSessionMutation.mutate({
          userId: localCurrentUser.id,
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
        }, {
          onSuccess: () => {
            console.log('[Context Session] Auto-saved successfully');
          },
          onError: (error) => {
            console.error('[Context Session] Auto-save failed:', error);
          },
        });
      }
    }, 2000); // Debounce 2 seconds
    
    return () => clearTimeout(timeoutId);
  }, [
    // DO NOT include selectedAdId or selectedCharacterId in dependencies
    // to prevent auto-save when switching context
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
    isRestoringSession,
  ]);
  
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

  // Step 8: Batch process videos with Whisper + FFmpeg API
  const batchProcessVideosWithWhisper = async (videos: VideoResult[]) => {
    console.log('[Batch Processing] 🚀 Starting with', videos.length, 'videos');
    
    let successCount = 0;
    let failCount = 0;
    
    // Collect all results in a Map to avoid React state closure issues
    const resultsMap = new Map<string, any>();
    
    for (let i = 0; i < videos.length; i++) {
      const video = videos[i];
      
      setProcessingProgress({ 
        current: i, 
        total: videos.length,
        currentVideoName: video.videoName 
      });
      
      try {
        console.log(`[Batch Processing] 🎥 Processing video ${i + 1}/${videos.length}:`, video.videoName);
        
        // Extract red text from video
        const hasRedText = video.redStart !== undefined && 
                          video.redEnd !== undefined && 
                          video.redStart >= 0 && 
                          video.redEnd > video.redStart;
        
        const redText = hasRedText
          ? video.text.substring(video.redStart, video.redEnd)
          : '';
        
        // Calculate red text position from redStart/redEnd
        const redTextPosition: 'START' | 'END' = (video.redStart === 0 || (video.redStart || 0) < 10)
          ? 'START'
          : 'END';
        
        console.log(`[Batch Processing] Red text position: ${redTextPosition} (redStart: ${video.redStart}, redEnd: ${video.redEnd}, textLength: ${video.text.length})`);
        
        if (!hasRedText || !redText) {
          // Video without red text - set default markers (0 to duration) without FFMPEG processing
          console.log(`[Batch Processing] 🟠 No red text for ${video.videoName} - setting default markers (0 to duration)`);
          
          setProcessingStep('save');
          await new Promise(resolve => setTimeout(resolve, 300));
          
          // Store default result without FFMPEG/Whisper processing
          resultsMap.set(video.videoName, {
            whisperTranscript: null,
            cutPoints: null,
            words: null,
            audioUrl: null,
            waveformData: null,
            noCutNeeded: true, // Flag to indicate no cut needed
          });
          
          console.log(`[Batch Processing] ✅ Default markers set for ${video.videoName}`);
          successCount++;
          continue;
        }
        
        console.log(`[Batch Processing] Red text: "${redText.substring(0, 50)}..."`);
        
        // Step 1: Extract audio with FFmpeg API
        console.log(`[Batch Processing] 🎵 Step 1/2: Extracting audio...`);
        setProcessingStep('extract');
        await new Promise(resolve => setTimeout(resolve, 800)); // Delay for UI visibility
        
        // Step 2: Whisper API transcription + Cut points calculation
        console.log(`[Batch Processing] 🤖 Step 2/2: Whisper transcription...`);
        setProcessingStep('whisper');
        
        const result = await processVideoForEditingMutation.mutateAsync({
          videoUrl: video.videoUrl!,
          videoId: parseInt(video.id || '0'),
          fullText: video.text,
          redText: redText,
          redTextPosition: redTextPosition,
          marginMs: 50,
          userApiKey: localCurrentUser.openaiApiKey || undefined,
          ffmpegApiKey: localCurrentUser.ffmpegApiKey || undefined,
        });
        
        console.log(`[Batch Processing] 💾 Saving results for ${video.videoName}...`);
        setProcessingStep('save');
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Store result in Map (will apply all at once at the end)
        resultsMap.set(video.videoName, {
          whisperTranscript: result.whisperTranscript,
          cutPoints: result.cutPoints,
          words: result.words,
          audioUrl: result.audioUrl,
          waveformData: result.waveformJson,
          editingDebugInfo: result.editingDebugInfo,
          noCutNeeded: false,
        });
        
        console.log(`[Batch Processing] ✅ Stored result for ${video.videoName}:`, {
          cutPoints: result.cutPoints,
          editingDebugInfo: result.editingDebugInfo,
          hasWhisperTranscript: !!result.whisperTranscript,
          hasWaveformData: !!result.waveformData,
        });
        
        successCount++;
        console.log(`[Batch Processing] ✅ Video ${i + 1}/${videos.length} SUCCESS!`, {
          cutPoints: result.cutPoints,
          wordsCount: result.words?.length || 0
        });
        
      } catch (error: any) {
        failCount++;
        console.error(`[Batch Processing] ❌ Video ${i + 1}/${videos.length} FAILED:`, error);
        console.error(`[Batch Processing] Error details:`, {
          videoName: video.videoName,
          videoUrl: video.videoUrl,
          error: error.message,
          stack: error.stack
        });
        toast.error(`❌ ${video.videoName}: ${error.message}`);
        // Continue with next video even if one fails
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
        return {
          ...v,
          whisperTranscript: result.whisperTranscript,
          cutPoints: result.cutPoints,
          words: result.words,
          audioUrl: result.audioUrl,
          waveformData: result.waveformData,
          editingDebugInfo: result.editingDebugInfo,
          editStatus: 'processed',
          noCutNeeded: false
        };
      }
      return v;
    }));
    
    console.log('[Batch Processing] ✅ All results applied to state!');
  };

  // Step 8 → Step 9: Trim all videos using FFMPEG API
  const handleTrimAllVideos = async () => {
    // Check if we have trimmed videos (Step 9 exists)
    const hasTrimmedVideos = videoResults.some(v => v.trimmedVideoUrl);
    
    let videosToTrim;
    
    if (hasTrimmedVideos) {
      // Scenario 2: We've been to Step 9, only trim videos with "recut" status
      videosToTrim = videoResults.filter(v => 
        v.reviewStatus === 'accepted' && 
        v.status === 'success' && 
        v.videoUrl &&
        v.recutStatus === 'recut' // Only recut videos
      );
    } else {
      // Scenario 1: First time, trim all approved videos
      videosToTrim = videoResults.filter(v => 
        v.reviewStatus === 'accepted' && 
        v.status === 'success' && 
        v.videoUrl
      );
    }
    
    if (videosToTrim.length === 0) {
      if (hasTrimmedVideos) {
        // Check if all recut videos are already trimmed
        const recutVideos = videoResults.filter(v => 
          v.reviewStatus === 'accepted' && 
          v.status === 'success' && 
          v.recutStatus === 'recut'
        );
        const allRecutTrimmed = recutVideos.every(v => v.trimmedVideoUrl);
        
        if (allRecutTrimmed && recutVideos.length > 0) {
          toast.success('✅ Toate videourile sunt deja tăiate! Redirectăm către Step 9...', { duration: 3000 });
          setIsTrimmingModalOpen(false);
          // Auto-redirect with countdown
          let countdown = 3;
          const countdownInterval = setInterval(() => {
            countdown--;
            if (countdown === 0) {
              clearInterval(countdownInterval);
              setCurrentStep(9);
            }
          }, 1000);
          return;
        } else {
          toast.error('Nu există videouri cu status "Recut" pentru tăiere!');
        }
      } else {
        toast.error('Nu există videouri pentru tăiere!');
      }
      setIsTrimmingModalOpen(false);
      return;
    }
    
    // Debug: Log lock state for all videos
    console.log('[DEBUG] Videos to trim - FULL OBJECTS:', videosToTrim);
    console.log('[DEBUG] Videos to trim - LOCK STATE:', videosToTrim.map(v => ({
      name: v.videoName,
      isStartLocked: v.isStartLocked,
      isEndLocked: v.isEndLocked,
      hasIsStartLocked: 'isStartLocked' in v,
      hasIsEndLocked: 'isEndLocked' in v
    })));
    
    // Validate that all videos have START and END locked
    const unlockedVideos = videosToTrim.filter(v => 
      !v.isStartLocked || !v.isEndLocked
    );
    
    console.log('[DEBUG] Unlocked videos:', unlockedVideos.map(v => ({
      name: v.videoName,
      isStartLocked: v.isStartLocked,
      isEndLocked: v.isEndLocked
    })));
    
    if (unlockedVideos.length > 0) {
      const unlockedNames = unlockedVideos.map(v => v.videoName).join('\n');
      
      toast.error(
        `❌ Următoarele videouri nu sunt locked:\n\n${unlockedNames}\n\nTe rog să blochezi START și END pentru toate videourile înainte de trimming!`,
        { duration: 8000 }
      );
      setIsTrimmingModalOpen(false);
      return;
    }
    
    console.log('[Trimming] Starting BATCH trim process for', videosToTrim.length, 'videos (max 10 parallel)');
    
    // Batch processing with max 10 parallel and retry logic
    const MAX_PARALLEL = 10;
    const MAX_RETRIES = 3;
    
    interface TrimJob {
      video: typeof videosToTrim[0];
      retries: number;
      status: 'pending' | 'processing' | 'success' | 'failed';
      error?: string;
    }
    
    const jobs: TrimJob[] = videosToTrim.map(video => ({
      video,
      retries: 0,
      status: 'pending' as const
    }));
    
    let successCount = 0;
    let failCount = 0;
    let activeJobs = 0;
    
    const processJob = async (job: TrimJob): Promise<void> => {
      if (job.status === 'success') return;
      
      job.status = 'processing';
      activeJobs++;
      
      // Update progress
      const completedCount = successCount + failCount;
      setTrimmingProgress({
        current: completedCount,
        total: videosToTrim.length,
        currentVideo: job.video.videoName,
        status: 'processing',
        message: `Trimming ${completedCount + 1}/${videosToTrim.length}...`
      });
      
      try {
        const trimStart = job.video.cutPoints?.startKeep || 0;
        const trimEnd = job.video.cutPoints?.endKeep || 0;
        
        console.log(`[Trimming] Processing ${job.video.videoName} (${completedCount + 1}/${videosToTrim.length})`);
        
        const result = await cutVideoMutation.mutateAsync({
          videoUrl: job.video.videoUrl!,
          videoName: job.video.videoName,
          startTimeMs: trimStart,
          endTimeMs: trimEnd,
          ffmpegApiKey: localCurrentUser.ffmpegApiKey || undefined
        });
        
        if (!result.success || !result.downloadUrl) {
          throw new Error('Failed to trim video');
        }
        
        setVideoResults(prev => prev.map(v =>
          v.videoName === job.video.videoName
            ? { 
                ...v, 
                trimmedVideoUrl: result.downloadUrl,
                recutStatus: null  // Reset status after regeneration
              }
            : v
        ));
        
        job.status = 'success';
        successCount++;
        console.log(`[Trimming] ✅ ${job.video.videoName} SUCCESS (${successCount}/${videosToTrim.length})`);
        
      } catch (error: any) {
        console.error(`[Trimming] ❌ ${job.video.videoName} FAILED (attempt ${job.retries + 1}):`, error);
        
        if (job.retries < MAX_RETRIES) {
          job.retries++;
          job.status = 'pending';
          console.log(`[Trimming] 🔄 Retrying ${job.video.videoName} (${job.retries}/${MAX_RETRIES})...`);
        } else {
          job.status = 'failed';
          job.error = error.message;
          failCount++;
          toast.error(`❌ ${job.video.videoName}: ${error.message} (failed after ${MAX_RETRIES} retries)`);
        }
      } finally {
        activeJobs--;
      }
    };
    
    // Process queue with max parallelism
    while (true) {
      const pendingJobs = jobs.filter(j => j.status === 'pending');
      
      if (pendingJobs.length === 0 && activeJobs === 0) break;
      
      while (pendingJobs.length > 0 && activeJobs < MAX_PARALLEL) {
        const job = pendingJobs.shift()!;
        processJob(job);
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Complete
    setTrimmingProgress({
      current: videosToTrim.length,
      total: videosToTrim.length,
      currentVideo: '',
      status: 'complete',
      message: `✅ Complete! Success: ${successCount}, Failed: ${failCount}`
    });
    
    console.log(`[Trimming] 🎉 COMPLETE! Success: ${successCount}, Failed: ${failCount}`);
    toast.success(`✂️ Trimming complete! ${successCount}/${videosToTrim.length} videos trimmed`);
    
    // Navigate to Step 9 after 2 seconds
    console.log('[Trimming] Setting timeout for redirect to Step 9...');
    setTimeout(() => {
      console.log('[Trimming] Timeout fired! Redirecting to Step 9...');
      setIsTrimmingModalOpen(false);
      setCurrentStep(9);
      console.log('[Trimming] Redirect complete!');
    }, 2000);
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
      
      return {
        id: `combo-${index}`,
        text: line.text,
        imageUrl: selectedImage.url,
        imageId: selectedImage.id,
        promptType: line.promptType, // Mapare automată inteligentă
        videoName: line.videoName,
        section: line.section,
        categoryNumber: line.categoryNumber,
        redStart: line.redStart,  // Copiază pozițiile red text din AdLine
        redEnd: line.redEnd,
      };
    });

    setCombinations(newCombinations);
    setDeletedCombinations([]);
    setCurrentStep(5); // Go to STEP 5 - Mapping
    
    console.log('[Create Mappings] Created', newCombinations.length, 'combinations from', textLines.length, 'text lines');
    console.log('[Create Mappings] First 3 texts:', textLines.slice(0, 3).map(l => l.text.substring(0, 50)));
    
    if (ctaImage && firstCTAIndex !== -1) {
      const ctaLinesCount = textLines.length - firstCTAIndex;
      toast.success(`${newCombinations.length} combinații create. Poza CTA mapata pe secțiunea CTA și toate liniile următoare (${ctaLinesCount} linii)`);
    } else {
      toast.success(`${newCombinations.length} combinații create cu mapare automată`);
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

        if (status === 'success') {
          toast.success(`Video #${index + 1} generat cu succes!`);
        } else if (status === 'failed') {
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

  // Auto-check status din 10 în 10 secunde de la început
  useEffect(() => {
    if (videoResults.length === 0) return;

    const pendingVideos = videoResults.filter(v => v.status === 'pending');
    if (pendingVideos.length === 0) return;

    // Check-uri din 5 în 5 secunde de la început
    const interval = setInterval(() => {
      const stillPending = videoResults.filter(v => v.status === 'pending');
      if (stillPending.length === 0) {
        clearInterval(interval);
        return;
      }

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
  }, [videoResults]);

  // Auto-check toate videouri pending când intri în STEP 6
  useEffect(() => {
    if (currentStep === 6 && videoResults.length > 0) {
      const pendingVideos = videoResults.filter(v => v.status === 'pending' && v.taskId);
      if (pendingVideos.length > 0) {
        console.log(`STEP 6: Auto-checking ${pendingVideos.length} pending videos...`);
        console.log('Pending video task IDs:', pendingVideos.map(v => v.taskId));
        
        pendingVideos.forEach((video, idx) => {
          const videoIndex = videoResults.findIndex(v => v.taskId === video.taskId);
          if (videoIndex !== -1 && video.taskId) {
            // Delay each check by 3s to give API time to respond
            setTimeout(() => {
              console.log(`STEP 6: Checking video #${idx + 1}/${pendingVideos.length} - Task ID: ${video.taskId}`);
              checkVideoStatus(video.taskId!, videoIndex);
            }, idx * 3000); // ← Changed from 1000ms to 3000ms
          }
        });
      }
    }
  }, [currentStep]);

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
  }, []);

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

  const goToCheckVideos = () => {
    setCurrentStep(7); // Go to STEP 7 - Check Videos
  };

  // Navigation
  const goToStep = (step: number) => {
    // Allow free navigation in both directions
    setCurrentStep(step);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 py-4 md:py-8 px-2 md:px-4">
      <div className="container max-w-6xl mx-auto">
        {/* User Dropdown - Top Right */}
        <div className="fixed top-2 right-2 md:top-4 md:right-4 z-50">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1.5 md:py-2 rounded-lg hover:bg-gray-100 transition-colors bg-white shadow-md">
                {localCurrentUser.profileImageUrl && (
                  <img
                    src={localCurrentUser.profileImageUrl}
                    alt="Profile"
                    className="w-6 h-6 md:w-8 md:h-8 rounded-full border border-gray-300 object-cover"
                  />
                )}
                {!localCurrentUser.profileImageUrl && (
                  <div className="w-6 h-6 md:w-8 md:h-8 rounded-full border border-gray-300 bg-gray-100 flex items-center justify-center">
                    <span className="text-gray-700 font-medium text-sm">
                      {localCurrentUser.username.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <span className="hidden md:inline text-sm font-medium text-gray-700">{localCurrentUser.username}</span>
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => setLocation("/images-library")} className="cursor-pointer">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Images Library
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLocation("/prompts-library")} className="cursor-pointer">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Prompts Library
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLocation("/category-management")} className="cursor-pointer">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                Category Management
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsEditProfileOpen(true)} className="cursor-pointer">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onLogout} className="cursor-pointer text-red-600">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      
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
        current={processingProgress.current}
        total={processingProgress.total}
        currentVideoName={processingProgress.currentVideoName}
        processingStep={processingStep}
      />
      
      {/* Trimming Modal for Step 8 → Step 9 */}
      <Dialog open={isTrimmingModalOpen} onOpenChange={(open) => {
        // Prevent closing during processing
        if (!open && trimmingProgress.status === 'processing') return;
        setIsTrimmingModalOpen(open);
      }}>
        <DialogContent className="max-w-md" onInteractOutside={(e) => {
          // Prevent closing by clicking outside during processing
          if (trimmingProgress.status === 'processing') e.preventDefault();
        }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-red-600" />
              ✂️ Tăiere Videouri cu FFmpeg API
            </DialogTitle>
            <DialogDescription>
              Tăiem fiecare video la timestamps-urile detectate...
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {trimmingProgress.status === 'processing' ? (
              <>
                {/* Progress Bar */}
                <div className="space-y-2">
                  <Progress 
                    value={(trimmingProgress.current / trimmingProgress.total) * 100} 
                    className="h-3"
                  />
                  <p className="text-center text-sm font-medium text-gray-700">
                    {trimmingProgress.current}/{trimmingProgress.total} videouri tăiate
                  </p>
                </div>
                
                {/* Current Video */}
                {trimmingProgress.current < trimmingProgress.total && trimmingProgress.currentVideo && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm font-semibold text-red-900 mb-1">
                      🎥 Video curent: {trimmingProgress.currentVideo}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-red-700">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      ✂️ Tăiere cu FFmpeg API...
                    </div>
                  </div>
                )}
                
                {/* Estimated Time */}
                {trimmingProgress.current < trimmingProgress.total && (
                  <p className="text-xs text-center text-gray-500">
                    ⏱️ Timp estimat rămas: ~{Math.ceil((trimmingProgress.total - trimmingProgress.current) * 10 / 60)} {Math.ceil((trimmingProgress.total - trimmingProgress.current) * 10 / 60) === 1 ? 'minut' : 'minute'}
                  </p>
                )}
              </>
            ) : trimmingProgress.status === 'complete' ? (
              <>
                {/* Success Message */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                  <p className="text-sm font-semibold text-green-900">
                    ✅ Toate videouri tăiate cu succes!
                  </p>
                  <p className="text-xs text-green-700 mt-1">
                    Deschidere Step 9...
                  </p>
                </div>
              </>
            ) : trimmingProgress.status === 'error' ? (
              <>
                {/* Error Message */}
                <div className="text-center space-y-3">
                  <div className="flex justify-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                      <X className="w-8 h-8 text-red-600" />
                    </div>
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-gray-900 mb-1">
                      Trimming failed
                    </p>
                    <p className="text-sm text-gray-600">
                      {trimmingProgress.message}
                    </p>
                  </div>
                </div>
              </>
            ) : null}
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
      
      {/* Sample Merge Modal */}
      <Dialog open={isSampleMergeModalOpen} onOpenChange={(open) => {
        setIsSampleMergeModalOpen(open);
        if (!open) {
          // Reset editing state when modal closes
          setEditingNoteId(null);
          setEditingNoteText('');
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              🎬 Sample Merge Video
            </DialogTitle>
            <DialogDescription>
              Preview all videos merged together (temporary - not saved to database)
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {!sampleMergedVideoUrl ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                <p className="text-sm text-gray-600">{sampleMergeProgress}</p>
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
                  src={sampleMergedVideoUrl}
                  controls
                  className="w-full rounded-lg border border-gray-300"
                  style={{ maxHeight: '400px' }}
                />
                
                {/* Video List with Notes */}
                <div className="border-t pt-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Videos in this merge:</h3>
                  <div className="space-y-2">
                    {sampleMergeVideos.map((video) => {
                      console.log('[Sample Merge Modal] Video name:', video.name, 'Editing name:', editingNoteId);
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
                                  onClick={async () => {
                                    try {
                                      // Save note
                                      const updatedVideos = sampleMergeVideos.map(v =>
                                        v.name === video.name ? { ...v, note: editingNoteText } : v
                                      );
                                      setSampleMergeVideos(updatedVideos);
                                      
                                      // Update in videoResults
                                      const updatedVideoResults = videoResults.map(v =>
                                        v.videoName === video.name ? { ...v, step9Note: editingNoteText } : v
                                      );
                                      setVideoResults(updatedVideoResults);
                                      
                                      // Save to database
                                      await saveVideoEditing.mutateAsync({
                                        contextSessionId: contextSession.id,
                                        videoResults: updatedVideoResults,
                                      });
                                      
                                      setEditingNoteId(null);
                                      setEditingNoteText('');
                                      toast.success('Note saved!');
                                    } catch (error) {
                                      console.error('[Sample Merge] Error saving note:', error);
                                      toast.error('Failed to save note');
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
                      );
                    })}
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
                setIsSampleMergeModalOpen(false);
                setSampleMergedVideoUrl(null);
                setSampleMergeProgress('');
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

        <div className="text-center mb-6 md:mb-12">
          <h1 className="text-2xl md:text-4xl font-bold text-blue-900 mb-2">A.I Ads Engine</h1>
          <p className="text-sm md:text-base text-blue-700">Generează videouri AI în masă cu Veo 3.1</p>
        </div>

        {/* Context Selector */}
        <div className="mb-6 md:mb-8 p-3 md:p-6 bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-300 rounded-xl shadow-lg">
          <div className="mb-4">
            <h2 className="text-lg md:text-2xl font-bold text-blue-900 mb-2 flex items-center gap-2">
              <span className="text-2xl md:text-3xl">🎯</span>
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
          
          {/* Context Status */}
          {selectedTamId && selectedCoreBeliefId && selectedEmotionalAngleId && selectedAdId && selectedCharacterId && (
            <div className="mt-4 p-4 bg-green-50 border border-green-300 rounded-lg">
              <p className="text-green-900 font-medium flex items-center gap-2">
                <span className="text-xl">✅</span>
                Context complete! You can now access all steps.
              </p>
            </div>
          )}
          
          {(!selectedTamId || !selectedCoreBeliefId || !selectedEmotionalAngleId || !selectedAdId || !selectedCharacterId) && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-300 rounded-lg">
              <p className="text-yellow-900 font-medium flex items-center gap-2">
                <span className="text-xl">⚠️</span>
                Please select all 5 categories to continue.
              </p>
            </div>
          )}
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

        {/* Breadcrumbs */}
        {selectedTamId && selectedCoreBeliefId && selectedEmotionalAngleId && selectedAdId && selectedCharacterId && (
        <div className="hidden md:flex justify-between items-center mb-8 px-4">
          {[
            { num: 1, label: "Prepare Ad", icon: FileText },
            { num: 2, label: "Text Ad", icon: FileText },
            { num: 3, label: "Prompts", icon: FileText },
            { num: 4, label: "Images", icon: ImageIcon },
            { num: 5, label: "Mapping", icon: MapIcon },
            { num: 6, label: "Generate", icon: Play },
            { num: 7, label: "Check Videos", icon: Video },
            { num: 8, label: "Video Editing", icon: Video },
            { num: 9, label: "Cut Videos", icon: Download },
          ].map((step, index) => (
            <div key={step.num} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <button
                  onClick={() => goToStep(step.num)}
                  className={`w-12 h-12 rounded-full flex items-center justify-center font-bold transition-all ${
                    currentStep >= step.num
                      ? "bg-blue-600 text-white cursor-pointer hover:bg-blue-700"
                      : "bg-gray-300 text-gray-600 cursor-pointer hover:bg-gray-400"
                  }`}
                >
                  {currentStep > step.num ? (
                    <Check className="w-6 h-6" />
                  ) : (
                    <step.icon className="w-6 h-6" />
                  )}
                </button>
                <span className={`text-sm mt-2 font-medium ${
                  currentStep >= step.num ? "text-blue-900" : "text-gray-500"
                }`}>
                  STEP {step.num}
                </span>
                <span className={`text-xs ${
                  currentStep >= step.num ? "text-blue-700" : "text-gray-400"
                }`}>
                  {step.label}
                </span>
              </div>
              {index < 8 && (
                <div
                  className={`h-1 flex-1 mx-2 transition-all ${
                    currentStep > step.num ? "bg-blue-600" : "bg-gray-200"
                  }`}
                />
              )}
            </div>          ))}
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

                  <Button
                    onClick={processText}
                    disabled={!rawTextAd || rawTextAd.trim().length === 0 || processTextAdMutation.isPending}
                    className="mt-4 bg-blue-600 hover:bg-blue-700"
                  >
                    {processTextAdMutation.isPending ? 'Processing...' : 'Process & Continue to STEP 2'}
                  </Button>
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
              {/* Document Source Selector */}
              <div className="mb-6">
                <Label className="text-blue-900 font-medium mb-3 block">Document Source:</Label>
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                  <Button
                    onClick={() => {
                      // Keep lines from STEP 1 - already in adLines
                      toast.success('Using lines inherited from STEP 1');
                    }}
                    variant={adDocument ? 'outline' : 'default'}
                    className={adDocument ? '' : 'bg-blue-600 hover:bg-blue-700'}
                    disabled={adLines.length === 0}
                  >
                    Inherited from STEP 1 {adLines.length > 0 && `(${adLines.filter(l => l.categoryNumber > 0).length} lines)`}
                  </Button>
                  <Button
                    onClick={() => {
                      document.getElementById('ad-upload')?.click();
                    }}
                    variant={adDocument ? 'default' : 'outline'}
                    className={adDocument ? 'bg-blue-600 hover:bg-blue-700' : ''}
                  >
                    Upload New Document
                  </Button>
                </div>
              </div>

              {/* Document Upload (only shown when Upload New Document is active) */}
              {!adDocument && adLines.length === 0 && (
                <div className="mb-6 p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-yellow-900 text-sm">
                    ⚠️ No lines available from STEP 1. Please upload a document or go back to STEP 1 to process text.
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
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-medium text-blue-900">
                      {adLines.filter(l => l.categoryNumber > 0).length} linii extrase:
                    </p>
                    {deletedLinesHistory.length > 0 && (
                      <Button
                        onClick={() => {
                          const lastDeleted = deletedLinesHistory[0];
                          setAdLines(prev => [...prev, lastDeleted]);
                          setDeletedLinesHistory(prev => prev.slice(1));
                          toast.success(`Linie restaurată: ${lastDeleted.videoName}`);
                        }}
                        variant="outline"
                        size="sm"
                        className="border-blue-300 text-blue-700 hover:bg-blue-50"
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                        </svg>
                        UNDO ({deletedLinesHistory.length})
                      </Button>
                    )}
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
                  <Button
                    onClick={() => setCurrentStep(3)}
                    className="mt-4 bg-blue-600 hover:bg-blue-700 px-6"
                  >
                    Continuă la STEP 3
                  </Button>
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
              <Button
                onClick={() => setCurrentStep(3)}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                Continuă la STEP 3
              </Button>
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
              <Button
                onClick={() => setCurrentStep(4)}
                className="mt-6 bg-blue-600 hover:bg-blue-700 w-full"
              >
                Continuă la STEP 4 - Images
              </Button>
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
                  onClick={() => setStep4ActiveTab('upload')}
                  className={`flex-1 py-3 px-6 font-semibold transition-all rounded-t-lg ${
                    step4ActiveTab === 'upload'
                      ? 'bg-blue-500 text-white border-b-4 border-blue-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  📤 Manual Upload
                </button>
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
                  className="bg-blue-600 hover:bg-blue-700 px-8 py-6 text-lg"
                >
                  Next: Create Mappings
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

              <Button
                onClick={generateVideos}
                disabled={generateBatchMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700 w-full py-6 text-lg"
              >
                {generateBatchMutation.isPending ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Se generează...
                  </>
                ) : (
                  <>
                    <Video className="w-5 h-5 mr-2" />
                    Generează {combinations.length} Videouri
                  </>
                )}
              </Button>
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
                                        className="text-sm min-h-[20px] resize-y"
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
              
              {/* Link Continue with Sample Videos (TEMP) - afișat întotdeauna */}
              <div className="mt-6 text-center">
                <button
                  onClick={loadSampleVideos}
                  className="text-sm text-gray-500 hover:text-gray-700 underline"
                >
                  Continue with Sample Videos (TEMP)
                </button>
                <p className="text-xs text-gray-400 mt-1">
                  Încărcă 6 task ID-uri sample pentru testare
                </p>
              </div>
              
              {/* Buton pentru a trece la STEP 7 */}
              {videoResults.some(v => v.status === 'success') && (
                <div className="mt-6">
                  <Button
                    onClick={goToCheckVideos}
                    className="bg-green-600 hover:bg-green-700 w-full py-6 text-lg"
                  >
                    <Check className="w-5 h-5 mr-2" />
                    Check Videos (Review)
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
              {/* Filtru videouri */}
              <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
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
                          <h4 className="font-bold text-green-900 mb-2 text-lg">{video.videoName}</h4>
                          
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
                
                {/* Mesaj pentru videouri fără decizie */}
                {videosWithoutDecision.length > 0 && (
                  <div className="bg-orange-50 border-2 border-orange-400 rounded p-4 mb-4">
                    <p className="text-orange-900 font-bold text-center">
                      ⚠️ Te rog să iei o decizie (Accept sau Regenerate) pentru toate videouri înainte de a continua.
                    </p>
                    <p className="text-sm text-orange-700 text-center mt-2">
                      {videosWithoutDecision.length} videouri fără decizie rămase
                    </p>
                  </div>
                )}
                
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
                  <div className="bg-yellow-50 border-2 border-yellow-300 rounded p-4 text-center">
                    <p className="text-yellow-800 font-medium">
                      ⚠️ {videosWithoutDecision.length} videouri fără decizie
                    </p>
                    <p className="text-sm text-yellow-700 mt-1">
                      Poți regenera videouri marcate chiar dacă nu ai luat decizie pentru toate.
                    </p>
                  </div>
                )}
              </div>
              
              {/* Buton Download All Accepted Videos */}
              {acceptedVideosWithUrl.length > 0 && (
                <div className="mt-8 p-4 bg-green-50 border-2 border-green-300 rounded-lg">
                  <p className="text-green-900 font-medium mb-3">
                    {acceptedCount} videouri acceptate
                  </p>
                  <Button
                    onClick={async () => {
                      const acceptedVideos = acceptedVideosWithUrl;
                      
                      if (acceptedVideos.length === 0) {
                        toast.error('Nu există videouri acceptate pentru download');
                        return;
                      }
                      
                      toast.info(`Se descarcă ${acceptedVideos.length} videouri...`);
                      
                      // Download fiecare video individual
                      for (const video of acceptedVideos) {
                        try {
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
                          
                          // Așteaptă puțin între download-uri pentru a nu suprasărcita browser-ul
                          await new Promise(resolve => setTimeout(resolve, 500));
                        } catch (error) {
                          console.error(`Eroare la download ${video.videoName}:`, error);
                          toast.error(`Eroare la download ${video.videoName}`);
                        }
                      }
                      
                      toast.success(`${acceptedVideos.length} videouri descărcate!`);
                    }}
                    className="w-full bg-green-600 hover:bg-green-700 py-6 text-lg"
                  >
                    <Download className="w-5 h-5 mr-2" />
                    Download All Accepted Videos ({acceptedVideosWithUrl.length})
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
                  
                  {/* Buton Video Editing - Step 8 */}
                  <div className="mt-4">
                    <Button
                      onClick={async () => {
                        // Filter only approved videos with videoUrl
                        const approvedVideos = videoResults.filter(v => 
                          v.reviewStatus === 'accepted' && 
                          v.status === 'success' && 
                          v.videoUrl
                        );
                        
                        if (approvedVideos.length === 0) {
                          toast.error('Nu există videouri acceptate cu URL valid pentru editare');
                          return;
                        }
                        
                        // VALIDATE: Check if videos have red text
                        const videosWithRedText = approvedVideos.filter(v => 
                          v.redStart !== undefined && 
                          v.redEnd !== undefined && 
                          v.redStart < v.redEnd
                        );
                        
                        if (videosWithRedText.length === 0) {
                          toast.error('❌ Nu există videouri cu text roșu detectat! Verifică Step 7.');
                          return;
                        }
                        
                        console.log(`[Video Editing] Starting batch processing for ${videosWithRedText.length} videos with red text`);
                        
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
                        
                        // Open ProcessingModal and start batch processing
                        setShowProcessingModal(true);
                        setProcessingProgress({ current: 0, total: videosWithRedText.length, currentVideoName: '' });
                        setProcessingStep(null);
                        
                        try {
                          await batchProcessVideosWithWhisper(videosWithRedText);
                          
                          // Close modal and go to Step 8
                          setShowProcessingModal(false);
                          setCurrentStep(8);
                          toast.success(`✅ ${videosWithRedText.length} videouri procesate cu succes!`);
                        } catch (error: any) {
                          console.error('[Video Editing] Batch processing error:', error);
                          setShowProcessingModal(false);
                          toast.error(`Eroare la procesarea videouri: ${error.message}`);
                        }
                      }}
                      className="w-full bg-purple-600 hover:bg-purple-700 py-6 text-lg"
                      disabled={acceptedVideosWithUrl.length === 0}
                    >
                      <Video className="w-5 h-5 mr-2" />
                      Video Editing ({acceptedVideosWithUrl.length} videouri)
                    </Button>
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
            approvedVideos = approvedVideos.filter(v => v.recutStatus === 'accepted');
          } else if (step8Filter === 'recut') {
            approvedVideos = approvedVideos.filter(v => v.recutStatus === 'recut');
          } else if (step8Filter === 'unlocked') {
            approvedVideos = approvedVideos.filter(v => !v.isStartLocked || !v.isEndLocked);
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
                <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
                  <label className="text-sm font-medium text-purple-900">Filtrează videouri:</label>
                  <select
                    value={step8Filter}
                    onChange={(e) => setStep8Filter(e.target.value as 'all' | 'accepted' | 'recut' | 'unlocked')}
                    className="px-4 py-2 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="all">Toate ({videoResults.filter(v => v.reviewStatus === 'accepted' && v.status === 'success' && v.videoUrl).length})</option>
                    <option value="accepted">Acceptate ({videoResults.filter(v => v.reviewStatus === 'accepted' && v.status === 'success' && v.videoUrl && v.recutStatus === 'accepted').length})</option>
                    <option value="recut">Necesită Retăiere ({videoResults.filter(v => v.reviewStatus === 'accepted' && v.status === 'success' && v.videoUrl && v.recutStatus === 'recut').length})</option>
                    <option value="unlocked">Fără Lock ({videoResults.filter(v => v.reviewStatus === 'accepted' && v.status === 'success' && v.videoUrl && (!v.isStartLocked || !v.isEndLocked)).length})</option>
                  </select>
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
                      const duration = video.whisperTranscript?.duration || 10; // Use actual audio duration
                      
                      return (
                        <div key={video.videoName} className="space-y-4">
                          {/* Display Notes from Step 7 and Step 9 */}
                          {(video.internalNote || video.step9Note) && (
                            <div className="space-y-2">
                              {video.internalNote && (
                                <div className="p-3 bg-blue-50 border border-blue-300 rounded">
                                  <p className="text-sm text-gray-700">
                                    <strong className="text-blue-900">Step 7 Note:</strong> {video.internalNote}
                                  </p>
                                </div>
                              )}

                            </div>
                          )}
                          
                          <VideoEditorV2
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
                            nextVideo={videoIndex < approvedVideos.length - 1 ? {
                              videoName: approvedVideos[videoIndex + 1].videoName,
                              videoUrl: approvedVideos[videoIndex + 1].videoUrl!,
                              cutPoints: approvedVideos[videoIndex + 1].cutPoints || { startKeep: 0, endKeep: 10000 },
                            } : null}
                            onCutAndMerge={async (video1, video2) => {
                              console.log('[Cut & Merge] Starting merge:', video1.videoName, '+', video2.videoName);
                              
                              setIsMergeModalOpen(true);
                              setMergeProgress('Uploading videos to FFmpeg API...');
                              
                              try {
                                // Extract original URLs from proxy URLs
                                const extractOriginalUrl = (proxyUrl: string) => {
                                  if (proxyUrl.startsWith('/api/proxy-video?url=')) {
                                    const urlParam = new URLSearchParams(proxyUrl.split('?')[1]).get('url');
                                    return urlParam ? decodeURIComponent(urlParam) : proxyUrl;
                                  }
                                  return proxyUrl;
                                };
                                
                                const video1OriginalUrl = extractOriginalUrl(video1.videoUrl);
                                const video2OriginalUrl = extractOriginalUrl(video2.videoUrl);
                                
                                console.log('[Cut & Merge] Original URLs:', {
                                  video1: video1OriginalUrl,
                                  video2: video2OriginalUrl,
                                });
                                
                                const result = await cutAndMergeMutation.mutateAsync({
                                  video1Url: video1OriginalUrl,
                                  video1Name: video1.videoName,
                                  video1StartMs: video1.cutPoints.startKeep,
                                  video1EndMs: video1.cutPoints.endKeep,
                                  video2Url: video2OriginalUrl,
                                  video2Name: video2.videoName,
                                  video2StartMs: video2.cutPoints.startKeep,
                                  video2EndMs: video2.cutPoints.endKeep,
                                  ffmpegApiKey: localCurrentUser.ffmpegApiKey || '',
                                });
                                
                                if (result.success && result.downloadUrl) {
                                  setMergedVideoUrl(result.downloadUrl);
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
                            onTrimChange={(videoId, cutPoints, isStartLocked, isEndLocked) => {
                            // Update local state when user adjusts trim markers or lock state
                            // videoId is actually videoName (unique identifier)
                            console.log('[DEBUG onTrimChange]', {
                              videoId,
                              cutPoints,
                              isStartLocked,
                              isEndLocked,
                              matchingVideo: videoResults.find(v => v.videoName === videoId)?.videoName
                            });
                            
                            const updatedVideoResults = videoResults.map(v =>
                              v.videoName === videoId
                                ? { 
                                    ...v, 
                                    cutPoints,
                                    isStartLocked: isStartLocked,
                                    isEndLocked: isEndLocked,
                                  }
                                : v
                            );
                            
                            setVideoResults(updatedVideoResults);
                            
                            // Immediate save to database
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
                                  console.log('[VideoEditorV2] Lock state saved to DB immediately');
                                },
                              });
                            }
                          }}
                          />
                        </div>
                      );
                    })}

                    {/* Navigation Buttons */}
                    <div className="flex flex-col gap-3">
                      <div className="flex gap-4">
                        <Button
                          onClick={() => setCurrentStep(7)}
                          variant="outline"
                          className="flex-1"
                        >
                          Înapoi la Step 7
                        </Button>

                        {/* Buton TRIM ALL VIDEOS - va trimite la FFmpeg API pentru cutting */}
                        <Button
                          onClick={() => {
                            // Open trimming modal
                            setIsTrimmingModalOpen(true);
                            // Start trimming process
                            handleTrimAllVideos();
                          }}
                          className="flex-1 bg-red-600 hover:bg-red-700"
                        >
                          {(() => {
                            const hasTrimmedVideos = videoResults.some(v => v.trimmedVideoUrl);
                            if (hasTrimmedVideos) {
                              // Show recut count
                              const recutCount = approvedVideos.filter(v => v.recutStatus === 'recut').length;
                              return `✂️ TRIM ALL VIDEOS (${recutCount})`;
                            } else {
                              // Show all approved count
                              return `✂️ TRIM ALL VIDEOS (${approvedVideos.length})`;
                            }
                          })()}
                        </Button>
                      </div>
                      
                      {/* Check Videos button - only show if we have trimmed videos */}
                      {videoResults.some(v => v.trimmedVideoUrl) && (
                        <Button
                          onClick={() => setCurrentStep(9)}
                          className="w-full bg-green-600 hover:bg-green-700 text-white"
                        >
                          👁️ Check Videos (Step 9)
                        </Button>
                      )}
                      
                      {/* Sample Merge Video button - merge all approved videos */}
                      {approvedVideos.length > 1 && (
                        <Button
                          onClick={async () => {
                            console.log('[Sample Merge] Starting...');
                            
                            // Prepare video list with notes
                            const videoList = approvedVideos.map(v => ({
                              name: v.videoName,
                              note: v.step9Note || ''
                            }));
                            
                            setSampleMergeVideos(videoList);
                            setIsSampleMergeModalOpen(true);
                            
                            try {
                              // Extract original URLs
                              const extractOriginalUrl = (url: string) => {
                                if (url.startsWith('/api/proxy-video?url=')) {
                                  const urlParam = new URLSearchParams(url.split('?')[1]).get('url');
                                  return urlParam ? decodeURIComponent(urlParam) : url;
                                }
                                return url;
                              };
                              
                              const videos = approvedVideos.map(v => ({
                                url: extractOriginalUrl(v.videoUrl),
                                name: v.videoName,
                                startMs: v.cutPoints?.startKeep || 0,
                                endMs: v.cutPoints?.endKeep || 0,
                              }));
                              
                              // Create hash of videos to check if they changed
                              const videosHash = JSON.stringify(videos.map(v => ({
                                name: v.name,
                                startMs: v.startMs,
                                endMs: v.endMs
                              })));
                              
                              // Check cache: if videos haven't changed, skip recut
                              if (videosHash === lastMergedVideosHash && sampleMergedVideoUrl) {
                                console.log('[Sample Merge] Using cached video (no changes detected)');
                                setSampleMergeProgress('');
                                return;
                              }
                              
                              console.log('[Sample Merge] Videos changed or first run, re-cutting and merging...');
                              setSampleMergedVideoUrl(null);
                              setSampleMergeProgress('Preparing videos...');
                              
                              console.log('[Sample Merge] Videos:', videos);
                              setSampleMergeProgress(`Uploading ${videos.length} videos to FFmpeg API...`);
                              
                              const result = await cutAndMergeAllMutation.mutateAsync({
                                videos,
                                ffmpegApiKey: localCurrentUser.ffmpegApiKey || '',
                              });
                              
                              console.log('[Sample Merge] Success!', result);
                              setSampleMergedVideoUrl(result.downloadUrl);
                              setLastMergedVideosHash(videosHash);
                              setSampleMergeProgress('');
                            } catch (error) {
                              console.error('[Sample Merge] Error:', error);
                              setSampleMergeProgress(`Error: ${error.message}`);
                              toast.error(`Sample merge failed: ${error.message}`);
                            }
                          }}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white mt-3"
                        >
                          🎬 Sample Merge Video
                        </Button>
                      )}
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
                    {/* Filter and UNDO */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
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
                              ref={(el) => {
                                if (el && !el.dataset.initialized) {
                                  el.dataset.initialized = 'true';
                                  const timeDisplay = el.nextElementSibling as HTMLElement;
                                  if (timeDisplay) {
                                    el.addEventListener('timeupdate', () => {
                                      const current = el.currentTime.toFixed(3);
                                      const duration = el.duration ? el.duration.toFixed(3) : '0.000';
                                      timeDisplay.textContent = `${current}s / ${duration}s`;
                                    });
                                    el.addEventListener('loadedmetadata', () => {
                                      const duration = el.duration.toFixed(3);
                                      timeDisplay.textContent = `0.000s / ${duration}s`;
                                    });
                                  }
                                }
                              }}
                              src={video.trimmedVideoUrl}
                              className="absolute top-0 left-0 w-full h-full object-contain"
                              controls
                              playsInline
                            />
                            {/* Time display overlay */}
                            <div className="absolute bottom-12 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded font-mono">
                              0.000s / 0.000s
                            </div>
                          </div>
                          
                          {/* Video Text */}
                          {video.text && (
                            <p className="text-xs text-gray-700 mb-3 text-center">
                              {video.redStart !== undefined && video.redEnd !== undefined ? (
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
                          )}
                          
                          {/* Trim Info */}
                          <div className="text-xs text-gray-600 mb-3 text-center">
                            <p>✂️ Trimmed: {((video.cutPoints?.startKeep || 0) / 1000).toFixed(3)}s → {((video.cutPoints?.endKeep || 0) / 1000).toFixed(3)}s</p>
                            <p>Duration: {(((video.cutPoints?.endKeep || 0) - (video.cutPoints?.startKeep || 0)) / 1000).toFixed(3)}s</p>
                          </div>
                          
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
                          
                          {/* Download Button */}
                          <Button
                            onClick={() => {
                              const link = document.createElement('a');
                              link.href = video.trimmedVideoUrl!;
                              link.download = `${video.videoName}.mp4`;
                              link.click();
                            }}
                            className="w-full bg-blue-600 hover:bg-blue-700"
                            size="sm"
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Download
                          </Button>
                        </div>
                      ))}
                    </div>
                    
                    {/* Navigation Buttons */}
                    <div className="flex gap-4 mt-6">
                      <Button
                        onClick={() => setCurrentStep(8)}
                        variant="outline"
                        className="flex-1"
                      >
                        Înapoi la Step 8
                      </Button>
                      
                      <Button
                        onClick={() => {
                          toast.success('🎉 Workflow complet! Toate videoclipurile sunt gata.');
                        }}
                        className="flex-1 bg-green-600 hover:bg-green-700"
                      >
                        <Check className="w-4 h-4 mr-2" />
                        Finalizare
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })()}
        </>
        )}
      </div>
    </div>
  );
}
