#!/usr/bin/env python3
"""
Extract STEP components from Home.tsx into separate files.
This script reads Home.tsx and creates Step1.tsx through Step7.tsx components.
"""

import re
import os

# Define step boundaries (line numbers from grep)
STEPS = [
    {"num": 1, "start": 2513, "end": 2790, "title": "TAM & Context Selection"},
    {"num": 2, "start": 2791, "end": 3242, "title": "Text Processing"},
    {"num": 3, "start": 3243, "end": 3347, "title": "Prompts Management"},
    {"num": 4, "start": 3348, "end": 3538, "title": "Images Upload"},
    {"num": 5, "start": 3539, "end": 3668, "title": "Image Mapping"},
    {"num": 6, "start": 3669, "end": 5040, "title": "Video Generation"},
    {"num": 7, "start": 5041, "end": 5335, "title": "Final Review"},
]

# Read Home.tsx
home_path = "/home/ubuntu/kie-video-generator/client/src/pages/Home.tsx"
with open(home_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Output directory
output_dir = "/home/ubuntu/kie-video-generator/client/src/components/steps"
os.makedirs(output_dir, exist_ok=True)

# Extract each step
for step in STEPS:
    step_num = step["num"]
    start = step["start"] - 1  # Convert to 0-indexed
    end = step["end"]
    title = step["title"]
    
    # Extract lines for this step
    step_lines = lines[start:end]
    
    # Find the opening {currentStep === X && ( and closing )}
    # We need to extract just the JSX content
    content = ''.join(step_lines)
    
    # Create component file
    component_name = f"Step{step_num}"
    output_path = os.path.join(output_dir, f"{component_name}.tsx")
    
    # Write component (we'll create proper structure manually after extraction)
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(f"// {title}\n")
        f.write(f"// Extracted from Home.tsx lines {step['start']}-{step['end']}\n\n")
        f.write(content)
    
    print(f"✅ Extracted {component_name}.tsx ({end - start} lines)")

print(f"\n✅ All steps extracted to {output_dir}/")
print("⚠️  Note: Components need manual cleanup to add imports and props")
