import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Upload, X, Check, Loader2, Video, FileText, Image as ImageIcon, Map, Play } from "lucide-react";

interface AdLine {
  id: string;
  text: string;
}

interface UploadedImage {
  id: string;
  url: string;
  file: File;
}

interface Combination {
  id: string;
  text: string;
  imageUrl: string;
  imageId: string;
}

interface VideoResult {
  taskId?: string;
  text: string;
  imageUrl: string;
  status: 'pending' | 'success' | 'failed' | null;
  videoUrl?: string;
  error?: string;
}

export default function Home() {
  // Step 1: Text Ad
  const [adDocument, setAdDocument] = useState<File | null>(null);
  const [adLines, setAdLines] = useState<AdLine[]>([]);
  
  // Step 2: Prompt
  const [promptDocument, setPromptDocument] = useState<File | null>(null);
  const [promptTemplate, setPromptTemplate] = useState<string>("");
  const [manualPrompt, setManualPrompt] = useState<string>("");
  
  // Step 3: Images
  const [images, setImages] = useState<UploadedImage[]>([]);
  
  // Step 4: Mapping
  const [combinations, setCombinations] = useState<Combination[]>([]);
  
  // Step 5: Generate
  const [videoResults, setVideoResults] = useState<VideoResult[]>([]);
  
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
        
        const lines: AdLine[] = result.lines.map((line, index) => ({
          id: `line-${index}`,
          text: line,
        }));
        
        setAdLines(lines);
        toast.success(`${lines.length} linii extrase din document`);
      };
      reader.readAsDataURL(file);
    } catch (error: any) {
      toast.error(`Eroare la parsarea documentului: ${error.message}`);
    }
  };

  // Step 2: Handle prompt document upload
  const handlePromptDocumentDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.docx') || file.name.endsWith('.doc'))) {
      setPromptDocument(file);
      await parsePromptDocument(file);
    } else {
      toast.error("Te rog încarcă un document .docx");
    }
  };

  const handlePromptDocumentSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPromptDocument(file);
      await parsePromptDocument(file);
    }
  };

  const parsePromptDocument = async (file: File) => {
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        const result = await parsePromptMutation.mutateAsync({ documentData: base64 });
        
        setPromptTemplate(result.promptTemplate);
        setManualPrompt(result.promptTemplate);
        toast.success("Prompt încărcat cu succes");
      };
      reader.readAsDataURL(file);
    } catch (error: any) {
      toast.error(`Eroare la parsarea promptului: ${error.message}`);
    }
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
    
    for (const file of imageFiles) {
      try {
        const reader = new FileReader();
        reader.onload = async (event) => {
          const base64 = event.target?.result as string;
          const result = await uploadImageMutation.mutateAsync({
            imageData: base64,
            fileName: file.name,
          });
          
          const newImage: UploadedImage = {
            id: `img-${Date.now()}-${Math.random()}`,
            url: result.imageUrl,
            file: file,
          };
          
          setImages(prev => [...prev, newImage]);
        };
        reader.readAsDataURL(file);
      } catch (error: any) {
        toast.error(`Eroare la încărcarea imaginii ${file.name}: ${error.message}`);
      }
    }
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

    // Creează combinații: fiecare linie cu prima imagine (default)
    const newCombinations: Combination[] = adLines.map((line, index) => ({
      id: `combo-${index}`,
      text: line.text,
      imageUrl: images[0].url,
      imageId: images[0].id,
    }));

    setCombinations(newCombinations);
    setCurrentStep(4);
    toast.success(`${newCombinations.length} combinații create`);
  };

  const updateCombinationText = (id: string, newText: string) => {
    setCombinations(prev =>
      prev.map(combo =>
        combo.id === id ? { ...combo, text: newText } : combo
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
    setCombinations(prev => prev.filter(combo => combo.id !== id));
  };

  // Step 5: Generate videos
  const generateVideos = async () => {
    if (combinations.length === 0) {
      toast.error("Nu există combinații de generat");
      return;
    }

    const finalPrompt = manualPrompt || promptTemplate;
    if (!finalPrompt) {
      toast.error("Te rog încarcă un prompt");
      return;
    }

    try {
      setCurrentStep(5);
      
      // Inițializează rezultatele
      const initialResults: VideoResult[] = combinations.map(combo => ({
        text: combo.text,
        imageUrl: combo.imageUrl,
        status: 'pending' as const,
      }));
      setVideoResults(initialResults);

      const result = await generateBatchMutation.mutateAsync({
        promptTemplate: finalPrompt,
        combinations: combinations.map(combo => ({
          text: combo.text,
          imageUrl: combo.imageUrl,
        })),
      });

      // Actualizează rezultatele cu taskId-uri
      const updatedResults: VideoResult[] = result.results.map(r => ({
        taskId: r.taskId,
        text: r.text,
        imageUrl: r.imageUrl,
        status: r.success ? 'pending' as const : 'failed' as const,
        error: r.error,
      }));

      setVideoResults(updatedResults);
      toast.success(`${result.totalGenerated} videouri trimise spre generare`);
      
      if (result.totalFailed > 0) {
        toast.error(`${result.totalFailed} videouri au eșuat`);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 py-8">
      <div className="container max-w-6xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-blue-900 mb-2">Kie.ai Video Generator</h1>
          <p className="text-blue-700">Generează videouri AI în masă cu Kie.ai Veo 3.1</p>
        </div>

        {/* Progress Steps */}
        <div className="flex justify-between items-center mb-12 px-4">
          {[
            { num: 1, label: "Text Ad", icon: FileText },
            { num: 2, label: "Prompt", icon: FileText },
            { num: 3, label: "Images", icon: ImageIcon },
            { num: 4, label: "Mapping", icon: Map },
            { num: 5, label: "Generate", icon: Play },
          ].map((step, index) => (
            <div key={step.num} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center font-bold transition-all ${
                    currentStep >= step.num
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {currentStep > step.num ? (
                    <Check className="w-6 h-6" />
                  ) : (
                    <step.icon className="w-6 h-6" />
                  )}
                </div>
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
              {index < 4 && (
                <div
                  className={`h-1 flex-1 mx-2 transition-all ${
                    currentStep > step.num ? "bg-blue-600" : "bg-gray-200"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* STEP 1: Text Ad */}
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
          <CardContent className="pt-6">
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
              <p className="text-sm text-blue-600">Suportă .docx</p>
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
                      <span className="font-medium text-blue-700">#{index + 1}:</span> {line.text}
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

        {/* STEP 2: Prompt */}
        {currentStep >= 2 && (
          <Card className="mb-8 border-2 border-blue-200">
            <CardHeader className="bg-blue-50">
              <CardTitle className="flex items-center gap-2 text-blue-900">
                <FileText className="w-5 h-5" />
                STEP 2 - Prompt Upload
              </CardTitle>
              <CardDescription>
                Încarcă documentul cu promptul (.docx) sau scrie manual. [INSERT TEXT] va fi înlocuit cu textul din ad.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div
                onDrop={handlePromptDocumentDrop}
                onDragOver={(e) => e.preventDefault()}
                className="border-2 border-dashed border-blue-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors cursor-pointer bg-blue-50/50 mb-4"
                onClick={() => document.getElementById('prompt-upload')?.click()}
              >
                <Upload className="w-12 h-12 text-blue-500 mx-auto mb-4" />
                <p className="text-blue-900 font-medium mb-2">
                  {promptDocument ? promptDocument.name : "Drop prompt document here or click to upload"}
                </p>
                <p className="text-sm text-blue-600">Suportă .docx</p>
                <input
                  id="prompt-upload"
                  type="file"
                  accept=".docx,.doc"
                  className="hidden"
                  onChange={handlePromptDocumentSelect}
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-blue-900 mb-2">
                  Sau editează promptul manual:
                </label>
                <Textarea
                  value={manualPrompt}
                  onChange={(e) => setManualPrompt(e.target.value)}
                  placeholder="Scrie promptul aici... Asigură-te că include [INSERT TEXT] unde vrei să fie inserat textul din ad."
                  className="min-h-[200px] font-mono text-sm"
                />
              </div>

              {(promptTemplate || manualPrompt) && (
                <Button
                  onClick={() => setCurrentStep(3)}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Continuă la STEP 3
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* STEP 3: Images */}
        {currentStep >= 3 && (
          <Card className="mb-8 border-2 border-blue-200">
            <CardHeader className="bg-blue-50">
              <CardTitle className="flex items-center gap-2 text-blue-900">
                <ImageIcon className="w-5 h-5" />
                STEP 3 - Images Upload
              </CardTitle>
              <CardDescription>
                Încarcă imaginile pentru videouri. Poți încărca multiple imagini.
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
                <p className="text-sm text-blue-600">Suportă JPG, PNG, WEBP</p>
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
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {images.map((image) => (
                      <div key={image.id} className="relative group">
                        <img
                          src={image.url}
                          alt="Uploaded"
                          className="w-full h-32 object-cover rounded border-2 border-blue-200"
                        />
                        <button
                          onClick={() => removeImage(image.id)}
                          className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-4 h-4" />
                        </button>
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
        {currentStep >= 4 && combinations.length > 0 && (
          <Card className="mb-8 border-2 border-blue-200">
            <CardHeader className="bg-blue-50">
              <CardTitle className="flex items-center gap-2 text-blue-900">
                <Map className="w-5 h-5" />
                STEP 4 - Mapping (Text + Image)
              </CardTitle>
              <CardDescription>
                Configurează combinațiile de text și imagine pentru fiecare video.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="mb-6 p-4 bg-blue-100 rounded-lg">
                <p className="text-blue-900 font-medium">
                  📊 Statistici: {combinations.length} videouri vor fi generate
                </p>
              </div>

              <div className="space-y-4 max-h-[600px] overflow-y-auto">
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
                          className="w-32 p-2 border border-blue-300 rounded text-sm"
                        >
                          {images.map((img, imgIndex) => (
                            <option key={img.id} value={img.id}>
                              Imagine {imgIndex + 1}
                            </option>
                          ))}
                        </select>
                        <img
                          src={combo.imageUrl}
                          alt="Selected"
                          className="w-32 h-32 object-cover rounded border-2 border-blue-300 mt-2"
                        />
                      </div>

                      {/* Text editor */}
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-blue-900 mb-2">
                          Text pentru Dialogue
                        </label>
                        <Textarea
                          value={combo.text}
                          onChange={(e) => updateCombinationText(combo.id, e.target.value)}
                          className="min-h-[120px] text-sm"
                        />
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

              <Button
                onClick={generateVideos}
                disabled={generateBatchMutation.isPending}
                className="mt-6 bg-blue-600 hover:bg-blue-700 w-full py-6 text-lg"
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
        {currentStep >= 5 && videoResults.length > 0 && (
          <Card className="mb-8 border-2 border-blue-200">
            <CardHeader className="bg-blue-50">
              <CardTitle className="flex items-center gap-2 text-blue-900">
                <Play className="w-5 h-5" />
                STEP 5 - Videouri Generate
              </CardTitle>
              <CardDescription>
                Urmărește progresul generării videourilo și accesează link-urile.
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
                        className="w-24 h-24 object-cover rounded border-2 border-blue-300"
                      />
                      <div className="flex-1">
                        <p className="text-sm text-blue-900 mb-2">
                          <span className="font-medium">Text:</span> {result.text.substring(0, 100)}...
                        </p>
                        {result.taskId && (
                          <p className="text-xs text-blue-700 mb-2">
                            TaskID: {result.taskId}
                          </p>
                        )}
                        <div className="flex items-center gap-2">
                          {result.status === 'pending' && (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                              <span className="text-sm text-blue-600">În curs de generare...</span>
                              {result.taskId && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => checkVideoStatus(result.taskId!, index)}
                                  className="ml-auto"
                                >
                                  Verifică Status
                                </Button>
                              )}
                            </>
                          )}
                          {result.status === 'success' && result.videoUrl && (
                            <>
                              <Check className="w-4 h-4 text-green-600" />
                              <a
                                href={result.videoUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-green-600 hover:underline"
                              >
                                {result.videoUrl}
                              </a>
                            </>
                          )}
                          {result.status === 'failed' && (
                            <>
                              <X className="w-4 h-4 text-red-600" />
                              <span className="text-sm text-red-600">
                                Eșuat: {result.error || 'Unknown error'}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
