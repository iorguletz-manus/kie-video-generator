import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Upload, X, Check, Loader2, Video, FileText, Image as ImageIcon, Map, Play, Download, Undo2, ChevronLeft } from "lucide-react";

type PromptType = 'PROMPT_NEUTRAL' | 'PROMPT_SMILING' | 'PROMPT_CTA';
type SectionType = 'HOOKS' | 'MIRROR' | 'DCS' | 'TRANZITION' | 'NEW_CAUSE' | 'MECHANISM' | 'EMOTIONAL_PROOF' | 'TRANSFORMATION' | 'CTA' | 'OTHER';

interface AdLine {
  id: string;
  text: string;
  section: SectionType;
  promptType: PromptType;
  videoName: string;
  categoryNumber: number;
  charCount: number;
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
  file: File;
  fileName: string;
  isCTA: boolean;
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
}

export default function Home() {
  // Step 1: Text Ad
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
  
  // Step 2: Manual prompt textarea
  const [manualPromptText, setManualPromptText] = useState('');
  
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

  // Mutations
  const parseAdMutation = trpc.video.parseAdDocument.useMutation();
  const parsePromptMutation = trpc.video.parsePromptDocument.useMutation();
  const uploadImageMutation = trpc.video.uploadImage.useMutation();
  const generateBatchMutation = trpc.video.generateBatchVideos.useMutation();
  
  // Session management functions
  interface SavedSession {
    id: string;
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
    try {
      const sessions = localStorage.getItem('kie-video-generator-sessions');
      return sessions ? JSON.parse(sessions) : [];
    } catch (error) {
      console.error('Eroare la citire sesiuni:', error);
      return [];
    }
  };
  
  const saveSession = (name: string) => {
    try {
      const session = {
        id: currentSessionId,
        name,
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
      
      const sessions = getSavedSessions();
      const existingIndex = sessions.findIndex(s => s.id === currentSessionId);
      
      if (existingIndex >= 0) {
        sessions[existingIndex] = session;
      } else {
        sessions.push(session);
      }
      
      localStorage.setItem('kie-video-generator-sessions', JSON.stringify(sessions));
      toast.success(`Sesiune "${name}" salvată!`);
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
      
      toast.success(`Sesiune "${session.name}" încărcată!`);
    } catch (error) {
      console.error('Eroare la încărcare sesiune:', error);
      toast.error('Eroare la încărcare sesiune');
    }
  };
  
  const deleteSession = (sessionId: string) => {
    try {
      const sessions = getSavedSessions();
      const filteredSessions = sessions.filter(s => s.id !== sessionId);
      
      localStorage.setItem('kie-video-generator-sessions', JSON.stringify(filteredSessions));
      
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

  // Step 1: Handle ad document upload
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
              });
              
              const isCTA = file.name.toUpperCase().includes('CTA');
              
              const newImage: UploadedImage = {
                id: `img-${Date.now()}-${Math.random()}`,
                url: result.imageUrl,
                file: file,
                fileName: file.name,
                isCTA: isCTA,
              };
              
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

    // Crează combinații cu mapare inteligentă CTA
    const newCombinations: Combination[] = adLines.map((line, index) => {
      let selectedImage = defaultImage;
      
      // Dacă există poză CTA și suntem după prima linie cu "carte"
      if (ctaImage && firstCarteIndex !== -1 && index >= firstCarteIndex) {
        selectedImage = ctaImage;
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
    setCurrentStep(4);
    
    if (ctaImage && firstCarteIndex !== -1) {
      toast.success(`${newCombinations.length} combinații create. Poza CTA mapata pe liniile cu "carte"`);
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
      setCurrentStep(5);
      
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
          videoUrl = data.data.resultUrls?.[0];
          console.log('Video SUCCESS - URL:', videoUrl);
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

        if (status === 'success') {
          toast.success(`Video #${index + 1} generat cu succes!`);
        } else if (status === 'failed') {
          toast.error(`Video #${index + 1} a eșuat: ${errorMessage}`);
        } else {
          toast.info(`Video #${index + 1} încă se generează...`);
        }
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
  const loadSampleVideos = () => {
    const sampleTaskIds = [
      'b78c0ce0523ab52128ea6d86954bbeac',
      '55b7419936130ddf132e18d0a0f6477c',
      'aa6bd9b4b2732a5dbd6146d4e34dad98',
      '82e9dbc99e597a89a33ed16088577094',
      '7886953a056290ada67c2d64c84195d5',
      '89ce31bc36aef3d3d5eec77e7141fcd1',
    ];
    
    const sections: SectionType[] = ['HOOKS', 'MIRROR', 'DCS', 'TRANZITION', 'NEW_CAUSE', 'MECHANISM'];
    
    const sampleResults: VideoResult[] = sampleTaskIds.map((taskId, index) => ({
      taskId,
      videoName: `${sections[index]}_A${index + 1}_MIRROR1`,
      text: `Sample video ${index + 1} for testing`,
      imageUrl: 'https://via.placeholder.com/270x480/blue/white?text=Sample',
      status: 'pending' as const,
      section: sections[index],
      categoryNumber: index + 1,
      reviewStatus: null,
    }));
    
    setVideoResults(sampleResults);
    
    // Crează și combinations pentru sample videos
    const sampleCombinations: Combination[] = sampleTaskIds.map((taskId, index) => ({
      id: `sample-${index}`,
      text: `Sample video ${index + 1} for testing`,
      imageUrl: 'https://via.placeholder.com/270x480/blue/white?text=Sample',
      imageId: `sample-img-${index}`,
      promptType: 'PROMPT_NEUTRAL' as PromptType,
      videoName: `${sections[index]}_A${index + 1}_MIRROR1`,
      section: sections[index],
      categoryNumber: index + 1,
    }));
    
    setCombinations(sampleCombinations);
    setCurrentStep(5);
    toast.success('6 sample videos încărcate pentru testare!');
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

    // Validare text (maxim 125 caractere)
    if (modifyDialogueText.length > 125) {
      toast.error('Textul depășește 125 de caractere!');
      return;
    }

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

  // STEP 6: Review functions
  const acceptVideo = (videoName: string) => {
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
  };

  const regenerateVideo = (videoName: string) => {
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
    
    toast.info(`Video ${videoName} marcat pentru regenerare`);
  };

  const undoReview = () => {
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
  };

  const goToCheckVideos = () => {
    setCurrentStep(6);
  };

  // Navigation
  const goToStep = (step: number) => {
    if (step <= currentStep) {
      setCurrentStep(step);
    }
  };

  const goBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 py-8">
      <div className="container max-w-6xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-blue-900 mb-2">Kie.ai Video Generator</h1>
          <p className="text-blue-700">Generează videouri AI în masă cu Kie.ai Veo 3.1</p>
        </div>

        {/* Session Management */}
        <div className="mb-6 p-4 bg-white border-2 border-blue-200 rounded-lg">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-blue-900 mb-2">
                Sesiune Curentă:
              </label>
              <select
                value={currentSessionId}
                onChange={(e) => {
                  const sessionId = e.target.value;
                  if (sessionId === 'new') {
                    // New session
                    if (confirm('Vrei să începi o sesiune nouă? Sesiunea curentă va fi salvată automat.')) {
                      setCurrentSessionId(`session-${Date.now()}`);
                      // Reset all states
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
                      toast.success('Sesiune nouă creată!');
                    }
                  } else {
                    // Load session
                    setCurrentSessionId(sessionId);
                    loadSession(sessionId);
                  }
                }}
                className="w-full p-3 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="default">Default Session</option>
                {getSavedSessions().map(session => (
                  <option key={session.id} value={session.id}>
                    {session.name} (STEP {session.currentStep}, {session.videoCount} videos) - {new Date(session.timestamp).toLocaleString('ro-RO')}
                  </option>
                ))}
                <option value="new">+ Sesiune Nouă</option>
              </select>
            </div>
            
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => {
                  const name = prompt('Nume sesiune:', `Session ${new Date().toLocaleDateString('ro-RO')}`);
                  if (name) {
                    saveSession(name);
                  }
                }}
                className="bg-green-600 hover:bg-green-700"
              >
                Save Session
              </Button>
              
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  if (confirm('Sigur vrei să ștergi sesiunea curentă?')) {
                    deleteSession(currentSessionId);
                  }
                }}
                disabled={currentSessionId === 'default'}
                className="bg-red-600 hover:bg-red-700"
              >
                Delete
              </Button>
            </div>
          </div>
        </div>

        {/* Breadcrumbs */}
        <div className="flex justify-between items-center mb-8 px-4">
          {[
            { num: 1, label: "Text Ad", icon: FileText },
            { num: 2, label: "Prompts", icon: FileText },
            { num: 3, label: "Images", icon: ImageIcon },
            { num: 4, label: "Mapping", icon: Map },
            { num: 5, label: "Generate", icon: Play },
            { num: 6, label: "Regenerate", icon: Undo2 },
            { num: 7, label: "Final Review", icon: Video },
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
              {index < 6 && (
                <div
                  className={`h-1 flex-1 mx-2 transition-all ${
                    currentStep > step.num ? "bg-blue-600" : "bg-gray-200"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Back Button */}
        {currentStep > 1 && (
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

        {/* STEP 1: Text Ad */}
        {currentStep === 1 && (
          <Card className="mb-8 border-2 border-blue-200">
            <CardHeader className="bg-blue-50">
              <CardTitle className="flex items-center gap-2 text-blue-900">
                <FileText className="w-5 h-5" />
                STEP 1 - Text Ad Upload
              </CardTitle>
              <CardDescription>
                Încarcă documentul cu ad-ul (.docx). Liniile vor fi extrase automat.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-8 px-8 pb-8">
              <div
                onDrop={handleAdDocumentDrop}
                onDragOver={(e) => e.preventDefault()}
                className="border-2 border-dashed border-blue-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors cursor-pointer bg-blue-50/50"
                onClick={() => !adDocument && document.getElementById('ad-upload')?.click()}
              >
                <Upload className="w-12 h-12 text-blue-500 mx-auto mb-4" />
                <p className="text-blue-900 font-medium mb-2">
                  {adDocument ? adDocument.name : "Drop document here or click to upload"}
                </p>
                <p className="text-sm text-gray-500 italic">Suportă .docx, .doc</p>
                <input
                  id="ad-upload"
                  type="file"
                  accept=".docx,.doc"
                  className="hidden"
                  onChange={handleAdDocumentSelect}
                />
              </div>
              
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
                    {adLines.length} linii extrase:
                  </p>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {adLines.map((line, index) => (
                      <div key={line.id} className="p-3 bg-white rounded border border-blue-200 text-sm">
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-medium text-blue-700">#{index + 1}:</span>
                          <span className="text-xs text-gray-500">{line.charCount} caractere</span>
                        </div>
                        <p>{line.text}</p>
                        <span className="text-xs text-gray-500">({line.promptType})</span>
                      </div>
                    ))}
                  </div>
                  <Button
                    onClick={() => setCurrentStep(2)}
                    className="mt-4 bg-blue-600 hover:bg-blue-700"
                  >
                    Continuă la STEP 2
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* STEP 2: Prompts (3 prompts) */}
        {currentStep === 2 && (
          <Card className="mb-8 border-2 border-blue-200">
            <CardHeader className="bg-blue-50">
              <CardTitle className="flex items-center gap-2 text-blue-900">
                <FileText className="w-5 h-5" />
                STEP 2 - Prompts
              </CardTitle>
              <CardDescription>
                Prompturile hardcodate sunt întotdeauna active. Poți adăuga și prompturi custom (.docx).
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              {/* Prompturi hardcodate - întotdeauna active */}
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

              {/* Upload prompturi custom - opțional */}
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
                
                {/* SAU Textarea Manual */}
                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-2 text-center font-medium">SAU</p>
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

              {/* Buton continuare - întotdeauna vizibil */}
              <Button
                onClick={() => setCurrentStep(3)}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                Continuă la STEP 3
              </Button>
            </CardContent>
          </Card>
        )}

        {/* STEP 3: Images */}
        {currentStep === 3 && (
          <Card className="mb-8 border-2 border-blue-200">
            <CardHeader className="bg-blue-50">
              <CardTitle className="flex items-center gap-2 text-blue-900">
                <ImageIcon className="w-5 h-5" />
                STEP 3 - Images Upload
              </CardTitle>
              <CardDescription>
                Încarcă imaginile pentru videouri (format 9:16). Poți încărca multiple imagini.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
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
                        <p className="text-xs text-center mt-1 text-gray-600 truncate">{image.fileName}</p>
                      </div>
                    ))}
                  </div>
                  <Button
                    onClick={createMappings}
                    className="mt-4 bg-blue-600 hover:bg-blue-700"
                  >
                    Continuă la STEP 4 - Mapare
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* STEP 4: Mapping */}
        {currentStep === 4 && combinations.length > 0 && (
          <Card className="mb-8 border-2 border-blue-200">
            <CardHeader className="bg-blue-50">
              <CardTitle className="flex items-center gap-2 text-blue-900">
                <Map className="w-5 h-5" />
                STEP 4 - Mapping (Text + Image + Prompt)
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
                        <label className="block text-xs font-medium text-blue-900 mb-2">
                          Text pentru Dialogue
                        </label>
                        <Textarea
                          value={combo.text}
                          onChange={(e) => updateCombinationText(combo.id, e.target.value)}
                          className="text-sm mb-3 min-h-[80px]"
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

        {/* STEP 5: Generate Results */}
        {currentStep === 5 && videoResults.length > 0 && (
          <Card className="mb-8 border-2 border-blue-200">
            <CardHeader className="bg-blue-50">
              <CardTitle className="flex items-center gap-2 text-blue-900">
                <Play className="w-5 h-5" />
                STEP 5 - Videouri Generate
              </CardTitle>
              <CardDescription>
                Urmărește progresul generării videourilo și descarcă-le.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {videoResults.map((result, index) => (
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
                              <div className="flex items-center gap-3 bg-green-50 border-2 border-green-500 px-4 py-2 rounded-lg flex-1">
                                <Check className="w-5 h-5 text-green-600" />
                                <span className="text-base text-green-700 font-bold">Generated</span>
                              </div>
                              <Button
                                size="sm"
                                onClick={() => downloadVideo(result.videoUrl!, index)}
                                className="bg-green-600 hover:bg-green-700 gap-2"
                              >
                                <Download className="w-4 h-4" />
                                Download
                              </Button>
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
                                {modifyingVideoIndex === index && (
                                  <div className="mt-4 p-4 bg-white border-2 border-orange-300 rounded-lg space-y-3">
                                    <h5 className="font-bold text-orange-900">Modify & Regenerate</h5>
                                    
                                    {/* Select Prompt Type */}
                                    <div>
                                      <label className="text-sm font-medium text-gray-700 block mb-1">Prompt Type:</label>
                                      <select
                                        value={modifyPromptType}
                                        onChange={(e) => setModifyPromptType(e.target.value as PromptType)}
                                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                                      >
                                        <option value="PROMPT_NEUTRAL">PROMPT_NEUTRAL</option>
                                        <option value="PROMPT_SMILING">PROMPT_SMILING</option>
                                        <option value="PROMPT_CTA">PROMPT_CTA</option>
                                      </select>
                                    </div>
                                    
                                    {/* Edit Prompt Text (optional) */}
                                    <div>
                                      <label className="text-sm font-medium text-gray-700 block mb-1">Edit Prompt (optional):</label>
                                      <Textarea
                                        value={modifyPromptText}
                                        onChange={(e) => setModifyPromptText(e.target.value)}
                                        placeholder="Lasă gol pentru a folosi promptul hardcodat"
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
                                        {modifyDialogueText.length} caractere{modifyDialogueText.length > 125 ? ' - 125 caractere depășite!' : ''}
                                      </p>
                                    </div>
                                    
                                    {/* Buttons */}
                                    <div className="flex gap-2">
                                      <Button
                                        size="sm"
                                        onClick={() => regenerateWithModifications(index)}
                                        disabled={generateBatchMutation.isPending || modifyDialogueText.length > 125 || modifyDialogueText.trim().length === 0}
                                        className="flex-1 bg-orange-600 hover:bg-orange-700"
                                      >
                                        {generateBatchMutation.isPending ? (
                                          <>
                                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                            Se trimite...
                                          </>
                                        ) : (
                                          'Regenerate'
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
                                    setModifyingVideoIndex(index);
                                    setModifyPromptType(combinations[index]?.promptType || 'PROMPT_NEUTRAL');
                                    setModifyPromptText('');
                                    setModifyDialogueText(result.text);
                                  }}
                                  className="border-orange-500 text-orange-700 hover:bg-orange-50"
                                >
                                  Modify & Regenerate
                                </Button>
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
                        Regenerate ALL Failed ({videoResults.filter(v => v.status === 'failed').length})
                      </>
                    )}
                  </Button>
                </div>
              )}
              
              {/* TEMPORARY: Buton pentru sample videos (când Kie.ai nu funcționează) */}
              <div className="mt-6">
                <Button
                  onClick={loadSampleVideos}
                  className="bg-purple-600 hover:bg-purple-700 w-full py-4 text-base border-2 border-purple-300"
                >
                  <Play className="w-5 h-5 mr-2" />
                  Continue with Sample Videos (TEMP)
                </Button>
                <p className="text-xs text-gray-500 mt-2 text-center">
                  Încarcă 6 task ID-uri sample pentru testare când Kie.ai nu funcționează
                </p>
              </div>
              
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
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* STEP 6: Regenerate Advanced */}
        {currentStep === 6 && videoResults.length > 0 && (
          <Card className="mb-8 border-2 border-orange-200">
            <CardHeader className="bg-orange-50">
              <CardTitle className="flex items-center gap-2 text-orange-900">
                <Undo2 className="w-5 h-5" />
                STEP 6 - Regenerare Avansată
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
                            {variant.dialogueText.length} caractere{variant.dialogueText.length > 125 ? ' - 125 caractere depășite!' : ''}
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

                        // Validare: toate variantele trebuie să aibă text valid
                        const invalidVariants = regenerateVariants.filter(v => 
                          v.dialogueText.trim().length === 0 || v.dialogueText.length > 125
                        );
                        
                        if (invalidVariants.length > 0) {
                          toast.error('Toate variantele trebuie să aibă text valid (1-125 caractere)');
                          return;
                        }

                        try {
                          toast.info(`Se regenerează ${regenerateVariants.length} variant${regenerateVariants.length > 1 ? 'e' : 'ă'}...`);
                          
                          // Pentru fiecare variantă, trimite la backend
                          for (let variantIndex = 0; variantIndex < regenerateVariants.length; variantIndex++) {
                            const variant = regenerateVariants[variantIndex];
                            // Determină prompt template
                            let promptTemplate: string;
                            
                            if (variant.promptText.trim().length > 0) {
                              // Folosește prompt custom scris manual
                              promptTemplate = variant.promptText;
                            } else if (variant.promptType === 'custom') {
                              toast.error(`Variantă #${variantIndex + 1}: Selectează un prompt sau scrie unul manual`);
                              continue;
                            } else if (['PROMPT_NEUTRAL', 'PROMPT_SMILING', 'PROMPT_CTA'].includes(variant.promptType)) {
                              // Folosește hardcoded prompt
                              promptTemplate = `HARDCODED_${variant.promptType}`;
                            } else {
                              // Folosește prompt custom din listă
                              const customPrompt = prompts.find(p => p.id === variant.promptType);
                              if (customPrompt) {
                                promptTemplate = customPrompt.template;
                              } else {
                                toast.error(`Variantă #${variantIndex + 1}: Prompt nu găsit`);
                                continue;
                              }
                            }

                            const result = await generateBatchMutation.mutateAsync({
                              promptTemplate: promptTemplate,
                              combinations: [{
                                text: variant.dialogueText,
                                imageUrl: variant.imageUrl,
                              }],
                            });

                            const newResult = result.results[0];
                            
                            // Actualizează videoResults: adaugă sau înlocuiește
                            if (variantIndex === 0) {
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
                            } else {
                              // Variantele următoare se adaugă ca videouri noi
                              const originalVideo = videoResults[selectedVideoIndex];
                              const originalCombo = combinations[selectedVideoIndex];
                              
                              setVideoResults(prev => [
                                ...prev,
                                {
                                  text: variant.dialogueText,
                                  imageUrl: variant.imageUrl,
                                  taskId: newResult.taskId,
                                  status: newResult.success ? 'pending' as const : 'failed' as const,
                                  error: newResult.error,
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

                            if (newResult.success) {
                              toast.success(`Variantă #${variantIndex + 1} trimisă pentru generare`);
                            } else {
                              toast.error(`Variantă #${variantIndex + 1} a eșuat: ${newResult.error}`);
                            }
                          }

                          // Reset form
                          setSelectedVideoIndex(-1);
                          setRegenerateVariants([]);
                          setRegenerateMultiple(false);
                          setRegenerateVariantCount(1);
                          
                          // Revino la STEP 5 pentru a verifica progresul
                          setCurrentStep(5);
                          toast.success('Regenerare completă! Verifică progresul la STEP 5.');
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
                    <Button
                      onClick={() => setCurrentStep(7)}
                      variant="outline"
                      className="flex-1 border-green-500 text-green-700 hover:bg-green-50 py-6 text-lg"
                    >
                      <Check className="w-5 h-5 mr-2" />
                      Finalizare (STEP 7)
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* STEP 7: Final Review (Check Videos) */}
        {currentStep === 7 && videoResults.length > 0 && (
          <Card className="mb-8 border-2 border-green-200">
            <CardHeader className="bg-green-50">
              <CardTitle className="flex items-center gap-2 text-green-900">
                <Video className="w-5 h-5" />
                STEP 7 - Final Review
              </CardTitle>
              <CardDescription>
                Review videourilo generate. Acceptă sau marchează pentru regenerare.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
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
                const categoryVideos = videoResults.filter(v => v.section === category && v.status === 'success' && v.videoUrl);
                
                if (categoryVideos.length === 0) return null;
                
                return (
                  <div key={category} className="mb-8">
                    <h3 className="text-xl font-bold text-green-900 mb-4 border-b-2 border-green-300 pb-2">
                      {category}
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {categoryVideos.map((video) => (
                        <div key={video.videoName} className="p-4 bg-white rounded-lg border-2 border-green-200">
                          {/* TITLE */}
                          <h4 className="font-bold text-green-900 mb-2 text-lg">{video.videoName}</h4>
                          
                          {/* Text */}
                          <p className="text-sm text-gray-700 mb-3">{video.text}</p>
                          
                          {/* VIDEO PLAYER */}
                          <video
                            src={video.videoUrl}
                            controls
                            className="w-full aspect-[9/16] object-cover rounded border-2 border-green-300 mb-3"
                          />
                          
                          {/* BUTOANE ACCEPT/REGENERATE/DOWNLOAD */}
                          <div className="space-y-2">
                            <div className="flex gap-2">
                              {video.reviewStatus === 'accepted' ? (
                                <Button
                                  disabled
                                  size="sm"
                                  className="flex-1 bg-green-600 text-white text-xs py-1"
                                >
                                  <Check className="w-3 h-3 mr-1" />
                                  Acceptat
                                </Button>
                              ) : (
                                <Button
                                  onClick={() => acceptVideo(video.videoName)}
                                  size="sm"
                                  className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs py-1"
                                >
                                  <Check className="w-3 h-3 mr-1" />
                                  Accept
                                </Button>
                              )}
                              
                              {video.reviewStatus === 'regenerate' ? (
                                <Button
                                  disabled
                                  size="sm"
                                  className="flex-1 bg-red-600 text-white text-xs py-1"
                                >
                                  <X className="w-3 h-3 mr-1" />
                                  Regenerare
                                </Button>
                              ) : (
                                <Button
                                  onClick={() => regenerateVideo(video.videoName)}
                                  size="sm"
                                  className="flex-1 bg-red-600 hover:bg-red-700 text-white text-xs py-1"
                                >
                                  <X className="w-4 h-4 mr-1" />
                                  Regenerate
                                </Button>
                              )}
                            </div>
                            
                            {/* Buton Download Individual */}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                if (video.videoUrl) {
                                  const link = document.createElement('a');
                                  link.href = video.videoUrl;
                                  link.download = `${video.videoName}.mp4`;
                                  document.body.appendChild(link);
                                  link.click();
                                  document.body.removeChild(link);
                                  toast.success(`Descarcă ${video.videoName}...`);
                                }
                              }}
                              className="w-full border-blue-500 text-blue-700 hover:bg-blue-50 text-xs py-1"
                            >
                              <Download className="w-3 h-3 mr-1" />
                              Download
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              
              {/* Buton Download All Accepted Videos */}
              {videoResults.filter(v => v.reviewStatus === 'accepted' && v.videoUrl).length > 0 && (
                <div className="mt-8 p-4 bg-green-50 border-2 border-green-300 rounded-lg">
                  <p className="text-green-900 font-medium mb-3">
                    {videoResults.filter(v => v.reviewStatus === 'accepted').length} videouri acceptate
                  </p>
                  <Button
                    onClick={async () => {
                      const acceptedVideos = videoResults.filter(v => v.reviewStatus === 'accepted' && v.videoUrl);
                      
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
                    Download All Accepted Videos ({videoResults.filter(v => v.reviewStatus === 'accepted' && v.videoUrl).length})
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
