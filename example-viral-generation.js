// Example: Complete Viral Video Generation Workflow
const http = require('http');

// Example: Complete workflow from YouTube URL to viral clip
function completeViralWorkflow() {
  console.log('🚀 Complete Viral Video Generation Workflow');
  console.log('==========================================');
  
  const youtubeUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'; // Replace with actual video
  
  console.log('Step 1: Processing YouTube video...');
  
  const postData = JSON.stringify({
    youtubeUrl: youtubeUrl
  });
  
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/process-video',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };
  
  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      const response = JSON.parse(data);
      console.log('✅ Video processing completed');
      
      if (response.success && response.viral_clips && response.viral_clips.success) {
        console.log(`Found ${response.viral_clips.clips.length} viral clips`);
        
        // Generate the top viral clip
        const topClip = response.viral_clips.clips[0];
        console.log(`\nStep 2: Generating viral clip "${topClip.hook_title}"`);
        console.log(`Duration: ${topClip.start_time}s - ${topClip.end_time}s`);
        console.log(`Virality Score: ${topClip.virality_score}/100`);
        
        generateViralClip(
          response.files.video.path,
          response.transcription,
          topClip.start_time,
          topClip.end_time,
          topClip.hook_title
        );
      } else {
        console.log('❌ No viral clips found or processing failed');
      }
    });
  });
  
  req.on('error', (err) => {
    console.error('Error:', err.message);
  });
  
  req.write(postData);
  req.end();
}

// Generate viral clip from processed video
function generateViralClip(videoPath, transcript, startTime, endTime, hookTitle) {
  console.log(`\n🎬 Generating viral clip...`);
  console.log(`Video: ${videoPath}`);
  console.log(`Time: ${startTime}s - ${endTime}s`);
  console.log(`Title: ${hookTitle}`);
  
  const postData = JSON.stringify({
    videoPath: videoPath,
    transcript: transcript,
    startTime: startTime,
    endTime: endTime,
    hookTitle: hookTitle
  });
  
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/generate-viral-clip',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };
  
  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      const response = JSON.parse(data);
      
      if (response.success) {
        console.log('✅ Viral clip generated successfully!');
        console.log(`📁 Output: ${response.clip.path}`);
        console.log(`📊 Size: ${response.clip.sizeFormatted}`);
        console.log(`⏱️  Duration: ${response.clip.duration}s`);
        console.log(`🎯 Hook: "${response.clip.hookTitle}"`);
        console.log('\n🎉 Ready for TikTok upload!');
      } else {
        console.log('❌ Failed to generate viral clip:', response.message);
      }
    });
  });
  
  req.on('error', (err) => {
    console.error('Error:', err.message);
  });
  
  req.write(postData);
  req.end();
}

// Example: Generate viral clip from existing video and transcript
function generateFromExistingData() {
  console.log('\n📝 Generate from existing data...');
  
  const postData = JSON.stringify({
    videoPath: '/path/to/your/video.mp4',
    transcript: {
      text: "This is an amazing moment that will blow your mind. You won't believe what happens next!",
      words: [
        { word: "This", start: 0.0, end: 0.3 },
        { word: "is", start: 0.3, end: 0.5 },
        { word: "an", start: 0.5, end: 0.7 },
        { word: "amazing", start: 0.7, end: 1.2 },
        { word: "moment", start: 1.2, end: 1.8 }
      ]
    },
    startTime: 0.0,
    endTime: 30.0,
    hookTitle: "This Will Blow Your Mind!"
  });
  
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/generate-viral-clip',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };
  
  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      const response = JSON.parse(data);
      console.log('Response:', JSON.stringify(response, null, 2));
    });
  });
  
  req.on('error', (err) => {
    console.error('Error:', err.message);
  });
  
  req.write(postData);
  req.end();
}

// Check server status
function checkServerStatus() {
  console.log('🔍 Checking server status...');
  
  const req = http.get('http://localhost:3000/health', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      const response = JSON.parse(data);
      console.log('Server Status:', response.status);
      console.log('Features Available:');
      Object.entries(response.features).forEach(([feature, available]) => {
        console.log(`  ${feature}: ${available ? '✅' : '❌'}`);
      });
      
      if (!response.features.transcription) {
        console.log('\n⚠️  Set HUGGINGFACE_API_KEY for transcription');
      }
      if (!response.features.viralClipsAnalysis) {
        console.log('⚠️  Set GROQ_API_KEY for viral clips analysis');
      }
      if (!response.features.viralClipGeneration) {
        console.log('⚠️  Python/MoviePy required for video generation');
      }
    });
  });
  
  req.on('error', (err) => {
    console.error('Server not running:', err.message);
    console.log('Start server with: node server.js');
  });
}

// Run examples
console.log('🎬 Viral Video Generation Examples');
console.log('==================================');
console.log('Make sure the server is running: node server.js');
console.log('Make sure Python and MoviePy are installed\n');

// Uncomment the examples you want to run:
checkServerStatus();
// completeViralWorkflow();
// generateFromExistingData();

console.log('\nUncomment the examples in this file to run them.');
console.log('Make sure to replace example URLs and paths with real ones.');