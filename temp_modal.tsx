      <Dialog open={isTrimmingModalOpen} onOpenChange={(open) => {
        // Allow closing only when NOT processing
        if (!open && trimmingProgress.status === 'processing') return;
        setIsTrimmingModalOpen(open);
      }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" onInteractOutside={(e) => {
          // Prevent closing by clicking outside during processing
          if (trimmingProgress.status === 'processing') e.preventDefault();
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
            {/* Progress Bar (always visible during processing) */}
            {trimmingProgress.status === 'processing' && (
              <div className="space-y-2">
                <Progress 
                  value={(trimmingProgress.current / trimmingProgress.total) * 100} 
                  className="h-3"
                />
                <p className="text-center text-sm font-medium text-gray-700">
                  {trimmingProgress.current}/{trimmingProgress.total} videouri procesate
                </p>
                
                {/* Countdown message */}
                {trimmingProgress.message && (
                  <p className="text-center text-xs text-gray-500">
                    {trimmingProgress.message}
                  </p>
                )}
              </div>
            )}
            
            {/* Success List (always visible when there are successes) */}
            {trimmingProgress.successVideos.length > 0 && (
              <div>
                <p className="text-sm font-medium text-green-700 mb-2">
                  ✅ Success ({trimmingProgress.successVideos.length}):
                </p>
                <div className="max-h-48 overflow-y-auto bg-green-50 border border-green-200 rounded-lg p-3 space-y-1">
                  {trimmingProgress.successVideos.map((v, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-green-700">
                      <span className="text-green-600">✓</span>
                      <span>{v.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Failed List (always visible when there are failures) */}
            {trimmingProgress.failedVideos.length > 0 && (
              <div>
                <p className="text-sm font-medium text-red-700 mb-2">
                  ❌ Failed ({trimmingProgress.failedVideos.length}):
                </p>
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
            
            {/* Action Buttons */}
            <div className="flex gap-2 mt-6">
              {/* Continue to Step 9 (only if processing complete and has successes) */}
              {trimmingProgress.status !== 'processing' && trimmingProgress.successVideos.length > 0 && (
                <button
                  onClick={() => {
                    setIsTrimmingModalOpen(false);
                    setCurrentStep(9);
                  }}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  ✅ Continue to Step 9
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
