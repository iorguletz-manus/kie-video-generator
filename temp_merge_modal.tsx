        {/* Merge Progress Modal (Step 9 → Step 10) */}
        <Dialog open={isMergingStep10} onOpenChange={(open) => {
          if (!open && mergeStep10Progress.status !== 'processing' && mergeStep10Progress.status !== 'countdown') {
            setIsMergingStep10(false);
          }
        }}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {mergeStep10Progress.status === 'countdown' && <Clock className="w-5 h-5 animate-pulse text-blue-600" />}
                {mergeStep10Progress.status === 'processing' && <Loader2 className="w-5 h-5 animate-spin text-blue-600" />}
                {mergeStep10Progress.status === 'complete' && <Check className="w-5 h-5 text-green-600" />}
                {mergeStep10Progress.status === 'partial' && <AlertTriangle className="w-5 h-5 text-yellow-600" />}
                {mergeStep10Progress.status === 'error' && <X className="w-5 h-5 text-red-600" />}
                Merging Videos
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* Status Message */}
              <div className="text-center py-4">
                <p className="text-lg font-medium">{mergeStep10Progress.message}</p>
                {mergeStep10Progress.countdown !== undefined && (
                  <p className="text-4xl font-bold text-blue-600 mt-2">{mergeStep10Progress.countdown}s</p>
                )}
              </div>
              
              {/* Results */}
              {mergeStep10Progress.results && mergeStep10Progress.results.length > 0 && (
                <div className="space-y-4">
                  {/* Success List */}
                  {mergeStep10Progress.results.filter(r => r.status === 'success').length > 0 && (
                    <div className="border border-green-300 rounded-lg p-4 bg-green-50">
                      <h3 className="font-bold text-green-900 mb-2 flex items-center gap-2">
                        <Check className="w-4 h-4" />
                        ✅ Success ({mergeStep10Progress.results.filter(r => r.status === 'success').length})
                      </h3>
                      <ul className="space-y-2">
                        {mergeStep10Progress.results
                          .filter(r => r.status === 'success')
                          .map((result, idx) => (
                            <li key={idx} className="text-sm text-green-800">
                              • <strong>{result.name}</strong> ({result.videoCount} videos)
                            </li>
                          ))}
                      </ul>
                    </div>
                  )}
                  
                  {/* Failed List */}
                  {mergeStep10Progress.results.filter(r => r.status === 'failed').length > 0 && (
                    <div className="border border-red-300 rounded-lg p-4 bg-red-50">
                      <h3 className="font-bold text-red-900 mb-2 flex items-center gap-2">
                        <X className="w-4 h-4" />
                        ❌ Failed ({mergeStep10Progress.results.filter(r => r.status === 'failed').length})
                      </h3>
                      <ul className="space-y-2">
                        {mergeStep10Progress.results
                          .filter(r => r.status === 'failed')
                          .map((result, idx) => (
                            <li key={idx} className="text-sm">
                              <div className="flex items-start gap-2">
                                {(result as any).status === 'retrying' ? (
                                  <Loader2 className="w-4 h-4 animate-spin text-blue-600 mt-0.5" />
                                ) : (
                                  <X className="w-4 h-4 text-red-600 mt-0.5" />
                                )}
                                <div className="flex-1">
                                  <p className="font-medium text-red-900">
                                    {result.name} ({result.videoCount} videos)
                                  </p>
                                  {result.error && (
                                    <p className="text-xs text-red-700 mt-1">
                                      Error: {result.error}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </li>
                          ))}
                      </ul>
                    </div>
                  )}
                  
                  {/* Retrying List */}
                  {mergeStep10Progress.results.filter(r => (r as any).status === 'retrying').length > 0 && (
                    <div className="border border-blue-300 rounded-lg p-4 bg-blue-50">
                      <h3 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        🔄 Retrying ({mergeStep10Progress.results.filter(r => (r as any).status === 'retrying').length})
                      </h3>
                      <ul className="space-y-2">
                        {mergeStep10Progress.results
                          .filter(r => (r as any).status === 'retrying')
                          .map((result, idx) => (
                            <li key={idx} className="text-sm text-blue-800 flex items-center gap-2">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <strong>{result.name}</strong> ({result.videoCount} videos)
                            </li>
                          ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              
              {/* Actions */}
              <div className="flex gap-2 justify-end pt-4 border-t">
                {/* Retry Button */}
                {mergeStep10Progress.results && 
                 mergeStep10Progress.results.filter(r => r.status === 'failed').length > 0 &&
                 mergeStep10Progress.status !== 'processing' && (
                  <Button
                    onClick={handleRetryFailedMerges}
                    className="bg-orange-600 hover:bg-orange-700"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Retry Failed ({mergeStep10Progress.results.filter(r => r.status === 'failed').length})
                  </Button>
                )}
                
                {/* Continue Button */}
                {mergeStep10Progress.status === 'complete' && (
                  <Button
                    onClick={() => {
                      setIsMergingStep10(false);
                      setCurrentStep(10);
                      toast.success('✅ Proceeding to Step 10');
                    }}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Continue to Step 10
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                )}
                
                {/* Close Button */}
                {mergeStep10Progress.status !== 'processing' && 
                 mergeStep10Progress.status !== 'countdown' && (
                  <Button
                    onClick={() => setIsMergingStep10(false)}
                    variant="outline"
                  >
                    Close
                  </Button>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
