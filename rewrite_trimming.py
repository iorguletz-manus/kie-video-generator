#!/usr/bin/env python3
"""
Script to rewrite handleTrimAllVideos function with simple batch logic
"""

def main():
    # Read the original file
    with open('/home/ubuntu/kie-video-generator/client/src/pages/Home.tsx', 'r') as f:
        lines = f.readlines()
    
    # Find the start and end of handleTrimAllVideos function
    start_line = None
    end_line = None
    
    for i, line in enumerate(lines):
        if 'const handleTrimAllVideos = async () => {' in line:
            start_line = i
        if start_line is not None and line.strip() == '};' and i > start_line + 10:
            end_line = i
            break
    
    if start_line is None or end_line is None:
        print(f"ERROR: Could not find function boundaries")
        print(f"start_line: {start_line}, end_line: {end_line}")
        return
    
    print(f"Found function at lines {start_line+1} to {end_line+1}")
    
    # Read the new function from temp file
    with open('/home/ubuntu/kie-video-generator/temp_handleTrimAllVideos.tsx', 'r') as f:
        new_function = f.read()
    
    # Read the retry function
    with open('/home/ubuntu/kie-video-generator/temp_handleRetryFailedVideos.tsx', 'r') as f:
        retry_function = f.read()
    
    # Replace the function
    new_lines = (
        lines[:start_line] +
        [new_function + '\n'] +
        [retry_function + '\n'] +
        lines[end_line+1:]
    )
    
    # Write back
    with open('/home/ubuntu/kie-video-generator/client/src/pages/Home.tsx', 'w') as f:
        f.writelines(new_lines)
    
    print(f"✅ Function replaced successfully!")
    print(f"Old lines: {len(lines)}, New lines: {len(new_lines)}")

if __name__ == '__main__':
    main()
