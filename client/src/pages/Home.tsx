import { useState, useEffect, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import EditProfileModal from '@/components/EditProfileModal';
import { ImagesLibraryModal } from '@/components/ImagesLibraryModal';
import { trpc } from '../lib/trpc';
import mammoth from 'mammoth';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Upload, X, Check, Loader2, Video, FileText, Image as ImageIcon, Map, Play, Download, Undo2, ChevronLeft, RefreshCw, Clock, Search } from "lucide-react";

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
}

interface VideoResult {
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
}

interface HomeProps {
  currentUser: { id: number; username: string; profileImageUrl: string | null };
  onLogout: () => void;
}

export default function Home({ currentUser, onLogout }: HomeProps) {
  const [, setLocation] = useLocation();
  
  // Step 1: Categories
  const [selectedTamId, setSelectedTamId] = useState<number | null>(null);
  const [selectedCoreBeliefId, setSelectedCoreBeliefId] = useState<number | null>(null);
  const [selectedEmotionalAngleId, setSelectedEmotionalAngleId] = useState<number | null>(null);
  const [selectedAdId, setSelectedAdId] = useState<number | null>(null);
  const [selectedCharacterId, setSelectedCharacterId] = useState<number | null>(null);
  const [textAdMode, setTextAdMode] = useState<'upload' | 'paste'>('upload');
  const [rawTextAd, setRawTextAd] = useState<string>('');
  const [processedTextAd, setProcessedTextAd] = useState<string>('');
  
  // Step 2: Text Ad Document (moved from STEP 1)
  const [adDocument, setAdDocument] = useState<File | null>(null);
  const [adLines, setAdLines] = useState<AdLine[]>([]);
  
  // Step 2: Prompts (3 prompts)
  const [prompts, setPrompts] = useState<UploadedPrompt[]>([]);
  const [useHardcodedPrompts, setUseHardcodedPrompts] = useState(true);
  
  // Step 3: Images
  const [images, setImages] = useState<UploadedImage[]>([]);
  
  // Step 4: Mapping
  const [combinations, setCombinations] = useState<Combination[]>([]);
  const [deletedCombinations, setDeletedCombinations] = useState<Combination[]>([]);
  
  // Step 5: Generate
  const [videoResults, setVideoResults] = useState<VideoResult[]>([]);
  const [modifyingVideoIndex, setModifyingVideoIndex] = useState<number | null>(null);
  const [modifyPromptType, setModifyPromptType] = useState<PromptType>('PROMPT_NEUTRAL');
  const [modifyPromptText, setModifyPromptText] = useState('');
  const [modifyDialogueText, setModifyDialogueText] = useState('');
  
  // State pentru custom prompts (fiecare video poate avea propriul custom prompt)
  const [customPrompts, setCustomPrompts] = useState<Record<number, string>>({});
  
  // State pentru filtru STEP 6 (show all / accepted / failed)
  const [videoFilter, setVideoFilter] = useState<'all' | 'accepted' | 'failed'>('all');
  
  // State pentru filtru STEP 5 (show all / accepted / regenerate)
  const [step5Filter, setStep5Filter] = useState<'all' | 'accepted' | 'regenerate'>('all');
  
  // State pentru edit timestamps (când user dă SAVE în Modify & Regenerate)
  const [editTimestamps, setEditTimestamps] = useState<Record<number, number>>({});
  
  // State pentru regenerări multiple
  const [multipleRegenerations, setMultipleRegenerations] = useState(false); // Da/Nu
  const [regenerationCount, setRegenerationCount] = useState(1); // 1-10
  const [regenerationVariants, setRegenerationVariants] = useState<Array<{
    promptType: PromptType;
    promptText: string;
    dialogueText: string;
    imageUrl: string;
  }>>([]);
  const [currentTime, setCurrentTime] = useState(Date.now());
  
  // State pentru tracking modificări (pentru blocare navigare)
  const [hasModifications, setHasModifications] = useState(false);
  
  // Step 2: Manual prompt textarea
  const [manualPromptText, setManualPromptText] = useState('');
  const [promptMode, setPromptMode] = useState<'hardcoded' | 'custom' | 'manual'>('hardcoded');
  
  // Update currentTime la fiecare minut pentru "Edited X min ago"
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 60000); // Update la fiecare 60 secunde
    
    return () => clearInterval(interval);
  }, []);
  
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
  
  // Current step
  const [currentStep, setCurrentStep] = useState(1);
  
  // Session management
  const [currentSessionId, setCurrentSessionId] = useState<string>('default');
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  
  // Edit Profile modal
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [localCurrentUser, setLocalCurrentUser] = useState(currentUser);
  
  // Images Library modal
  const [isImagesLibraryOpen, setIsImagesLibraryOpen] = useState(false);
  const [librarySearchQuery, setLibrarySearchQuery] = useState("");
  const [libraryCharacterFilter, setLibraryCharacterFilter] = useState<string>("all");
  const [selectedLibraryImages, setSelectedLibraryImages] = useState<number[]>([]);
  
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
  
  // Auto-restore session la mount
  useEffect(() => {
    try {
      const savedSession = localStorage.getItem('kie-video-generator-session');
      if (savedSession) {
        const session = JSON.parse(savedSession);
        
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
        
        toast.success('Sesiune restaurată!');
      }
    } catch (error) {
      console.error('Eroare la restore session:', error);
      toast.error('Eroare la restaurare sesiune');
    } finally {
      setIsRestoringSession(false);
    }
  }, []);
  
  // Load data from context session when context changes
  useEffect(() => {
    if (contextSession) {
      console.log('[Context Session] Loading data:', contextSession);
      
      // Load all workflow data from context session
      if (contextSession.currentStep) setCurrentStep(contextSession.currentStep);
      if (contextSession.rawTextAd) setRawTextAd(contextSession.rawTextAd);
      if (contextSession.processedTextAd) setProcessedTextAd(contextSession.processedTextAd);
      if (contextSession.adLines) setAdLines(contextSession.adLines as AdLine[]);
      if (contextSession.prompts) setPrompts(contextSession.prompts as UploadedPrompt[]);
      if (contextSession.images) setImages(contextSession.images as UploadedImage[]);
      if (contextSession.combinations) setCombinations(contextSession.combinations as Combination[]);
      if (contextSession.deletedCombinations) setDeletedCombinations(contextSession.deletedCombinations as Combination[]);
      if (contextSession.videoResults) setVideoResults(contextSession.videoResults as VideoResult[]);
      if (contextSession.reviewHistory) setReviewHistory(contextSession.reviewHistory as any[]);
      
      toast.success('Context data loaded!');
    } else if (selectedTamId && selectedCoreBeliefId && selectedEmotionalAngleId && selectedAdId && selectedCharacterId) {
      // Context selected but no session exists - clear all data
      console.log('[Context Session] No session found, clearing data');
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
  }, [contextSession, selectedTamId, selectedCoreBeliefId, selectedEmotionalAngleId, selectedAdId, selectedCharacterId]);
  
  // Auto-save session la fiecare schimbare (debounced)
  useEffect(() => {
    if (isRestoringSession) return; // Nu salva în timpul restore
    
    const timeoutId = setTimeout(() => {
      try {
        const session = {
          currentStep,
          adLines,
          prompts: prompts.map(p => ({ ...p, file: null })), // Exclude File objects
          images,
          combinations,
          deletedCombinations,
          videoResults,
          reviewHistory,
          selectedVideoIndex,
          regenerateMultiple,
          regenerateVariantCount,
          regenerateVariants,
          timestamp: new Date().toISOString(),
        };
        
        localStorage.setItem('kie-video-generator-session', JSON.stringify(session));
      } catch (error) {
        console.error('Eroare la save session:', error);
      }
    }, 1000); // Debounce 1 secundă
    
    return () => clearTimeout(timeoutId);
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
  useEffect(() => {
    if (!selectedTamId || !selectedCoreBeliefId || !selectedEmotionalAngleId || !selectedAdId || !selectedCharacterId) {
      return; // Don't save if context not complete
    }
    
    if (isRestoringSession) return; // Don't save during restore
    
    const timeoutId = setTimeout(() => {
      console.log('[Context Session] Auto-saving...');
      
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
    }, 2000); // Debounce 2 seconds
    
    return () => clearTimeout(timeoutId);
  }, [
    selectedCoreBeliefId,
    selectedEmotionalAngleId,
    selectedAdId,
    selectedCharacterId,
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
  
  // Auto-select first Character when Characters are loaded
  useEffect(() => {
    if (categoryCharacters.length > 0 && !selectedCharacterId) {
      console.log('[Auto-select] Setting first Character:', categoryCharacters[0].name);
      setSelectedCharacterId(categoryCharacters[0].id);
    }
  }, [categoryCharacters, selectedCharacterId]);

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
    () => videoResults.filter(v => v.reviewStatus === 'regenerate'),
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
  const step6FilteredVideos = useMemo(() => {
    if (videoFilter === 'all') return videoResults;
    if (videoFilter === 'accepted') return acceptedVideos;
    if (videoFilter === 'failed') return failedVideos;
    return videoResults;
  }, [videoFilter, videoResults, acceptedVideos, failedVideos]);
  
  // Videos fără decizie (pentru statistici STEP 6)
  const videosWithoutDecision = useMemo(
    () => videoResults.filter(v => !v.reviewStatus),
    [videoResults]
  );
  
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
        toast.success('Text file loaded!');
      } else if (file.name.endsWith('.docx') || file.name.endsWith('.doc')) {
        try {
          const arrayBuffer = await file.arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer });
          setRawTextAd(result.value);
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
        toast.success('Text file loaded!');
      } else if (file.name.endsWith('.docx') || file.name.endsWith('.doc')) {
        try {
          const arrayBuffer = await file.arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer });
          setRawTextAd(result.value);
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
      const uploadPromises = imageFiles.map(async (file) => {
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
      toast.success(`${uploadedImages.length} imagini încărcate`);
    } catch (error: any) {
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

    // Găsește poza CTA (dacă există)
    const ctaImage = images.find(img => img.isCTA);
    const defaultImage = images[0];
    
    // Găsește prima linie cu "carte", "cartea", "rescrie", sau "lacrimi" (cu sau fără diacritice)
    let firstCarteIndex = -1;
    const ctaKeywords = ['carte', 'cartea', 'rescrie', 'lacrimi', 'lacrami'];
    for (let i = 0; i < adLines.length; i++) {
      const lowerText = adLines[i].text.toLowerCase();
      if (ctaKeywords.some(keyword => lowerText.includes(keyword))) {
        firstCarteIndex = i;
        break;
      }
    }

    // Filter out labels (categoryNumber === 0) - only use actual text lines
    const textLines = adLines.filter(line => line.categoryNumber > 0);
    
    // Găsește prima linie cu "carte" în textLines (nu în adLines care include labels)
    firstCarteIndex = -1;
    for (let i = 0; i < textLines.length; i++) {
      const lowerText = textLines[i].text.toLowerCase();
      if (ctaKeywords.some(keyword => lowerText.includes(keyword))) {
        firstCarteIndex = i;
        break;
      }
    }
    
    // Crează combinații cu mapare inteligentă CTA
    const newCombinations: Combination[] = textLines.map((line, index) => {
      let selectedImage = defaultImage;
      
      // Dacă există poză CTA, verifică dacă LINIA CURENTĂ conține keywords CTA
      if (ctaImage) {
        const lowerText = line.text.toLowerCase();
        const hasCTAKeyword = ctaKeywords.some(keyword => lowerText.includes(keyword));
        
        if (hasCTAKeyword) {
          selectedImage = ctaImage;
        }
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
      };
    });

    setCombinations(newCombinations);
    setDeletedCombinations([]);
    setCurrentStep(5); // Go to STEP 5 - Mapping
    
    console.log('[Create Mappings] Created', newCombinations.length, 'combinations from', textLines.length, 'text lines');
    console.log('[Create Mappings] First 3 texts:', textLines.slice(0, 3).map(l => l.text.substring(0, 50)));
    
    // Count how many lines got CTA image
    const ctaLinesCount = newCombinations.filter(c => c.imageId === ctaImage?.id).length;
    
    if (ctaImage && ctaLinesCount > 0) {
      toast.success(`${newCombinations.length} combinații create. Poza CTA mapata pe ${ctaLinesCount} linii cu keywords CTA`);
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

      // Generează pentru fiecare tip de prompt
      const allResults: VideoResult[] = [];

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

        const result = await generateBatchMutation.mutateAsync({
          userId: currentUser.id,
          promptTemplate: promptTemplate,
          combinations: combos.map(combo => ({
            text: combo.text,
            imageUrl: combo.imageUrl,
          })),
        });

        const batchResults: VideoResult[] = result.results.map((r: any, index: number) => {
          const combo = combos[index];
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
          };
        });

        allResults.push(...batchResults);
      }

      setVideoResults(allResults);
      const successCount = allResults.filter(r => r.status === 'pending').length;
      const failedCount = allResults.filter(r => r.status === 'failed').length;

      toast.success(`${successCount} videouri trimise spre generare`);
      
      if (failedCount > 0) {
        toast.error(`${failedCount} videouri au eșuat`);
      }
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
  
  // Regenerare toate videouri failed
  const regenerateAllFailed = async () => {
    const failedIndexes = videoResults
      .map((v, i) => ({ video: v, index: i }))
      .filter(({ video }) => video.status === 'failed')
      .map(({ index }) => index);
    
    if (failedIndexes.length === 0) {
      toast.error('Nu există videouri failed de regenerat');
      return;
    }

    try {
      toast.info(`Se retrimite ${failedIndexes.length} videouri...`);
      
      // Grupează pe tip de prompt
      const combinationsByPrompt: Record<PromptType, Array<{ combo: typeof combinations[0], index: number }>> = {
        PROMPT_NEUTRAL: [],
        PROMPT_SMILING: [],
        PROMPT_CTA: [],
        PROMPT_CUSTOM: [],
      };

      failedIndexes.forEach(index => {
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

  // Regenerare video cu modificări (Modify & Regenerate)
  const regenerateWithModifications = async (index: number) => {
    const combo = combinations[index];
    
    if (!combo) {
      toast.error('Combinație nu găsită');
      return;
    }

    // Validare text (nu mai blochez dacă > 125 caractere)
    // User poate genera chiar dacă depășește 125 caractere

    if (modifyDialogueText.trim().length === 0) {
      toast.error('Textul nu poate fi gol!');
      return;
    }

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
          text: modifyDialogueText, // Folosește textul modificat
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
      
      // Actualizează videoResults cu noul taskId
      setVideoResults(prev =>
        prev.map((v, i) =>
          i === index
            ? {
                ...v,
                taskId: newResult.taskId,
                status: newResult.success ? 'pending' as const : 'failed' as const,
                error: newResult.error,
                videoUrl: undefined, // Reset videoUrl
              }
            : v
        )
      );

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

    // Check-uri din 10 în 10 secunde de la început
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
    }, 10000);

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
    if (step <= currentStep) {
      setCurrentStep(step);
    }
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 py-8">
      <div className="container max-w-6xl">
        {/* User Dropdown - Top Right */}
        <div className="fixed top-4 right-4 z-50">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors">
                {localCurrentUser.profileImageUrl && (
                  <img
                    src={localCurrentUser.profileImageUrl}
                    alt="Profile"
                    className="w-8 h-8 rounded-full border border-gray-300 object-cover"
                  />
                )}
                {!localCurrentUser.profileImageUrl && (
                  <div className="w-8 h-8 rounded-full border border-gray-300 bg-gray-100 flex items-center justify-center">
                    <span className="text-gray-700 font-medium text-sm">
                      {localCurrentUser.username.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <span className="text-sm font-medium text-gray-700">{localCurrentUser.username}</span>
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
      
      {/* Images Library Modal */}
      <ImagesLibraryModal
        open={isImagesLibraryOpen}
        onClose={() => setIsImagesLibraryOpen(false)}
        userId={localCurrentUser.id}
      />

        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-blue-900 mb-2">A.I Ads Engine</h1>
          <p className="text-blue-700">Generează videouri AI în masă cu Veo 3.1</p>
        </div>

        {/* Context Selector */}
        <div className="mb-8 p-6 bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-300 rounded-xl shadow-lg">
          <div className="mb-4">
            <h2 className="text-2xl font-bold text-blue-900 mb-2 flex items-center gap-2">
              <span className="text-3xl">🎯</span>
              Select Your Working Context
            </h2>
            <p className="text-sm text-gray-600">Choose all 5 categories to start working. This context will apply to all steps.</p>
          </div>
          
          <div className="grid grid-cols-5 gap-4">
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
                    <SelectItem key={tam.id} value={tam.id.toString()}>{tam.id}. {tam.name}</SelectItem>
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
                  {coreBeliefs.map((cb) => (
                    <SelectItem key={cb.id} value={cb.id.toString()}>{cb.id}. {cb.name}</SelectItem>
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
                  {emotionalAngles.map((ea) => (
                    <SelectItem key={ea.id} value={ea.id.toString()}>{ea.id}. {ea.name}</SelectItem>
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
                  {ads.map((ad) => (
                    <SelectItem key={ad.id} value={ad.id.toString()}>{ad.id}. {ad.name}</SelectItem>
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
                    setSelectedCharacterId(parseInt(value));
                  }
                }}
              >
                <SelectTrigger className="w-full bg-white">
                  <SelectValue placeholder="Select Character" />
                </SelectTrigger>
                <SelectContent>
                  {categoryCharacters.map((char) => (
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
        <div className="flex justify-between items-center mb-8 px-4">
          {[
            { num: 1, label: "Prepare Ad", icon: FileText },
            { num: 2, label: "Text Ad", icon: FileText },
            { num: 3, label: "Prompts", icon: FileText },
            { num: 4, label: "Images", icon: ImageIcon },
            { num: 5, label: "Mapping", icon: Map },
            { num: 6, label: "Generate", icon: Play },
            { num: 7, label: "Check\u00A0Videos", icon: Video },
          ].map((step, index) => (
            <div key={step.num} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <button
                  onClick={() => goToStep(step.num)}
                  disabled={step.num > currentStep}
                  className={`w-12 h-12 rounded-full flex items-center justify-center font-bold transition-all ${
                    currentStep >= step.num
                      ? "bg-blue-600 text-white cursor-pointer hover:bg-blue-700"
                      : "bg-gray-200 text-gray-500 cursor-not-allowed"
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
              {index < 5 && (
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
            <CardContent className="pt-8 px-8 pb-8">
              {/* Context Info */}
              <div className="mb-6 p-4 bg-blue-50/50 border-2 border-blue-200 rounded-lg">
                <h3 className="text-lg font-semibold text-blue-900 mb-4">Current Context</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
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
                        {categoryCharacters.map((char) => (
                          <SelectItem key={char.id} value={char.id.toString()}>{char.name}</SelectItem>
                        ))}
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
                    <Select value={textAdMode} onValueChange={(value: 'upload' | 'paste') => setTextAdMode(value)}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="upload">Upload Ad</SelectItem>
                        <SelectItem value="paste">Paste Ad</SelectItem>
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
                        <Upload className="w-12 h-12 text-blue-500 mx-auto mb-4" />
                        <p className="text-blue-900 font-medium mb-2">
                          {rawTextAd ? 'Text loaded! Click to change' : 'Drop text file here or click to upload'}
                        </p>
                        <p className="text-sm text-gray-500 italic">Suportă .txt, .doc, .docx</p>
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
                          <p className="text-sm text-gray-600 whitespace-pre-wrap">{rawTextAd.substring(0, 200)}{rawTextAd.length > 200 ? '...' : ''}</p>
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
            <CardContent className="pt-6">
              {/* Document Source Selector */}
              <div className="mb-6">
                <Label className="text-blue-900 font-medium mb-3 block">Document Source:</Label>
                <div className="flex gap-4">
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
                  <p className="font-medium text-blue-900 mb-3">
                    {adLines.filter(l => l.categoryNumber > 0).length} linii extrase:
                  </p>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
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
                        <div key={line.id} className="p-3 bg-white rounded border border-blue-200 text-sm ml-4 relative">
                          {/* Edit Button */}
                          <Button
                            onClick={() => {
                              setEditingLineId(line.id);
                              setEditingLineText(line.text);
                              setEditingLineRedStart(line.redStart ?? -1);
                              setEditingLineRedEnd(line.redEnd ?? -1);
                            }}
                            variant="outline"
                            size="sm"
                            className="absolute top-2 right-2"
                          >
                            Edit
                          </Button>
                          
                          {/* Name above text in italic small font */}
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
                          {/* Character count below text */}
                          <div className="text-xs text-gray-500">
                            {line.charCount} caractere
                          </div>
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

        {/* WYSIWYG Editor Dialog */}
        <Dialog open={editingLineId !== null} onOpenChange={(open) => !open && setEditingLineId(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Edit Text Line</DialogTitle>
              <DialogDescription>
                Select text and apply RED or BLACK color. Character count updates live.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* Color Toolbar */}
              <div className="flex gap-2 p-2 bg-gray-100 rounded">
                <Button
                  onClick={() => {
                    document.execCommand('foreColor', false, '#dc2626'); // RED-600
                  }}
                  variant="outline"
                  size="sm"
                  className="bg-red-600 text-white hover:bg-red-700"
                >
                  RED
                </Button>
                <Button
                  onClick={() => {
                    document.execCommand('foreColor', false, '#000000'); // BLACK
                  }}
                  variant="outline"
                  size="sm"
                  className="bg-black text-white hover:bg-gray-800"
                >
                  BLACK
                </Button>
                <Button
                  onClick={() => {
                    document.execCommand('removeFormat', false, '');
                  }}
                  variant="outline"
                  size="sm"
                >
                  Clear Format
                </Button>
              </div>
              
              {/* Editable Content */}
              <div
                contentEditable
                suppressContentEditableWarning
                onInput={(e) => {
                  const text = e.currentTarget.textContent || '';
                  setEditingLineText(text);
                }}
                className="min-h-[150px] p-4 border-2 border-gray-300 rounded focus:outline-none focus:border-blue-500"
                style={{ whiteSpace: 'pre-wrap' }}
                dangerouslySetInnerHTML={{
                  __html: (() => {
                    if (editingLineRedStart >= 0 && editingLineRedEnd > editingLineRedStart) {
                      const before = editingLineText.substring(0, editingLineRedStart);
                      const red = editingLineText.substring(editingLineRedStart, editingLineRedEnd);
                      const after = editingLineText.substring(editingLineRedEnd);
                      return `${before}<span style="color: #dc2626; font-weight: 500;">${red}</span>${after}`;
                    }
                    return editingLineText;
                  })()
                }}
              />
              
              {/* Character Count */}
              <div className="flex justify-between items-center">
                <div className={`text-sm ${
                  editingLineText.length > 125 ? 'text-orange-600 font-bold' : 'text-gray-600'
                }`}>
                  {editingLineText.length} / 125 characters
                  {editingLineText.length > 125 && (
                    <span className="ml-2">⚠️ Warning: Exceeds 125 characters!</span>
                  )}
                </div>
              </div>
            </div>
            
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setEditingLineId(null)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (!editingLineId) return;
                  
                  // Extract HTML from contentEditable
                  const editorDiv = document.querySelector('[contenteditable="true"]');
                  if (!editorDiv) return;
                  
                  const html = editorDiv.innerHTML;
                  const text = editorDiv.textContent || '';
                  
                  // Parse HTML to find RED text positions
                  let redStart = -1;
                  let redEnd = -1;
                  
                  // Simple regex to find <span style="color: rgb(220, 38, 38)..."> or similar
                  const redSpanRegex = /<span[^>]*style="[^"]*color:\s*(?:#dc2626|rgb\(220,\s*38,\s*38\))[^"]*"[^>]*>([^<]*)<\/span>/gi;
                  const match = redSpanRegex.exec(html);
                  
                  if (match) {
                    const redText = match[1];
                    redStart = text.indexOf(redText);
                    if (redStart >= 0) {
                      redEnd = redStart + redText.length;
                    }
                  }
                  
                  // Update adLines
                  setAdLines(prev => prev.map(line => {
                    if (line.id === editingLineId) {
                      return {
                        ...line,
                        text: text,
                        charCount: text.length,
                        redStart: redStart,
                        redEnd: redEnd,
                      };
                    }
                    return line;
                  }));
                  
                  toast.success('Text saved!');
                  setEditingLineId(null);
                }}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
            <CardContent className="pt-6">
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
                Încărcați imagini sau selectați din library (format 9:16 recomandat).
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              {/* Upload Section */}
              <div
                onDrop={handleImageDrop}
                onDragOver={(e) => e.preventDefault()}
                className="border-2 border-dashed border-blue-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors cursor-pointer bg-blue-50/50"
                onClick={() => document.getElementById('image-upload')?.click()}
              >
                <Upload className="w-12 h-12 text-blue-500 mx-auto mb-4" />
                <p className="text-blue-900 font-medium mb-2">Drop images here or click to upload</p>
                <p className="text-sm text-gray-500 italic">Suportă .jpg, .png, .webp (format 9:16 recomandat)</p>
                <input
                  id="image-upload"
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleImageSelect}
                />
              </div>
              
              {/* Library Images Section */}
              {libraryImages.length > 0 && (
                <div className="mt-8 p-4 bg-green-50 border-2 border-green-300 rounded-lg">
                  <div className="mb-4">
                    <h3 className="font-bold text-green-900 flex items-center gap-2 mb-4">
                      <ImageIcon className="w-4 h-4" />
                      Select from Library ({libraryImages.length} images)
                    </h3>
                  </div>
                  
                  {/* Search Bar + Character Filter */}
                  <div className="mb-4 grid grid-cols-2 gap-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        placeholder="Search images by name..."
                        value={librarySearchQuery}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLibrarySearchQuery(e.target.value)}
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
                          .filter((char: string) => char && char.trim() !== "")
                          .map((char: string) => (
                            <SelectItem key={char} value={char}>
                              {char}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Library Images Grid */}
                  <div className="grid grid-cols-4 md:grid-cols-8 gap-2 max-h-[300px] overflow-y-auto mb-4">
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
                              ? 'border-green-500 ring-2 ring-green-300'
                              : 'border-gray-200 hover:border-green-400'
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
                            <div className="absolute top-1 right-1 bg-purple-600 text-white rounded-full p-1">
                              <Check className="w-3 h-3" />
                            </div>
                          )}
                          <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1 truncate">
                            {img.imageName}
                          </div>
                        </div>
                      ))}
                  </div>
                  
                  {/* Add Selected Button */}
                  {selectedLibraryImages.length > 0 && (
                    <Button
                      onClick={() => {
                        // Filter out images that are already added
                        const existingImageIds = images.map(img => img.id);
                        const newImages: UploadedImage[] = libraryImages
                          .filter((img) => selectedLibraryImages.includes(img.id))
                          .filter((img) => !existingImageIds.includes(`library-${img.id}`)) // Prevent duplicates
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
                      className="bg-green-600 hover:bg-green-700 w-full"
                    >
                      Add {selectedLibraryImages.length} Selected Image(s)
                    </Button>
                  )}
                </div>
              )}

              {/* Display uploaded images */}
              {images.length > 0 && (
                <div className="mt-6">
                  <p className="font-medium text-blue-900 mb-3">
                    {images.length} imagini încărcate:
                  </p>
                  <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
                    {images.map((image) => (
                      <div key={image.id} className="relative group">
                        <img
                          src={image.url}
                          alt={image.fileName}
                          className="w-full aspect-[9/16] object-cover rounded border-2 border-blue-200"
                        />
                        <button
                          onClick={() => removeImage(image.id)}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-2 hover:bg-red-600 transition-all shadow-lg hover:scale-110 border-2 border-white"
                        >
                          <X className="w-5 h-5" />
                        </button>
                        {image.fromLibrary && (
                          <div className="absolute top-1 left-1 bg-purple-600 text-white text-xs px-2 py-1 rounded">
                            Library
                          </div>
                        )}
                        <p className="text-xs text-center mt-1 text-gray-600 truncate">{image.fileName}</p>
                      </div>
                    ))}
                  </div>
                  <Button
                    onClick={createMappings}
                    className="mt-4 bg-blue-600 hover:bg-blue-700"
                  >
                    Continuă la STEP 5 - Mapare
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* STEP 5: Mapping */}
        {currentStep === 5 && combinations.length > 0 && (
          <Card className="mb-8 border-2 border-blue-200">
            <CardHeader className="bg-blue-50">
              <CardTitle className="flex items-center gap-2 text-blue-900">
                <Map className="w-5 h-5" />
                STEP 5 - Mapping (Text + Image + Prompt)
              </CardTitle>
              <CardDescription>
                Configurează combinațiile de text, imagine și prompt pentru fiecare video. Maparea este făcută automat.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
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
                    <div className="flex gap-4">
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
            <CardContent className="pt-6">
              {/* Filtru videouri STEP 5 */}
              <div className="mb-6 flex items-center gap-4">
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
                {step5FilteredVideos.map((result, index) => (
                  <div key={index} className="p-4 bg-white rounded-lg border-2 border-blue-200">
                    <div className="flex items-start gap-4">
                      <img
                        src={result.imageUrl}
                        alt="Video thumbnail"
                        className="w-12 aspect-[9/16] object-cover rounded border-2 border-blue-300"
                      />
                      <div className="flex-1">
                        <p className="text-sm text-blue-900 mb-2">
                          <span className="font-medium">Text:</span> {result.text.substring(0, 100)}...
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
                        <div className="flex items-center gap-2">
                          {result.status === 'pending' && (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin text-orange-600" />
                              <span className="text-sm text-orange-600 font-medium">În curs de generare...</span>
                              {result.taskId && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => checkVideoStatus(result.taskId!, index)}
                                  className="ml-auto border-orange-300 text-orange-700 hover:bg-orange-50"
                                >
                                  Verifică Status
                                </Button>
                              )}
                            </>
                          )}
                          {result.status === 'success' && result.videoUrl && (
                            <>
                              {result.reviewStatus === 'regenerate' ? (
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
                                      // FIX: Găsește index-ul real în videoResults bazat pe videoName
                                      const realIndex = videoResults.findIndex(v => v.videoName === result.videoName);
                                      console.log('[Modify & Regenerate] Clicked for rejected video:', result.videoName, 'realIndex:', realIndex);
                                      
                                      if (realIndex < 0) {
                                        toast.error('Video nu găsit în videoResults');
                                        return;
                                      }
                                      
                                      setModifyingVideoIndex(realIndex);
                                      const currentPromptType = combinations[realIndex]?.promptType || 'PROMPT_NEUTRAL';
                                      setModifyPromptType(currentPromptType);
                                      
                                      // Dacă video are PROMPT_CUSTOM salvat → afișează-l
                                      if (currentPromptType === 'PROMPT_CUSTOM' && customPrompts[realIndex]) {
                                        setModifyPromptText(customPrompts[realIndex]);
                                      } else {
                                        setModifyPromptText('');
                                      }
                                      
                                      setModifyDialogueText(result.text);
                                      
                                      // Scroll to form
                                      setTimeout(() => {
                                        const formElement = document.querySelector(`[data-modify-form="${realIndex}"]`);
                                        if (formElement) {
                                          formElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                                        }
                                      }, 100);
                                    }}
                                    className="border-orange-500 text-orange-700 hover:bg-orange-50"
                                  >
                                    Modify & Regenerate
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 bg-green-50 border-2 border-green-500 px-3 py-2 rounded-lg flex-1">
                                  <Check className="w-5 h-5 text-green-600" />
                                  <span className="text-sm text-green-700 font-bold">Generated</span>
                                </div>
                              )}
                            </>
                          )}
                          {result.status === 'failed' && (
                            <>
                              <div className="flex-1">
                                <div className="bg-red-50 border-2 border-red-500 px-4 py-2 rounded-lg">
                                  <div className="flex items-center gap-2 mb-1">
                                    <X className="w-5 h-5 text-red-600" />
                                    <span className="text-base text-red-700 font-bold">Failed</span>
                                  </div>
                                  <p className="text-sm text-red-600 ml-7">
                                    {result.error || 'Unknown error'}
                                  </p>
                                </div>
                                
                                {/* Modify & Regenerate Form */}
                                {modifyingVideoIndex === videoResults.findIndex(v => v.videoName === result.videoName) && (
                                  <div 
                                    data-modify-form={videoResults.findIndex(v => v.videoName === result.videoName)}
                                    className="mt-4 p-4 bg-white border-2 border-orange-300 rounded-lg space-y-3"
                                  >
                                    <h5 className="font-bold text-orange-900">Modify & Regenerate</h5>
                                    
                                    {/* Radio: Vrei să regenerezi mai multe videouri? */}
                                    <div className="p-3 bg-orange-50 border border-orange-200 rounded">
                                      <label className="text-sm font-medium text-gray-700 block mb-2">Vrei să regenerezi mai multe videouri?</label>
                                      <div className="flex gap-4">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                          <input
                                            type="radio"
                                            name="multipleRegens"
                                            checked={!multipleRegenerations}
                                            onChange={() => {
                                              setMultipleRegenerations(false);
                                              setRegenerationCount(1);
                                              setRegenerationVariants([]);
                                            }}
                                            className="w-4 h-4"
                                          />
                                          <span className="text-sm">Nu</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                          <input
                                            type="radio"
                                            name="multipleRegens"
                                            checked={multipleRegenerations}
                                            onChange={() => {
                                              setMultipleRegenerations(true);
                                              // Inițializează variante cu valorile curente
                                              const initialVariant = {
                                                promptType: modifyPromptType,
                                                promptText: modifyPromptText,
                                                dialogueText: modifyDialogueText,
                                                imageUrl: videoResults[index]?.imageUrl || '',
                                              };
                                              setRegenerationVariants([initialVariant]);
                                            }}
                                            className="w-4 h-4"
                                          />
                                          <span className="text-sm">Da</span>
                                        </label>
                                      </div>
                                    </div>
                                    
                                    {/* Selector număr regenerări (dacă Da) */}
                                    {multipleRegenerations && (
                                      <div>
                                        <label className="text-sm font-medium text-gray-700 block mb-1">Câte regenerări vrei? (1-10):</label>
                                        <select
                                          value={regenerationCount}
                                          onChange={(e) => {
                                            const count = parseInt(e.target.value);
                                            setRegenerationCount(count);
                                            
                                            // Ajustează array-ul de variante
                                            const currentVariants = [...regenerationVariants];
                                            if (count > currentVariants.length) {
                                              // Adaugă variante noi (copie după prima)
                                              const template = currentVariants[0] || {
                                                promptType: modifyPromptType,
                                                promptText: modifyPromptText,
                                                dialogueText: modifyDialogueText,
                                                imageId: combinations[index]?.imageId || '',
                                              };
                                              while (currentVariants.length < count) {
                                                currentVariants.push({ ...template });
                                              }
                                            } else {
                                              // Șterge variante în plus
                                              currentVariants.splice(count);
                                            }
                                            setRegenerationVariants(currentVariants);
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
                                    {!multipleRegenerations ? (
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
                                            // Încarcă text din prompts state (salvat în session)
                                            const promptFromState = prompts.find(p => p.name === newType);
                                            if (promptFromState?.template) {
                                              setModifyPromptText(promptFromState.template);
                                            } else {
                                              setModifyPromptText('');
                                              toast.warning(`Prompt ${newType} nu a fost găsit în sesiune`);
                                            }
                                          }
                                        }}
                                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                                      >
                                        <option value="PROMPT_NEUTRAL">PROMPT_NEUTRAL</option>
                                        <option value="PROMPT_SMILING">PROMPT_SMILING</option>
                                        <option value="PROMPT_CTA">PROMPT_CTA</option>
                                        <option value="PROMPT_CUSTOM">PROMPT_CUSTOM</option>
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
                                          
                                          // Când user editează prompt text → switch automat la PROMPT_CUSTOM
                                          if (newText.trim().length > 0 && modifyPromptType !== 'PROMPT_CUSTOM') {
                                            setModifyPromptType('PROMPT_CUSTOM');
                                          }
                                        }}
                                        placeholder={
                                          modifyPromptType === 'PROMPT_CUSTOM'
                                            ? 'Introdu promptul custom aici'
                                            : `Editează ${modifyPromptType} sau lasă gol pentru a folosi promptul hardcodat`
                                        }
                                        className="text-sm min-h-[80px]"
                                      />
                                    </div>
                                    
                                    {/* Edit Dialogue Text */}
                                    <div>
                                      <label className="text-sm font-medium text-gray-700 block mb-1">Edit Text:</label>
                                      <Textarea
                                        value={modifyDialogueText}
                                        onChange={(e) => setModifyDialogueText(e.target.value)}
                                        className="text-sm min-h-[60px]"
                                      />
                                      <p className={`text-xs mt-1 ${
                                        modifyDialogueText.length > 125 ? 'text-red-600 font-bold' : 'text-gray-500'
                                      }`}>
                                        {modifyDialogueText.length} caractere{modifyDialogueText.length > 125 ? ` - ${modifyDialogueText.length - 125} caractere depășite!` : ''}
                                      </p>
                                    </div>
                                    
                                    {/* Buttons (mod single) */}
                                    <div className="flex gap-2">
                                      <Button
                                        size="sm"
                                        onClick={() => {
                                          // SAVE: salvează modificări fără regenerare
                                          
                                          // Dacă user a editat prompt text → salvează ca PROMPT_CUSTOM
                                          if (modifyPromptText.trim().length > 0) {
                                            setCustomPrompts(prev => ({
                                              ...prev,
                                              [index]: modifyPromptText,
                                            }));
                                          }
                                          
                                          const updatedCombinations = [...combinations];
                                          updatedCombinations[index] = {
                                            ...updatedCombinations[index],
                                            text: modifyDialogueText,
                                            promptType: modifyPromptType,
                                          };
                                          setCombinations(updatedCombinations);
                                          
                                          // Update videoResults cu noul text
                                          setVideoResults(prev =>
                                            prev.map((v, i) =>
                                              i === index ? { ...v, text: modifyDialogueText } : v
                                            )
                                          );
                                          
                                          // Salvează timestamp pentru "Edited X min ago"
                                          setEditTimestamps(prev => ({
                                            ...prev,
                                            [index]: Date.now(),
                                          }));
                                          
                                          toast.success('Modificări salvate!');
                                          setModifyingVideoIndex(null);
                                        }}
                                        disabled={modifyDialogueText.trim().length === 0}
                                        className="flex-1 bg-green-600 hover:bg-green-700"
                                      >
                                        Save
                                      </Button>
                                      <Button
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
                                    </>
                                    ) : (
                                      /* Mod multiple (Da) - N secțiuni */
                                      <>
                                        {regenerationVariants.map((variant, variantIndex) => (
                                          <div key={variantIndex} className="p-3 bg-gray-50 border border-gray-300 rounded space-y-2">
                                            <h6 className="font-bold text-gray-900">Varianta {variantIndex + 1}</h6>
                                            
                                            {/* Prompt Type */}
                                            <div>
                                              <label className="text-xs font-medium text-gray-700 block mb-1">Prompt Type:</label>
                                              <select
                                                value={variant.promptType}
                                                onChange={async (e) => {
                                                  const newType = e.target.value as PromptType;
                                                  const updated = [...regenerationVariants];
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
                                                  
                                                  setRegenerationVariants(updated);
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
                                                  const updated = [...regenerationVariants];
                                                  updated[variantIndex] = { ...updated[variantIndex], promptText: e.target.value };
                                                  setRegenerationVariants(updated);
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
                                                  const updated = [...regenerationVariants];
                                                  updated[variantIndex] = { ...updated[variantIndex], dialogueText: e.target.value };
                                                  setRegenerationVariants(updated);
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
                                                  const updated = [...regenerationVariants];
                                                  updated[variantIndex] = { ...updated[variantIndex], imageUrl: e.target.value };
                                                  setRegenerationVariants(updated);
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
                                                toast.success(`${regenerationVariants.length} variante salvate!`);
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
                                          
                                          {/* Regenerate All - trimite toate variantele pentru generare */}
                                          <Button
                                            size="sm"
                                            onClick={async () => {
                                              if (modifyingVideoIndex === null || modifyingVideoIndex < 0) {
                                                toast.error('Selectează un video pentru regenerare');
                                                return;
                                              }
                                              
                                              // Validare: toate variantele trebuie să aibă text valid
                                              const invalidVariants = regenerationVariants.filter(v => 
                                                v.dialogueText.trim().length === 0
                                              );
                                              
                                              if (invalidVariants.length > 0) {
                                                toast.error('Toate variantele trebuie să aibă text valid');
                                                return;
                                              }
                                              
                                              try {
                                                // Detectare setări identice
                                                const firstVariant = regenerationVariants[0];
                                                const allIdentical = regenerationVariants.every(v => 
                                                  v.promptType === firstVariant.promptType &&
                                                  v.promptText === firstVariant.promptText &&
                                                  v.dialogueText === firstVariant.dialogueText &&
                                                  v.imageUrl === firstVariant.imageUrl
                                                );
                                                
                                                if (allIdentical && regenerationVariants.length > 1) {
                                                  toast.info(`Se vor face ${regenerationVariants.length} regenerări cu aceleași setări (nu se vor crea duplicate)`);
                                                } else {
                                                  toast.info(`Se regenerează ${regenerationVariants.length} variant${regenerationVariants.length > 1 ? 'e' : 'ă'} în paralel...`);
                                                }
                                                
                                                // Pregătește variantele pentru backend
                                                const variantsForBackend = regenerationVariants.map((variant) => ({
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
                                                if (allIdentical && regenerationVariants.length > 1) {
                                                  // Setări identice: TOATE regenerările înlocuiesc același video (nu creăm duplicate)
                                                  // Folosim doar prima variantă (toate sunt identice)
                                                  const firstResult = result.results[0];
                                                  const firstVariant = regenerationVariants[0];
                                                  
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
                                                              regenerationNote: `${regenerationVariants.length} regenerări cu aceleași setări`,
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
                                                    const variant = regenerationVariants[variantIndex];
                                                    
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
                                                setRegenerationVariants([]);
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
                                              `Regenerate All (${regenerationVariants.length} variante)`
                                            )}
                                          </Button>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                              
                              <div className="flex flex-col gap-2">
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => regenerateSingleVideo(index)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Regenerate
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    // FIX: Găsește index-ul real în videoResults bazat pe videoName
                                    const realIndex = videoResults.findIndex(v => v.videoName === result.videoName);
                                    setModifyingVideoIndex(realIndex);
                                    const currentPromptType = combinations[realIndex]?.promptType || 'PROMPT_NEUTRAL';
                                    setModifyPromptType(currentPromptType);
                                    
                                    // Dacă video are PROMPT_CUSTOM salvat → afișează-l
                                    if (currentPromptType === 'PROMPT_CUSTOM' && customPrompts[realIndex]) {
                                      setModifyPromptText(customPrompts[realIndex]);
                                    } else {
                                      setModifyPromptText('');
                                    }
                                    
                                    setModifyDialogueText(result.text);
                                  }}
                                  className="border-orange-500 text-orange-700 hover:bg-orange-50"
                                >
                                  Modify & Regenerate
                                </Button>
                                
                                {/* Edited X min ago */}
                                {editTimestamps[videoResults.findIndex(v => v.videoName === result.videoName)] && (
                                  <div className="flex items-center gap-1 mt-2">
                                    <Clock className="w-3 h-3 text-orange-500" />
                                    <p className="text-xs text-orange-500 font-bold">
                                      Edited {Math.floor((currentTime - editTimestamps[videoResults.findIndex(v => v.videoName === result.videoName)]) / 60000)} min ago
                                    </p>
                                  </div>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Buton Regenerate ALL Failed */}
              {videoResults.some(v => v.status === 'failed') && (
                <div className="mt-6">
                  <Button
                    onClick={regenerateAllFailed}
                    disabled={generateBatchMutation.isPending}
                    className="bg-red-600 hover:bg-red-700 w-full py-4 text-base"
                  >
                    {generateBatchMutation.isPending ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Se retrimite...
                      </>
                    ) : (
                      <>
                        <X className="w-5 h-5 mr-2" />
                        Regenerate ALL Failed ({(() => {
                          const currentFailedCount = failedCount;
                          const pendingRegenerations = videoResults.reduce((sum, v) => {
                            if (v.regenerationNote) {
                              // Parse "⚠️ 3 regenerări cu aceleași setări" → 3
                              const match = v.regenerationNote.match(/(\d+)\s+regener[ăa]ri/);
                              if (match) {
                                return sum + parseInt(match[1], 10);
                              }
                            }
                            return sum;
                          }, 0);
                          return failedCount + pendingRegenerations;
                        })()})
                      </>
                    )}
                  </Button>
                </div>
              )}
                      {/* Buton pentru a trece la STEP 6 */}
              {videoResults.some(v => v.status === 'success') && (
                <div className="mt-6">
                  <Button
                    onClick={goToCheckVideos}
                    className="bg-green-600 hover:bg-green-700 w-full py-6 text-lg"
                  >
                    <Check className="w-5 h-5 mr-2" />
                    Check Videos (Review)
                  </Button>
                  
                  {/* Link Continue with Sample Videos (secundar, sub butonul verde) */}
                  <div className="mt-3 text-center">
                    <button
                      onClick={loadSampleVideos}
                      className="text-sm text-gray-500 hover:text-gray-700 underline"
                    >
                      Continue with Sample Videos (TEMP)
                    </button>
                    <p className="text-xs text-gray-400 mt-1">
                      Încarcă 6 task ID-uri sample pentru testare
                    </p>
                  </div>
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
            <CardContent className="pt-6">
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
                  <div className="flex gap-4">
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
            <CardContent className="pt-6">
              {/* Filtru videouri */}
              <div className="mb-6 flex items-center gap-4">
                <label className="text-sm font-medium text-green-900">Filtrează videouri:</label>
                <select
                  value={videoFilter}
                  onChange={(e) => setVideoFilter(e.target.value as 'all' | 'accepted' | 'failed')}
                  className="px-4 py-2 border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="all">Afișează Toate</option>
                  <option value="accepted">Doar Acceptate</option>
                  <option value="failed">Doar Failed/Pending</option>
                </select>
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
                // Filtrare videouri pe bază de videoFilter (deja filtrat în step6FilteredVideos)
                let categoryVideos = step6FilteredVideos.filter(v => v.section === category);
                
                if (videoFilter === 'accepted') {
                  categoryVideos = categoryVideos.filter(v => v.reviewStatus === 'accepted');
                } else if (videoFilter === 'failed') {
                  categoryVideos = categoryVideos.filter(v => v.reviewStatus !== 'accepted');
                }
                
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
                          
                          {/* Text */}
                          <p className="text-sm text-gray-700 mb-3">{video.text}</p>
                          
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
                
                {/* Buton Next Step - activ doar când toate videouri au decizie */}
                {videoResults.every(v => v.reviewStatus !== null) ? (
                  <div className="space-y-2">
                    {videoResults.some(v => v.reviewStatus === 'regenerate') && (
                      <Button
                        onClick={() => {
                          // TODO: Implementare regenerare și revenire la STEP 6
                          toast.info('Regenerare videouri marcate...');
                          setCurrentStep(6);
                        }}
                        className="w-full bg-red-600 hover:bg-red-700 py-6 text-lg"
                      >
                        <RefreshCw className="w-5 h-5 mr-2" />
                        Regenerate Selected ({regenerateCount})
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="bg-yellow-50 border-2 border-yellow-300 rounded p-4 text-center">
                    <p className="text-yellow-800 font-medium">
                      Te rog să iei o decizie (Accept sau Regenerate) pentru toate videouri înainte de a continua.
                    </p>
                    <p className="text-sm text-yellow-700 mt-1">
                      {videosWithoutDecision.length} videouri rămase fără decizie
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
                </div>
              )}
            </CardContent>
          </Card>
        )}
        </>
        )}
      </div>
    </div>
  );
}
