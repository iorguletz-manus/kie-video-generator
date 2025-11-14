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
  file: File;
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
  
  // Step 6: Check Videos (review)
  const [reviewHistory, setReviewHistory] = useState<Array<{
    videoName: string;
    previousStatus: 'pending' | 'accepted' | 'regenerate' | null;
    newStatus: 'pending' | 'accepted' | 'regenerate' | null;
  }>>([]);
  
  // Current step
  const [currentStep, setCurrentStep] = useState(1);

  // Mutations
  const parseAdMutation = trpc.video.parseAdDocument.useMutation();
  const parsePromptMutation = trpc.video.parsePromptDocument.useMutation();
  const uploadImageMutation = trpc.video.uploadImage.useMutation();
  const generateBatchMutation = trpc.video.generateBatchVideos.useMutation();

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
      setDeletedCombinations(prev => [combo, ...prev]);
      setCombinations(prev => prev.filter(c => c.id !== id));
    }
  };

  const undoDelete = () => {
    if (deletedCombinations.length > 0) {
      const lastDeleted = deletedCombinations[0];
      setCombinations(prev => [...prev, lastDeleted]);
      setDeletedCombinations(prev => prev.slice(1));
      toast.success("Combinație restaurată");
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
      const response = await fetch(`https://api.kie.ai/api/v1/veo/record-info?taskId=${taskId}`, {
        headers: {
          'Authorization': 'Bearer a4089052f1c04c6b8be02b026ce87fe8',
        },
      });

      const data = await response.json();

      if (data.code === 200 && data.data) {
        let status: 'pending' | 'success' | 'failed' = 'pending';
        let videoUrl: string | undefined;

        if (data.data.successFlag === 1) {
          status = 'success';
          videoUrl = data.data.resultUrls?.[0];
        } else if (data.data.successFlag === -1) {
          status = 'failed';
        }

        setVideoResults(prev =>
          prev.map((v, i) =>
            i === index
              ? {
                  ...v,
                  status: status,
                  videoUrl: videoUrl,
                  error: data.data.errorMessage || undefined,
                }
              : v
          )
        );

        if (status === 'success') {
          toast.success(`Video #${index + 1} generat cu succes!`);
        }
      }
    } catch (error: any) {
      toast.error(`Eroare la verificarea statusului: ${error.message}`);
    }
  };

  const downloadVideo = (url: string, index: number) => {
    window.open(url, '_blank');
    toast.success(`Descărcare video #${index + 1} pornită`);
  };

  // Auto-check status la 80s, apoi din 10 în 10s
  useEffect(() => {
    if (videoResults.length === 0) return;

    const pendingVideos = videoResults.filter(v => v.status === 'pending');
    if (pendingVideos.length === 0) return;

    // Primul check la 80 secunde
    const initialTimeout = setTimeout(() => {
      pendingVideos.forEach((video, idx) => {
        const actualIndex = videoResults.findIndex(v => v.taskId === video.taskId);
        if (actualIndex !== -1 && video.taskId) {
          checkVideoStatus(video.taskId, actualIndex);
        }
      });
    }, 80000);

    // Check-uri repetate din 10 în 10 secunde
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
      clearTimeout(initialTimeout);
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

        {/* Breadcrumbs */}
        <div className="flex justify-between items-center mb-8 px-4">
          {[
            { num: 1, label: "Text Ad", icon: FileText },
            { num: 2, label: "Prompts", icon: FileText },
            { num: 3, label: "Images", icon: ImageIcon },
            { num: 4, label: "Mapping", icon: Map },
            { num: 5, label: "Generate", icon: Play },
            { num: 6, label: "Check Videos", icon: Video },
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
                onClick={() => document.getElementById('ad-upload')?.click()}
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
                    <p className="font-medium text-blue-900 mb-3">
                      {prompts.length} prompturi custom încărcate:
                    </p>
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
                              <div className="flex items-center gap-2 bg-green-50 px-3 py-1 rounded">
                                <Check className="w-4 h-4 text-green-600" />
                                <span className="text-sm text-green-600 font-medium">Success</span>
                              </div>
                              <a
                                href={result.videoUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-blue-600 hover:underline flex-1 truncate"
                                title={result.videoUrl}
                              >
                                {result.videoUrl.substring(0, 50)}...
                              </a>
                              <Button
                                size="sm"
                                onClick={() => downloadVideo(result.videoUrl!, index)}
                                className="ml-auto bg-green-600 hover:bg-green-700 gap-2"
                              >
                                <Download className="w-4 h-4" />
                                Download
                              </Button>
                            </>
                          )}
                          {result.status === 'failed' && (
                            <>
                              <div className="flex items-center gap-2 bg-red-50 px-3 py-1 rounded">
                                <X className="w-4 h-4 text-red-600" />
                                <span className="text-sm text-red-600 font-medium">
                                  Failed: {result.error || 'Unknown error'}
                                </span>
                              </div>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => {
                                  toast.info('Regenerare video - feature în curs de implementare');
                                }}
                                className="ml-auto bg-red-600 hover:bg-red-700"
                              >
                                Regenerate
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
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

        {/* STEP 6: Check Videos (Review) */}
        {currentStep === 6 && videoResults.length > 0 && (
          <Card className="mb-8 border-2 border-green-200">
            <CardHeader className="bg-green-50">
              <CardTitle className="flex items-center gap-2 text-green-900">
                <Video className="w-5 h-5" />
                STEP 6 - Check Videos
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
                const categoryVideos = videoResults.filter(v => v.section === category && v.status === 'success');
                
                if (categoryVideos.length === 0) return null;
                
                return (
                  <div key={category} className="mb-8">
                    <h3 className="text-xl font-bold text-green-900 mb-4 border-b-2 border-green-300 pb-2">
                      {category}
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {categoryVideos.map((video) => (
                        <div key={video.videoName} className="p-4 bg-white rounded-lg border-2 border-green-200">
                          {/* Nume video */}
                          <h4 className="font-bold text-green-900 mb-2">{video.videoName}</h4>
                          
                          {/* Text dialogue */}
                          <p className="text-sm text-gray-700 mb-3 line-clamp-3">{video.text}</p>
                          
                          {/* Video player */}
                          {video.videoUrl && (
                            <video
                              src={video.videoUrl}
                              controls
                              className="w-full aspect-[9/16] object-cover rounded border-2 border-green-300 mb-3"
                            />
                          )}
                          
                          {/* Butoane Accept / Regenerate - mici */}
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
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
