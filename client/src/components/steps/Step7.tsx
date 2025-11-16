import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// TODO: Add proper props interface
interface Step7Props {
  [key: string]: any; // Temporary - will be refined
}

export function Step7(props: Step7Props) {
  // TODO: Destructure props as needed
  
  return (
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
  );
}
