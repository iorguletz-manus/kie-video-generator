#!/usr/bin/env python3
"""
Script to rewrite trimming modal with new UI
"""

def main():
    # Read the original file
    with open('/home/ubuntu/kie-video-generator/client/src/pages/Home.tsx', 'r') as f:
        lines = f.readlines()
    
    # Find the start and end of modal
    start_line = None
    end_line = None
    depth = 0
    
    for i, line in enumerate(lines):
        if '<Dialog open={isTrimmingModalOpen}' in line:
            start_line = i
        
        # Find the FIRST </Dialog> after start_line (simple modal, no nested Dialogs)
        if start_line is not None and '</Dialog>' in line and i > start_line:
            end_line = i
            break
    
    if start_line is None or end_line is None:
        print(f"ERROR: Could not find modal boundaries")
        print(f"start_line: {start_line}, end_line: {end_line}")
        return
    
    print(f"Found modal at lines {start_line+1} to {end_line+1}")
    
    # Read the new modal from temp file
    with open('/home/ubuntu/kie-video-generator/temp_modal.tsx', 'r') as f:
        new_modal = f.read()
    
    # Replace the modal
    new_lines = (
        lines[:start_line] +
        [new_modal + '\n'] +
        lines[end_line+1:]
    )
    
    # Write back
    with open('/home/ubuntu/kie-video-generator/client/src/pages/Home.tsx', 'w') as f:
        f.writelines(new_lines)
    
    print(f"✅ Modal replaced successfully!")
    print(f"Old lines: {len(lines)}, New lines: {len(new_lines)}")

if __name__ == '__main__':
    main()
