import fs from 'fs';

const API_BASE = 'http://localhost:3000/api/trpc';

console.log('🧪 Testing Kie.ai Video Generator Backend\n');

// Test 1: Upload Image
async function testUploadImage() {
  console.log('1️⃣ Testing image upload...');
  
  try {
    // Create a simple test image (1x1 pixel PNG in base64)
    const testImageBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    
    const response = await fetch(`${API_BASE}/video.uploadImage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        "0": {
          json: {
            imageData: testImageBase64,
            fileName: 'test-image.png',
          }
        }
      }),
    });

    const result = await response.json();
    
    if (result.result?.data?.success && result.result?.data?.imageUrl) {
      console.log('✅ Image upload successful!');
      console.log('   Image URL:', result.result.data.imageUrl);
      return result.result.data.imageUrl;
    } else {
      console.log('❌ Image upload failed:', result);
      return null;
    }
  } catch (error) {
    console.log('❌ Image upload error:', error.message);
    return null;
  }
}

// Test 2: Generate Video
async function testGenerateVideo(imageUrl) {
  console.log('\n2️⃣ Testing video generation...');
  
  if (!imageUrl) {
    console.log('⚠️  Skipping video generation (no image URL)');
    return null;
  }
  
  try {
    const response = await fetch(`${API_BASE}/video.generateVideo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        "0": {
          json: {
            prompt: 'A beautiful sunset over the ocean',
            imageUrl: imageUrl,
          }
        }
      }),
    });

    const result = await response.json();
    
    if (result.result?.data?.success && result.result?.data?.taskId) {
      console.log('✅ Video generation started!');
      console.log('   TaskID:', result.result.data.taskId);
      return result.result.data.taskId;
    } else {
      console.log('❌ Video generation failed:', result);
      if (result.error) {
        console.log('   Error message:', result.error.message);
      }
      return null;
    }
  } catch (error) {
    console.log('❌ Video generation error:', error.message);
    return null;
  }
}

// Test 3: Check Video Status
async function testCheckVideoStatus(taskId) {
  console.log('\n3️⃣ Testing video status check...');
  
  if (!taskId) {
    console.log('⚠️  Skipping status check (no taskId)');
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE}/video.checkVideoStatus?input=${encodeURIComponent(JSON.stringify({ taskId }))}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();
    
    if (result.result?.data?.success) {
      console.log('✅ Status check successful!');
      console.log('   Status:', result.result.data.status);
      if (result.result.data.videoUrl) {
        console.log('   Video URL:', result.result.data.videoUrl);
      }
    } else {
      console.log('❌ Status check failed:', result);
      if (result.error) {
        console.log('   Error message:', result.error.message);
      }
    }
  } catch (error) {
    console.log('❌ Status check error:', error.message);
  }
}

// Run all tests
async function runTests() {
  const imageUrl = await testUploadImage();
  const taskId = await testGenerateVideo(imageUrl);
  await testCheckVideoStatus(taskId);
  
  console.log('\n✨ Testing complete!\n');
}

runTests();
