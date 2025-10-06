const http = require('http');

// Test the server endpoints
function testServer() {
  const baseUrl = 'http://localhost:3000';
  
  console.log('Testing YouTube Downloader Server with AI Transcription...\n');
  
  // Test health endpoint
  console.log('1. Testing health endpoint...');
  const healthReq = http.get(`${baseUrl}/health`, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      const response = JSON.parse(data);
      console.log('Health check response:', response);
      if (response.features) {
        console.log(`Features available: Video=${response.features.videoDownload}, Audio=${response.features.audioDownload}, Transcription=${response.features.transcription}`);
      }
      testRootEndpoint();
    });
  });
  
  healthReq.on('error', (err) => {
    console.error('Health check failed:', err.message);
    console.log('Make sure the server is running with: node server.js');
  });
}

function testRootEndpoint() {
  console.log('\n2. Testing root endpoint...');
  const rootReq = http.get('http://localhost:3000/', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      const response = JSON.parse(data);
      console.log('Root endpoint response:', response);
      if (response.endpoints) {
        console.log('Available endpoints:', Object.keys(response.endpoints));
      }
      testProcessVideoEndpoint();
    });
  });
  
  rootReq.on('error', (err) => {
    console.error('Root endpoint test failed:', err.message);
  });
}

function testProcessVideoEndpoint() {
  console.log('\n3. Testing process-video endpoint (without valid URL)...');
  
  const postData = JSON.stringify({
    youtubeUrl: 'invalid-url'
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
      console.log('Process-video endpoint response:', JSON.parse(data));
      testTranscribeEndpoint();
    });
  });
  
  req.on('error', (err) => {
    console.error('Process-video endpoint test failed:', err.message);
  });
  
  req.write(postData);
  req.end();
}

function testTranscribeEndpoint() {
  console.log('\n4. Testing transcribe endpoint (without valid audio path)...');
  
  const postData = JSON.stringify({
    audioPath: '/nonexistent/audio.wav'
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
      console.log('Transcribe endpoint response:', JSON.parse(data));
      console.log('\n✅ Server tests completed!');
      console.log('\nTo test with a real YouTube URL, use:');
      console.log('curl -X POST http://localhost:3000/process-video \\');
      console.log('  -H "Content-Type: application/json" \\');
      console.log('  -d \'{"youtubeUrl": "https://www.youtube.com/watch?v=VIDEO_ID"}\'');
      console.log('\nTo test transcription only, use:');
      console.log('curl -X POST http://localhost:3000/transcribe \\');
      console.log('  -H "Content-Type: application/json" \\');
      console.log('  -d \'{"audioPath": "/path/to/audio.wav"}\'');
      console.log('\nNote: Make sure to set HUGGINGFACE_API_KEY environment variable for transcription to work.');
    });
  });
  
  req.on('error', (err) => {
    console.error('Transcribe endpoint test failed:', err.message);
  });
  
  req.write(postData);
  req.end();
}

// Run tests
testServer();