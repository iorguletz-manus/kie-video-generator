# Home.tsx Refactoring Plan

## Current State
- **Total lines:** 5335
- **Structure:** Monolithic component with 7 steps
- **Problem:** Hard to maintain, easy to break when editing

## Component Breakdown

### Step1: TAM & Context Selection (lines ~2512-2789)
**Purpose:** Select TAM, Core Belief, Emotional Angle, Ad, Character
**State needed:**
- selectedTAM, setSelectedTAM
- selectedCoreBelief, setSelectedCoreBelief
- selectedEmotionalAngle, setSelectedEmotionalAngle
- selectedAd, setSelectedAd
- selectedCharacter, setSelectedCharacter
- tams, coreBeliefs, emotionalAngles, ads, categoryCharacters (from queries)

**Functions needed:**
- None (just selection)

### Step2: Text Processing (lines ~2790-3241)
**Purpose:** Process text ad from input or document upload
**State needed:**
- adText, setAdText
- adLines, setAdLines
- editingLineId, setEditingLineId
- editingLineText, setEditingLineText
- editingLineRedStart, setEditingLineRedEnd
- editorRef

**Functions needed:**
- processText()
- handleAdDocumentDrop()
- handleAdDocumentSelect()

### Step3: Prompts (lines ~3242-3346)
**Purpose:** Manage prompts library
**State needed:**
- prompts, setPrompts
- newPromptText, setNewPromptText

**Functions needed:**
- addPrompt()
- removePrompt()

### Step4: Images (lines ~3347-3537)
**Purpose:** Upload and manage images
**State needed:**
- uploadedImages, setUploadedImages
- selectedImages, setSelectedImages
- searchQuery, setSearchQuery
- selectedImageCharacter, setSelectedImageCharacter

**Functions needed:**
- handleImageUpload()
- toggleImageSelection()

### Step5: Mapping (lines ~3538-3667)
**Purpose:** Map images to text lines
**State needed:**
- combinations, setCombinations
- step5FilteredCombinations

**Functions needed:**
- createMappings()
- updateCombinationImage()

### Step6: Video Generation & Review (lines ~3668-5039)
**Purpose:** Generate videos and manage regeneration
**State needed:**
- videoResults, setVideoResults
- step5FilteredVideos
- modifyingVideoIndex
- modifyDialogueText
- regenerateMultiple
- regenerateVariantCount
- regenerateVariants

**Functions needed:**
- generateVideos()
- checkVideoStatus()
- regenerateAll()
- regenerateWithModifications()

### Step7: Final Review (lines ~5040-end)
**Purpose:** Accept/reject videos
**State needed:**
- videoResults (read-only)

**Functions needed:**
- acceptVideo()
- rejectVideo()
- submitFinalVideos()

## Shared State (stays in Home.tsx)
- currentStep
- selectedTAM, selectedCoreBelief, selectedEmotionalAngle, selectedAd, selectedCharacter
- adText, adLines
- prompts
- uploadedImages, selectedImages
- combinations
- videoResults
- All query results (tams, coreBeliefs, etc.)

## Implementation Strategy
1. Create `/components/steps/` folder
2. Extract each step into separate component
3. Pass state and functions as props
4. Keep all state management in Home.tsx
5. Test after each extraction

## Benefits
- ✅ Smaller, manageable files
- ✅ Easier to edit without breaking other steps
- ✅ Better Git diffs
- ✅ Easier debugging
- ✅ Potential for lazy loading
