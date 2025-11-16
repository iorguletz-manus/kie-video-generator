#!/usr/bin/env python3
"""
Generate proper React components from extracted step files.
This creates Step2-Step7 components with proper structure.
"""

import os
import re

steps_dir = "/home/ubuntu/kie-video-generator/client/src/components/steps"

# Step 1 is already done manually, so we skip it

# For now, let's create a simpler approach:
# Just wrap each extracted JSX in a basic component structure
# We'll refine props later when we integrate with Home.tsx

def create_step_component(step_num, title):
    """Create a basic component wrapper for a step"""
    
    input_file = os.path.join(steps_dir, f"Step{step_num}.tsx")
    output_file = os.path.join(steps_dir, f"Step{step_num}_new.tsx")
    
    # Read the extracted JSX
    with open(input_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Remove the comment lines and the wrapping {currentStep === X && (
    lines = content.split('\n')
    # Skip first 3 lines (comments and opening)
    jsx_lines = []
    in_jsx = False
    brace_count = 0
    
    for i, line in enumerate(lines):
        if i < 3:  # Skip comment lines
            continue
        
        # Skip the opening {currentStep === X && (
        if 'currentStep ===' in line:
            in_jsx = True
            continue
        
        if in_jsx:
            jsx_lines.append(line)
    
    # Remove last closing )}
    jsx_content = '\n'.join(jsx_lines)
    # Remove trailing )}
    jsx_content = jsx_content.rstrip()
    if jsx_content.endswith(')}'):
        jsx_content = jsx_content[:-2].rstrip()
    
    # Create component
    component = f'''import {{ Card, CardContent, CardDescription, CardHeader, CardTitle }} from "@/components/ui/card";
import {{ Button }} from "@/components/ui/button";
import {{ Label }} from "@/components/ui/label";
import {{ Input }} from "@/components/ui/input";
import {{ Textarea }} from "@/components/ui/textarea";
import {{ Select, SelectContent, SelectItem, SelectTrigger, SelectValue }} from "@/components/ui/select";

// TODO: Add proper props interface
interface Step{step_num}Props {{
  [key: string]: any; // Temporary - will be refined
}}

export function Step{step_num}(props: Step{step_num}Props) {{
  // TODO: Destructure props as needed
  
  return (
{jsx_content}
  );
}}
'''
    
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(component)
    
    print(f"✅ Generated Step{step_num}_new.tsx")
    return output_file

# Generate Step 2-7
for step_num in range(2, 8):
    titles = {
        2: "Text Processing",
        3: "Prompts Management",
        4: "Images Upload",
        5: "Image Mapping",
        6: "Video Generation",
        7: "Final Review"
    }
    create_step_component(step_num, titles[step_num])

print("\n✅ All step components generated!")
print("⚠️  Note: Components have temporary props - will be refined during integration")
