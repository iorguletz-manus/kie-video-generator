import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Play, Loader2, X, Check, Download, RefreshCw, Clock } from "lucide-react";
import { toast as toastFn } from "sonner";

interface Step6Props {
  videoResults: any[];
  setVideoResults: (results: any[] | ((prev: any[]) => any[])) => void;
  step5Filter: 'all' | 'accepted' | 'regenerate';
  setStep5Filter: (filter: 'all' | 'accepted' | 'regenerate') => void;
  step5FilteredVideos: any[];
  acceptedCount: number;
  regenerateCount: number;
  combinations: any[];
  modifyingVideoIndex: number | null;
  setModifyingVideoIndex: (index: number | null) => void;
  modifyDialogueText: string;
  setModifyDialogueText: (text: string) => void;
  modifyRedStart: number;
  setModifyRedStart: (start: number) => void;
  modifyRedEnd: number;
  setModifyRedEnd: (end: number) => void;
  modifyEditorRef: React.RefObject<HTMLDivElement>;
  regenerateMultiple: boolean;
  setRegenerateMultiple: (multiple: boolean) => void;
  regenerateVariantCount: number;
  setRegenerateVariantCount: (count: number) => void;
  regenerateVariants: any[];
  setRegenerateVariants: (variants: any[]) => void;
  editTimestamps: Record<number, number>;
  setEditTimestamps: (timestamps: Record<number, number> | ((prev: Record<number, number>) => Record<number, number>)) => void;
  currentTime: number;
  generateMultipleVariantsMutation: any;
  generateBatchMutation: any;
  regenerateAll: () => Promise<void>;
  prompts: any[];
  setCombinations: (combinations: any[]) => void;
  modifyPromptText: string;
  setModifyPromptText: (text: string) => void;
  modifyPromptType: string;
  setModifyPromptType: (type: any) => void;
  selectedVideoIndex: number;
  setSelectedVideoIndex: (index: number) => void;
  loadSampleVideos: () => Promise<void>;
  regenerateSingleVideo: (index: number) => Promise<void>;
  regenerateWithModifications: (index: number) => Promise<void>;
  goToCheckVideos: () => void;
  images: any[];
  setCurrentStep: (step: number) => void;
  setAdLines: (lines: any[]) => void;
  setCustomPrompts: (prompts: any[]) => void;
  toast: typeof toastFn;
}

