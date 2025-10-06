// Example usage of the YouTube Downloader Server with AI Transcription
const http = require('http');

// Example 1: Process a YouTube video (download + transcribe)
function processYouTubeVideo() {
  console.log('Example 1: Processing YouTube video...');
  
  const postData = JSON.stringify({
    youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' // Replace with actual video ID
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
      console.log('Response:', JSON.stringify(response, null, 2));
      
      if (response.transcription && response.transcription.success) {
        console.log('\nTranscription text:');
        console.log(response.transcription.text);
        
        if (response.transcription.words && response.transcription.words.length > 0) {
          console.log('\nFirst few words with timestamps:');
          response.transcription.words.slice(0, 5).forEach(word => {
            console.log(`"${word.word}" (${word.start}s - ${word.end}s)`);
          });
        }
      }
    });
  });
  
  req.on('error', (err) => {
    console.error('Error:', err.message);
  });
  
  req.write(postData);
  req.end();
}

// Example 2: Transcribe existing audio file
function transcribeAudioFile() {
  console.log('\nExample 2: Transcribing existing audio file...');
  
  const postData = JSON.stringify({
    audioPath: '/path/to/your/audio.wav' // Replace with actual audio file path
  });
  
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/transcribe',
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

// Example 3: Check server health and features
function checkServerHealth() {
  console.log('Example 3: Checking server health...');
  
  const req = http.get('http://localhost:3000/health', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      const response = JSON.parse(data);
      console.log('Server status:', response.status);
      console.log('Features available:', response.features);
      
      if (response.features && !response.features.transcription) {
        console.log('⚠️  Transcription not available - make sure HUGGINGFACE_API_KEY is set');
      }
    });
  });
  
  req.on('error', (err) => {
    console.error('Error:', err.message);
  });
}

// Run examples
console.log('YouTube Downloader Server - Usage Examples');
console.log('==========================================');
console.log('Make sure the server is running: node server.js');
console.log('Make sure HUGGINGFACE_API_KEY is set for transcription\n');

// Uncomment the examples you want to run:
// checkServerHealth();
// processYouTubeVideo();
// transcribeAudioFile();

console.log('Uncomment the examples in this file to run them.');
console.log('Make sure to replace the example URLs and paths with real ones.');