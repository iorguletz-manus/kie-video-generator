import { mergeVideosWithFilterComplexLocal } from './server/videoEditing.js';

async function test() {
  const hookUrl = 'https://manus.b-cdn.net/user-1/videos/trimmed/T1_C1_E1_AD2_HOOK1_ELENA_1_trimmed_1766073326960.mp4';
  const bodyUrl = 'https://manus.b-cdn.net/user-1/videos/prepare-for-merge/T1_C1_E1_AD2_BODY_ELENA_1_1766236164473.mp4';
  
  console.log('Testing local merge...');
  
  try {
    const result = await mergeVideosWithFilterComplexLocal(
      [hookUrl, bodyUrl],
      'TEST_LOCAL_MERGE',
      1,
      'test-merged',
      true
    );
    
    console.log('\n✅ SUCCESS! Merged video URL:', result);
  } catch (error) {
    console.error('\n❌ ERROR:', error);
    process.exit(1);
  }
}

test();
