import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Upload, Video, CheckCircle, XCircle, Clock } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { APP_TITLE } from "@/const";

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoStatus, setVideoStatus] = useState<'pending' | 'success' | 'failed' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadImageMutation = trpc.video.uploadImage.useMutation();
  const generateVideoMutation = trpc.video.generateVideo.useMutation();
  const { refetch: checkStatus, isFetching: isCheckingStatus } = trpc.video.checkVideoStatus.useQuery(
    { taskId: taskId || "" },
    { 
      enabled: false,
      retry: false,
    }
  );

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerateVideo = async () => {
    if (!prompt.trim()) {
      toast.error("Te rog introdu un prompt pentru video!");
      return;
    }

    if (!imageFile) {
      toast.error("Te rog selectează o imagine!");
      return;
    }

    try {
      // Reset state
      setTaskId(null);
      setVideoUrl(null);
      setVideoStatus(null);

      // Upload imagine
      toast.info("Se încarcă imaginea...");
      const reader = new FileReader();
      reader.readAsDataURL(imageFile);
      
      reader.onloadend = async () => {
        try {
          const base64Image = reader.result as string;
          const uploadResult = await uploadImageMutation.mutateAsync({
            imageData: base64Image,
            fileName: imageFile.name,
          });

          if (!uploadResult.success) {
            toast.error("Eroare la încărcarea imaginii");
            return;
          }

          toast.success("Imagine încărcată cu succes!");
          toast.info("Se generează video-ul... (poate dura 10-15 secunde pentru taskId)");

          // Generare video
          const generateResult = await generateVideoMutation.mutateAsync({
            prompt: prompt,
            imageUrl: uploadResult.imageUrl,
          });

          if (generateResult.success && generateResult.taskId) {
            setTaskId(generateResult.taskId);
            setVideoStatus('pending');
            toast.success(`Video în curs de generare! TaskID: ${generateResult.taskId}`);
          }
        } catch (error: any) {
          console.error("Error:", error);
          toast.error(error.message || "Eroare la generarea video-ului");
        }
      };
    } catch (error: any) {
      console.error("Error:", error);
      toast.error(error.message || "Eroare neașteptată");
    }
  };

  const handleCheckVideoStatus = async () => {
    if (!taskId) {
      toast.error("Nu există taskId pentru verificare!");
      return;
    }

    try {
      toast.info("Se verifică statusul video-ului...");
      const result = await checkStatus();

      if (result.data?.success) {
        const status = result.data.status;
        setVideoStatus(status);

        if (status === 'success' && result.data.videoUrl) {
          setVideoUrl(result.data.videoUrl);
          toast.success("Video generat cu succes!");
        } else if (status === 'pending') {
          toast.info("Video-ul este încă în curs de generare. Încearcă din nou în câteva momente.");
        } else if (status === 'failed') {
          toast.error("Generarea video-ului a eșuat!");
        }
      }
    } catch (error: any) {
      console.error("Error checking status:", error);
      toast.error(error.message || "Eroare la verificarea statusului");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container py-8">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-primary mb-2">
              {APP_TITLE}
            </h1>
            <p className="text-muted-foreground">
              Generează videouri AI cu Kie.ai Veo 3.1
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Video className="h-5 w-5" />
                Generare Video
              </CardTitle>
              <CardDescription>
                Introdu un prompt și încarcă o imagine pentru a genera un video de 8 secunde (9:16, 720p)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Prompt Input */}
              <div className="space-y-2">
                <Label htmlFor="prompt">Prompt Video</Label>
                <Textarea
                  id="prompt"
                  placeholder="Descrie video-ul pe care vrei să-l generezi... (ex: A dog playing in a park)"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={4}
                  className="resize-none"
                />
              </div>

              {/* Image Upload */}
              <div className="space-y-2">
                <Label htmlFor="image">Imagine</Label>
                <div className="flex flex-col gap-4">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                    id="image"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {imageFile ? "Schimbă imaginea" : "Selectează imagine"}
                  </Button>

                  {imagePreview && (
                    <div className="relative rounded-lg overflow-hidden border w-[150px]">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-full h-auto object-cover"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Generate Button */}
              <Button
                onClick={handleGenerateVideo}
                disabled={uploadImageMutation.isPending || generateVideoMutation.isPending}
                className="w-full"
                size="lg"
              >
                {(uploadImageMutation.isPending || generateVideoMutation.isPending) ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Se generează...
                  </>
                ) : (
                  <>
                    <Video className="h-4 w-4 mr-2" />
                    Generează Video
                  </>
                )}
              </Button>

              {/* Status Display */}
              {taskId && (
                <div className="space-y-4 pt-4 border-t">
                  <Alert>
                    <Clock className="h-4 w-4" />
                    <AlertDescription>
                      <strong>TaskID:</strong> {taskId}
                      <br />
                      Video-ul durează aproximativ 2 minute să se genereze.
                    </AlertDescription>
                  </Alert>

                  {videoStatus === 'pending' && (
                    <Alert>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <AlertDescription>
                        Video în curs de generare...
                      </AlertDescription>
                    </Alert>
                  )}

                  {videoStatus === 'failed' && (
                    <Alert variant="destructive">
                      <XCircle className="h-4 w-4" />
                      <AlertDescription>
                        Generarea video-ului a eșuat. Te rog încearcă din nou.
                      </AlertDescription>
                    </Alert>
                  )}

                  {videoStatus === 'success' && videoUrl && (
                    <Alert className="bg-green-50 border-green-200">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-green-800">
                        <strong>Video generat cu succes!</strong>
                        <br />
                        <a
                          href={videoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline hover:no-underline"
                        >
                          {videoUrl}
                        </a>
                      </AlertDescription>
                    </Alert>
                  )}

                  <Button
                    onClick={handleCheckVideoStatus}
                    disabled={isCheckingStatus}
                    variant="secondary"
                    className="w-full"
                  >
                    {isCheckingStatus ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Se verifică...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Verifică Status Video
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
