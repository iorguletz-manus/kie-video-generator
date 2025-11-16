import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Upload } from "lucide-react";
import { toast } from "sonner";

interface Step1Props {
  // Context data
  selectedTamId: number | null;
  selectedCoreBeliefId: number | null;
  selectedEmotionalAngleId: number | null;
  selectedAdId: number | null;
  selectedCharacterId: number | null;
  
  // Setters
  setSelectedCoreBeliefId: (id: number | null) => void;
  setSelectedEmotionalAngleId: (id: number | null) => void;
  setSelectedAdId: (id: number | null) => void;
  setSelectedCharacterId: (id: number | null) => void;
  
  // Data from queries
  coreBeliefs: any[];
  emotionalAngles: any[];
  ads: any[];
  categoryCharacters: any[];
  
  // Text ad state
  textAdMode: 'upload' | 'paste';
  setTextAdMode: (mode: 'upload' | 'paste') => void;
  rawTextAd: string;
  setRawTextAd: (text: string) => void;
  
  // Mutations
  createCoreBeliefMutation: any;
  createEmotionalAngleMutation: any;
  createAdMutation: any;
  createCharacterMutation: any;
  
  // Refetch functions
  refetchCoreBeliefs: () => Promise<void>;
  refetchEmotionalAngles: () => Promise<void>;
  refetchAds: () => Promise<void>;
  refetchCharacters: () => Promise<void>;
  
  // File handlers
  handleTextFileDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  handleTextFileDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  handleTextFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  
  // User
  localCurrentUser: any;
}

export function Step1(props: Step1Props) {
  const {
    selectedTamId,
    selectedCoreBeliefId,
    selectedEmotionalAngleId,
    selectedAdId,
    selectedCharacterId,
    setSelectedCoreBeliefId,
    setSelectedEmotionalAngleId,
    setSelectedAdId,
    setSelectedCharacterId,
    coreBeliefs,
    emotionalAngles,
    ads,
    categoryCharacters,
    textAdMode,
    setTextAdMode,
    rawTextAd,
    setRawTextAd,
    createCoreBeliefMutation,
    createEmotionalAngleMutation,
    createAdMutation,
    createCharacterMutation,
    refetchCoreBeliefs,
    refetchEmotionalAngles,
    refetchAds,
    refetchCharacters,
    handleTextFileDrop,
    handleTextFileDragOver,
    handleTextFileUpload,
    localCurrentUser,
  } = props;

  return (
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
      <CardContent className="pt-4 md:pt-8 px-3 md:px-8 pb-4 md:pb-8">
        {/* Context Info */}
        <div className="mb-6 p-4 bg-blue-50/50 border-2 border-blue-200 rounded-lg">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">Current Context</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
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
              </div>
            )}
            
            {/* Paste Mode */}
            {textAdMode === 'paste' && (
              <div className="mb-6">
                <Label className="text-blue-900 font-medium mb-2 block">Paste Text Ad:</Label>
                <Textarea
                  value={rawTextAd}
                  onChange={(e) => setRawTextAd(e.target.value)}
                  placeholder="Paste your text ad here (118-125 characters)..."
                  className="min-h-[200px] font-mono text-sm"
                />
                <p className="text-sm text-gray-500 mt-2">
                  Current length: {rawTextAd.length} characters
                  {rawTextAd.length >= 118 && rawTextAd.length <= 125 && (
                    <span className="text-green-600 font-medium ml-2">✓ Perfect length!</span>
                  )}
                  {rawTextAd.length > 0 && rawTextAd.length < 118 && (
                    <span className="text-orange-600 font-medium ml-2">⚠ Too short ({118 - rawTextAd.length} more needed)</span>
                  )}
                  {rawTextAd.length > 125 && (
                    <span className="text-red-600 font-medium ml-2">✗ Too long ({rawTextAd.length - 125} over limit)</span>
                  )}
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
