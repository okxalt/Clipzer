const express = require('express');
const ytdlp = require('yt-dlp-exec');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Create temp directory if it doesn't exist
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Process video endpoint
app.post('/process-video', async (req, res) => {
  try {
    const { youtubeUrl } = req.body;
    
    if (!youtubeUrl) {
      return res.status(400).json({ 
        error: 'YouTube URL is required',
        message: 'Please provide a valid YouTube URL in the request body'
      });
    }

    console.log(`Processing video: ${youtubeUrl}`);
    
    // Generate unique folder for this download
    const timestamp = Date.now();
    const downloadDir = path.join(tempDir, `download_${timestamp}`);
    fs.mkdirSync(downloadDir, { recursive: true });

    // Download best quality video
    console.log('Downloading video...');
    const videoResult = await ytdlp(youtubeUrl, {
      output: path.join(downloadDir, 'video.%(ext)s'),
      format: 'best[height<=1080]', // Best quality up to 1080p
      noPlaylist: true
    });

    // Download audio as WAV
    console.log('Downloading audio...');
    const audioResult = await ytdlp(youtubeUrl, {
      output: path.join(downloadDir, 'audio.%(ext)s'),
      format: 'bestaudio',
      extractAudio: true,
      audioFormat: 'wav',
      noPlaylist: true
    });

    // Find the actual downloaded files
    const files = fs.readdirSync(downloadDir);
    const videoFile = files.find(file => file.startsWith('video.'));
    const audioFile = files.find(file => file.startsWith('audio.'));

    if (!videoFile || !audioFile) {
      throw new Error('Failed to download video or audio files');
    }

    const videoPath = path.join(downloadDir, videoFile);
    const audioPath = path.join(downloadDir, audioFile);

    // Get file sizes
    const videoStats = fs.statSync(videoPath);
    const audioStats = fs.statSync(audioPath);

    console.log('Download completed successfully!');
    console.log(`Video file: ${videoPath}`);
    console.log(`Audio file: ${audioPath}`);
    console.log(`Video size: ${(videoStats.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Audio size: ${(audioStats.size / 1024 / 1024).toFixed(2)} MB`);

    res.json({
      success: true,
      message: 'Video and audio downloaded successfully',
      files: {
        video: {
          path: videoPath,
          filename: videoFile,
          size: videoStats.size,
          sizeFormatted: `${(videoStats.size / 1024 / 1024).toFixed(2)} MB`
        },
        audio: {
          path: audioPath,
          filename: audioFile,
          size: audioStats.size,
          sizeFormatted: `${(audioStats.size / 1024 / 1024).toFixed(2)} MB`
        }
      },
      downloadDir: downloadDir
    });

  } catch (error) {
    console.error('Error processing video:', error.message);
    
    // Check if it's a yt-dlp not found error
    if (error.message.includes('yt-dlp') || error.message.includes('ENOENT')) {
      return res.status(500).json({
        error: 'yt-dlp not found',
        message: 'yt-dlp is not installed on this system',
        details: 'Please install yt-dlp: pip install yt-dlp or apt install yt-dlp',
        installInstructions: {
          ubuntu: 'sudo apt install yt-dlp',
          macos: 'brew install yt-dlp',
          pip: 'pip install yt-dlp'
        }
      });
    }
    
    res.status(500).json({
      error: 'Failed to process video',
      message: error.message,
      details: 'Make sure the YouTube URL is valid and accessible'
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'YouTube downloader server is running',
    timestamp: new Date().toISOString()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'YouTube Downloader Server',
    endpoints: {
      'POST /process-video': 'Download YouTube video and audio',
      'GET /health': 'Health check'
    },
    usage: {
      method: 'POST',
      url: '/process-video',
      body: {
        youtubeUrl: 'https://www.youtube.com/watch?v=VIDEO_ID'
      }
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: 'The requested endpoint does not exist'
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Process video: POST http://localhost:${PORT}/process-video`);
});