import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// TODO: Add proper props interface
interface Step2Props {
  [key: string]: any; // Temporary - will be refined
}

export function Step2(props: Step2Props) {
  // TODO: Destructure props as needed
  
  return (
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
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={(e) => {
                  const text = e.currentTarget.textContent || '';
                  setEditingLineText(text);
                }}
                className="min-h-[150px] p-4 border-2 border-gray-300 rounded focus:outline-none focus:border-blue-500"
                style={{ whiteSpace: 'pre-wrap' }}
              >
                {editingLineText}
              </div>
              
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
                  if (!editingLineId || !editorRef.current) return;
                  
                  const html = editorRef.current.innerHTML;
                  const text = editorRef.current.textContent || '';
                  
                  // Parse HTML to find RED text positions
                  let redStart = -1;
                  let redEnd = -1;
                  
                  // Find all red spans and get the first one
                  const redSpanRegex = /<span[^>]*style="[^"]*color:\s*(?:#dc2626|rgb\(220,\s*38,\s*38\))[^"]*"[^>]*>([^<]*)<\/span>/gi;
                  const matches = [...html.matchAll(redSpanRegex)];
                  
                  if (matches.length > 0) {
                    const redText = matches[0][1];
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
  );
}