export function Step6(props: Step6Props) {
  const {
    videoResults,
    setVideoResults,
    step5Filter,
    setStep5Filter,
    step5FilteredVideos,
    acceptedCount,
    regenerateCount,
    combinations,
    modifyingVideoIndex,
    setModifyingVideoIndex,
    modifyDialogueText,
    setModifyDialogueText,
    modifyRedStart,
    setModifyRedStart,
    modifyRedEnd,
    setModifyRedEnd,
    modifyEditorRef,
    regenerateMultiple,
    setRegenerateMultiple,
    regenerateVariantCount,
    setRegenerateVariantCount,
    regenerateVariants,
    setRegenerateVariants,
    editTimestamps,
    setEditTimestamps,
    currentTime,
    generateMultipleVariantsMutation,
    generateBatchMutation,
    regenerateAll,
    prompts,
    setCombinations,
    modifyPromptText,
    setModifyPromptText,
    modifyPromptType,
    setModifyPromptType,
    selectedVideoIndex,
    setSelectedVideoIndex,
    loadSampleVideos,
    regenerateSingleVideo,
    regenerateWithModifications,
    goToCheckVideos,
    images,
    setCurrentStep,
    setAdLines,
    setCustomPrompts,
    toast,
  } = props;

  return (
    <Card className="mb-8 border-2 border-blue-200">
            <CardHeader className="bg-blue-50">
              <CardTitle className="flex items-center gap-2 text-blue-900">
                <Play className="w-5 h-5" />
                STEP 6 - Videouri Generate
              </CardTitle>
              <CardDescription>
                Urmărește progresul generării videourilo și descarcă-le.
              </CardDescription>
              {/* MARKER TEST - VERSIUNE NOUA INCARCATA! */}
              <div className="mt-4 p-4 bg-yellow-200 border-4 border-red-600 rounded-lg">
                <p className="text-2xl font-bold text-red-600">🔥 MARKER TEST: VERSIUNE NOUĂ ÎNCĂRCATĂ! 🔥</p>
                <p className="text-lg text-gray-800">Dacă vezi acest mesaj, modificările se încarcă corect!</p>
              </div>
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
                        {/* Unified Status Section - Works for ALL statuses */}
                        <div className="mt-3">
                          {/* PENDING Status */}
                          {result.status === 'pending' && (
                            <div className="flex items-center gap-2">
                              <Loader2 className="w-4 h-4 animate-spin text-orange-600" />
                              <span className="text-sm text-orange-600 font-medium">În curs de generare... (auto-refresh la 5s)</span>
                            </div>
                          )}

                          {/* SUCCESS Status */}
                          {result.status === 'success' && result.videoUrl && (
                            <div className="space-y-2">
                              {/* Accepted Badge */}
                              {result.reviewStatus === 'accepted' && (
                                <div className="flex items-center gap-2 bg-green-50 border-2 border-green-500 px-3 py-2 rounded-lg">
                                  <Check className="w-5 h-5 text-green-600" />
                                  <span className="text-sm text-green-700 font-bold">Accepted</span>
                                </div>
                              )}

                              {/* Rejected Badge + Modify Button - MOVED TO FAILED SECTION */}
                              {false && result.reviewStatus === 'regenerate' && (
                                <div className="flex items-center gap-2 justify-between w-full">
                                  <div className="flex items-center gap-2 bg-red-50 border-2 border-red-500 px-3 py-2 rounded-lg">
                                    <X className="w-5 h-5 text-red-600" />
                                    <span className="text-sm text-red-700 font-bold">Rejected</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      console.log('[Modify & Regenerate] Clicked for rejected video:', result.videoName, 'realIndex:', realIndex);
                                      
                                      if (realIndex < 0) {
                                        toast.error('Video nu găsit în videoResults');
                                        return;
                                      }
                                      
                                      setModifyingVideoIndex(realIndex);
                                      const currentPromptType = combinations[realIndex]?.promptType || 'PROMPT_NEUTRAL';
                                      setModifyPromptType(currentPromptType);
                                      
                                      if (currentPromptType === 'PROMPT_CUSTOM' && customPrompts[realIndex]) {
                                        setModifyPromptText(customPrompts[realIndex]);
                                      } else {
                                        setModifyPromptText('');
                                      }
                                      
                                      setModifyDialogueText(result.text);
                                      
                                      const combo = combinations[realIndex];
                                      if (combo) {
                                        const originalLine = adLines.find(l => l.text === combo.text);
                                        if (originalLine) {
                                          setModifyRedStart(originalLine.redStart ?? -1);
                                          setModifyRedEnd(originalLine.redEnd ?? -1);
                                        } else {
                                          setModifyRedStart(-1);
                                          setModifyRedEnd(-1);
                                        }
                                      }
                                      
                                      setTimeout(() => {
                                        const formElement = document.querySelector(`[data-modify-form="global"]`);
                                        if (formElement) {
                                          formElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                                        }
                                      }, 100);
                                    }}
                                    className="px-3 py-1.5 text-sm border-2 border-orange-500 text-orange-700 bg-white hover:bg-orange-50 rounded-md font-medium transition-colors"
                                  >
                                    Modify & Regenerate
                                  </button>
                                </div>
                              )}

                              {/* Generated Badge (not accepted, not rejected) */}
                              {!result.reviewStatus && (
                                <div className="flex items-center gap-2 bg-green-50 border-2 border-green-500 px-3 py-2 rounded-lg">
                                  <Check className="w-5 h-5 text-green-600" />
                                  <span className="text-sm text-green-700 font-bold">Generated</span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* FAILED or REJECTED Status */}
                          {(result.status === 'failed' || result.reviewStatus === 'regenerate') && (
                            <div className="space-y-2">
                              <div className="bg-red-50 border-2 border-red-500 px-4 py-2 rounded-lg">
                                <div className="flex items-center gap-2 mb-1">
                                  <X className="w-5 h-5 text-red-600" />
                                  <span className="text-base text-red-700 font-bold">
                                    {result.status === 'failed' ? 'Failed' : 'Rejected'}
                                  </span>
                                </div>
                                {result.status === 'failed' && (
                                  <p className="text-sm text-red-600 ml-7">
                                    {result.error || 'Unknown error'}
                                  </p>
                                )}
                              </div>
                              
                              {/* Butoane: Modify & Regenerate + Duplicate */}
                              <div className="flex flex-col sm:flex-row gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    console.log('[Modify & Regenerate] Clicked for failed video:', result.videoName, 'realIndex:', realIndex);
                                    
                                    if (realIndex < 0) {
                                      toast.error('Video nu găsit în videoResults');
                                      return;
                                    }
                                    
                                    setModifyingVideoIndex(realIndex);
                                    const currentPromptType = combinations[realIndex]?.promptType || 'PROMPT_NEUTRAL';
                                    setModifyPromptType(currentPromptType);
                                    
                                    if (currentPromptType === 'PROMPT_CUSTOM' && customPrompts[realIndex]) {
                                      setModifyPromptText(customPrompts[realIndex]);
                                    } else {
                                      setModifyPromptText('');
                                    }
                                    
                                    setModifyDialogueText(result.text);
                                    
                                    const combo = combinations[realIndex];
                                    if (combo) {
                                      const originalLine = adLines.find(l => l.text === combo.text);
                                      if (originalLine) {
                                        setModifyRedStart(originalLine.redStart ?? -1);
                                        setModifyRedEnd(originalLine.redEnd ?? -1);
                                      } else {
                                        setModifyRedStart(-1);
                                        setModifyRedEnd(-1);
                                      }
                                    }
                                    
                                    setTimeout(() => {
                                      const formElement = document.querySelector(`[data-modify-form="global"]`);
                                      if (formElement) {
                                        formElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                                      }
                                    }, 100);
                                  }}
                                  className="flex-1 px-3 py-1.5 text-sm border-2 border-orange-500 text-orange-700 bg-white hover:bg-orange-50 rounded-md font-medium transition-colors"
                                >
                                  Modify & Regenerate
                                </button>
                                
                                <button
                                  type="button"
                                  onClick={() => {
                                    const duplicateVideoFn = (window as any).__duplicateVideo;
                                    if (duplicateVideoFn) {
                                      duplicateVideoFn(result.videoName);
                                    } else {
                                      toast.error('Funcția duplicate nu este disponibilă');
                                    }
                                  }}
                                  className="flex-1 px-3 py-1.5 text-sm border-2 border-blue-500 text-blue-700 bg-white hover:bg-blue-50 rounded-md font-medium transition-colors"
                                >
                                  Duplicate
                                </button>
                              </div>
                            </div>
                          )}

                          {/* NULL Status (duplicate negenerat) */}
                          {result.status === null && (
                            <div className="space-y-2">
                              <div className="bg-gray-50 border-2 border-gray-400 px-4 py-2 rounded-lg">
                                <div className="flex items-center gap-2">
                                  <Clock className="w-5 h-5 text-gray-600" />
                                  <span className="text-base text-gray-700 font-bold">
                                    Not Generated Yet {result.isDuplicate && `(Duplicate ${result.duplicateNumber})`}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-600 ml-7 mt-1">
                                  Va fi generat când apeși "Regenerate All"
                                </p>
                              </div>
                              
                              {/* Butoane: Modify & Regenerate + Delete Duplicate */}
                              <div className="flex flex-col sm:flex-row gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    console.log('[Modify & Regenerate] Clicked for not generated video:', result.videoName, 'realIndex:', realIndex);
                                    
                                    if (realIndex < 0) {
                                      toast.error('Video nu găsit în videoResults');
                                      return;
                                    }
                                    
                                    setModifyingVideoIndex(realIndex);
                                    const currentPromptType = combinations[realIndex]?.promptType || 'PROMPT_NEUTRAL';
                                    setModifyPromptType(currentPromptType);
                                    
                                    if (currentPromptType === 'PROMPT_CUSTOM' && customPrompts[realIndex]) {
                                      setModifyPromptText(customPrompts[realIndex]);
                                    } else {
                                      setModifyPromptText('');
                                    }
                                    
                                    setModifyDialogueText(result.text);
                                    
                                    const combo = combinations[realIndex];
                                    if (combo) {
                                      const originalLine = adLines.find(l => l.text === combo.text);
                                      if (originalLine) {
                                        setModifyRedStart(originalLine.redStart ?? -1);
                                        setModifyRedEnd(originalLine.redEnd ?? -1);
                                      } else {
                                        setModifyRedStart(-1);
                                        setModifyRedEnd(-1);
                                      }
                                    }
                                    
                                    setTimeout(() => {
                                      const formElement = document.querySelector(`[data-modify-form="global"]`);
                                      if (formElement) {
                                        formElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                                      }
                                    }, 100);
                                  }}
                                  className="flex-1 px-3 py-1.5 text-sm border-2 border-orange-500 text-orange-700 bg-white hover:bg-orange-50 rounded-md font-medium transition-colors"
                                >
                                  Modify & Regenerate
                                </button>
                                
                                {result.isDuplicate && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const deleteDuplicateFn = (window as any).__deleteDuplicate;
                                      if (deleteDuplicateFn) {
                                        deleteDuplicateFn(result.videoName);
                                      } else {
                                        toast.error('Funcția delete duplicate nu este disponibilă');
                                      }
                                    }}
                                    className="flex-1 px-3 py-1.5 text-sm border-2 border-red-500 text-red-700 bg-white hover:bg-red-50 rounded-md font-medium transition-colors"
                                  >
                                    Delete Duplicate
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
              
              {/* Global Modify & Regenerate Form - Works for ALL video statuses */}
                                {modifyingVideoIndex !== null && (
                                  <div 
                                    data-modify-form="global"
                                    className="mt-4 p-4 bg-white border-2 border-orange-300 rounded-lg space-y-3"
                                  >
                                    <h5 className="font-bold text-orange-900">Modify & Regenerate</h5>
                                    
                                    {/* Radio: Vrei să regenerezi mai multe videouri? */}
                                    <div className="p-3 bg-orange-50 border border-orange-200 rounded">
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
                                              // Creează array cu regenerateVariantCount variante
                                              const variants = Array(regenerateVariantCount).fill(null).map(() => ({ ...initialVariant }));
                                              setRegenerateVariants(variants);
                                              console.log('[Regenerate Multiple] Initialized', variants.length, 'variants');
                                            }}
                                            className="w-4 h-4"
                                          />
                                          <span className="text-sm">Da</span>
                                        </label>
                                      </div>
                                    </div>
                                    
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
                                    
                                    {/* Edit Dialogue Text - WYSIWYG */}
                                    <div>
                                      <label className="text-sm font-medium text-gray-700 block mb-1">Edit Text:</label>
                                      
                                      {/* Color Toolbar */}
                                      <div className="flex gap-2 p-2 bg-gray-100 rounded mb-2">
                                        <Button
                                          onClick={() => {
                                            document.execCommand('foreColor', false, '#dc2626'); // RED-600
                                          }}
                                          variant="outline"
                                          size="sm"
                                          className="bg-red-600 text-white hover:bg-red-700"
                                          type="button"
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
                                          type="button"
                                        >
                                          BLACK
                                        </Button>
                                        <Button
                                          onClick={() => {
                                            document.execCommand('removeFormat', false, '');
                                          }}
                                          variant="outline"
                                          size="sm"
                                          type="button"
                                        >
                                          Clear Format
                                        </Button>
                                      </div>
                                      
                                      {/* Editable Content */}
                                      <div
                                        ref={modifyEditorRef}
                                        contentEditable
                                        suppressContentEditableWarning
                                        onInput={(e) => {
                                          const text = e.currentTarget.textContent || '';
                                          setModifyDialogueText(text);
                                        }}
                                        className="min-h-[80px] p-3 border-2 border-gray-300 rounded focus:outline-none focus:border-blue-500 text-sm"
                                        style={{ whiteSpace: 'pre-wrap' }}
                                      >
                                        {modifyDialogueText}
                                      </div>
                                      
                                      <p className={`text-xs mt-1 ${
                                        modifyDialogueText.length > 125 ? 'text-orange-600 font-bold' : 'text-gray-500'
                                      }`}>
                                        {modifyDialogueText.length} caractere{modifyDialogueText.length > 125 ? ` ⚠️ Warning: ${modifyDialogueText.length - 125} caractere depășite!` : ''}
                                      </p>
                                    </div>
                                    
                                    {/* Buttons (mod single) */}
                                    <div className="flex gap-2">
                                      <Button
                                        size="sm"
                                        onClick={() => {
                                          // SAVE: salvează modificări fără regenerare
                                          
                                          if (!modifyEditorRef.current) return;
                                          
                                          // Extract HTML and text from editor
                                          const html = modifyEditorRef.current.innerHTML || '';
                                          const text = modifyEditorRef.current.textContent || '';
                                          
                                          console.log('[Save Modify] Extracting red text from HTML:', html.substring(0, 100));
                                          
                                          // Parse HTML to find RED text positions
                                          let redStart = -1;
                                          let redEnd = -1;
                                          
                                          const redSpanRegex = /<span[^>]*style="[^"]*color:\s*(?:#dc2626|rgb\(220,\s*38,\s*38\))[^"]*"[^>]*>([^<]*)<\/span>/gi;
                                          const matches = [...html.matchAll(redSpanRegex)];
                                          console.log('[Save Modify] Found', matches.length, 'red spans');
                                          
                                          if (matches.length > 0) {
                                            const redText = matches[0][1];
                                            redStart = text.indexOf(redText);
                                            if (redStart >= 0) {
                                              redEnd = redStart + redText.length;
                                            }
                                          }
                                          
                                          // Update state
                                          setModifyRedStart(redStart);
                                          setModifyRedEnd(redEnd);
                                          
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
                                            text: text,
                                            promptType: modifyPromptType,
                                          };
                                          setCombinations(updatedCombinations);
                                          
                                          // Update adLines with red text positions
                                          setAdLines(prev => prev.map(line => {
                                            if (line.text === combinations[index].text) {
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
                                          
                                          // Update videoResults cu noul text ȘI red positions
                                          setVideoResults(prev =>
                                            prev.map((v, i) =>
                                              i === index ? { 
                                                ...v, 
                                                text: text,
                                                redStart: redStart,
                                                redEnd: redEnd,
                                              } : v
                                            )
                                          );
                                          
                                          console.log('[Save Modify] Updated videoResults[' + index + '] with red text:', redStart, '-', redEnd);
                                          
                                          // Salvează timestamp pentru "Edited X min ago"
                                          setEditTimestamps(prev => ({
                                            ...prev,
                                            [index]: Date.now(),
                                          }));
                                          
                                          // SAVE TO DATABASE
                                          console.log('[Database Save] Saving after text modification...');
                                          const updatedVideoResults = videoResults.map((v, i) =>
                                            i === index ? { 
                                              ...v, 
                                              text: text,
                                              redStart: redStart,
                                              redEnd: redEnd,
                                            } : v
                                          );
                                          
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
                                          
                                          {/* Regenerate All - trimite toate variantele pentru generare */}
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
                                          </Button>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                )}
              
              {/* Buton Regenerate ALL (Failed + Rejected) */}
              {videoResults.some(v => v.status === 'failed' || v.reviewStatus === 'regenerate') && (
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
  );
}
