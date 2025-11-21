# Button Modifications Plan

## Goal
Implement uniform Back/Next buttons across all steps (1-7) with consistent styling.

## Design Pattern (from Step 4)

### Top Back Button (already exists in some steps)
```tsx
<Button
  onClick={goBack}
  variant="outline"
  size="sm"
  className="gap-2"
>
  <ChevronLeft className="w-4 h-4" />
  Înapoi la STEP {currentStep - 1}
</Button>
```

### Bottom Navigation Buttons
```tsx
<div className="mt-6 flex justify-between items-center">
  {/* Left: Small Back Button */}
  <Button
    variant="outline"
    onClick={() => setCurrentStep(prevStep)}
    className="px-6 py-3"
  >
    <ChevronLeft className="w-4 h-4 mr-2" />
    Back
  </Button>
  
  {/* Right: Large Next Button */}
  <Button
    onClick={nextStepFunction}
    disabled={someCondition}
    className="bg-blue-600 hover:bg-blue-700 px-8 py-6 text-lg"
  >
    Next: Step Name
    <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  </Button>
</div>
```

## Modifications Needed

### Step 1 - Prepare Text Ad
- **Top**: Add back button (if currentStep > 1)
- **Bottom**: 
  - Back: N/A (first step)
  - Next: "Next: Extract Text" (blue)

### Step 2 - Text Ad Document
- **Top**: Add back button "← Înapoi la STEP 1"
- **Bottom**:
  - Back: "Back" → go to Step 1
  - Next: "Next: Choose Prompts" (blue)

### Step 3 - Prompts
- **Top**: Add back button "← Înapoi la STEP 2"
- **Bottom**:
  - Back: "Back" → go to Step 2
  - Next: "Next: Choose Images" (blue)

### Step 4 - Images
- **Top**: Already has back button ✓
- **Bottom**: Already correct ✓

### Step 5 - Mapping
- **Top**: Add back button "← Înapoi la STEP 4"
- **Bottom**:
  - Back: "Back" → go to Step 4
  - Next: "Next: Generate (X) Videos 🎬" (blue)

### Step 6 - Generate Videos
- **Top**: Add back button "← Înapoi la STEP 5"
- **Bottom**:
  - Back: "Back" → go to Step 5
  - Next: "Next: Check Videos" (GREEN - bg-green-600)

### Step 7 - Check Videos
- **Top**: Add back button "← Înapoi la STEP 6"
- **Bottom**:
  - Back: "Back" → go to Step 6
  - Next: "Next: Edit Videos" (PURPLE - bg-purple-600)

## Implementation Strategy
Due to file size (7000+ lines), will modify each step separately using targeted edits.
