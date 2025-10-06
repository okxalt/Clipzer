const express = require('express');
const ytdlp = require('yt-dlp-exec');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const axios = require('axios');
const FormData = require('form-data');
require('dotenv').config();

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

// Hugging Face API configuration
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;
const HUGGINGFACE_MODEL = process.env.HUGGINGFACE_MODEL || 'openai/whisper-large-v3';
const HUGGINGFACE_API_URL = process.env.HUGGINGFACE_API_URL || 'https://api-inference.huggingface.co';

// Transcribe audio using Hugging Face Whisper API
async function transcribeAudio(audioPath) {
  try {
    if (!HUGGINGFACE_API_KEY) {
      throw new Error('HUGGINGFACE_API_KEY environment variable is not set');
    }

    if (!fs.existsSync(audioPath)) {
      throw new Error(`Audio file not found: ${audioPath}`);
    }

    console.log(`Transcribing audio: ${audioPath}`);
    
    // Create form data
    const formData = new FormData();
    formData.append('file', fs.createReadStream(audioPath));
    formData.append('model', HUGGINGFACE_MODEL);
    formData.append('return_timestamps', 'word'); // Enable word-level timestamps

    // Make API request
    const response = await axios.post(
      `${HUGGINGFACE_API_URL}/models/${HUGGINGFACE_MODEL}`,
      formData,
      {
        headers: {
          'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
          ...formData.getHeaders()
        },
        timeout: 300000 // 5 minutes timeout for long audio files
      }
    );

    if (response.status !== 200) {
      throw new Error(`API request failed with status: ${response.status}`);
    }

    const transcription = response.data;
    
    // Log basic transcription info
    console.log('Transcription completed successfully');
    console.log(`Text length: ${transcription.text ? transcription.text.length : 0} characters`);
    console.log(`Word count: ${transcription.words ? transcription.words.length : 0} words`);
    
    return {
      success: true,
      text: transcription.text || '',
      words: transcription.words || [],
      chunks: transcription.chunks || [],
      language: transcription.language || 'unknown',
      duration: transcription.duration || 0
    };

  } catch (error) {
    console.error('Transcription error:', error.message);
    
    // Handle specific API errors
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      
      if (status === 401) {
        throw new Error('Invalid Hugging Face API key');
      } else if (status === 429) {
        throw new Error('Rate limit exceeded. Please try again later');
      } else if (status === 503) {
        throw new Error('Model is currently loading. Please try again in a few minutes');
      } else {
        throw new Error(`API error: ${status} - ${data.error || data.message || 'Unknown error'}`);
      }
    }
    
    throw error;
  }
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

    // Transcribe the audio
    let transcription = null;
    try {
      console.log('Starting audio transcription...');
      transcription = await transcribeAudio(audioPath);
      console.log('Transcription completed successfully');
    } catch (transcriptionError) {
      console.warn('Transcription failed:', transcriptionError.message);
      // Continue without transcription rather than failing the entire request
    }

    const response = {
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
    };

    // Add transcription data if available
    if (transcription) {
      response.transcription = transcription;
      response.message += ' and audio transcribed successfully';
    } else {
      response.transcription = {
        success: false,
        error: 'Transcription failed - check server logs for details'
      };
    }

    res.json(response);

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

// Transcribe audio endpoint
app.post('/transcribe', async (req, res) => {
  try {
    const { audioPath } = req.body;
    
    if (!audioPath) {
      return res.status(400).json({
        error: 'Audio path is required',
        message: 'Please provide the path to the audio file in the request body'
      });
    }

    console.log(`Transcribing audio file: ${audioPath}`);
    
    const transcription = await transcribeAudio(audioPath);
    
    res.json({
      success: true,
      message: 'Audio transcribed successfully',
      transcription: transcription
    });

  } catch (error) {
    console.error('Error transcribing audio:', error.message);
    res.status(500).json({
      error: 'Failed to transcribe audio',
      message: error.message
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'YouTube downloader server is running',
    timestamp: new Date().toISOString(),
    features: {
      videoDownload: true,
      audioDownload: true,
      transcription: !!HUGGINGFACE_API_KEY
    }
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'YouTube Downloader Server with AI Transcription',
    endpoints: {
      'POST /process-video': 'Download YouTube video, audio, and transcribe',
      'POST /transcribe': 'Transcribe existing audio file',
      'GET /health': 'Health check'
    },
    usage: {
      processVideo: {
        method: 'POST',
        url: '/process-video',
        body: {
          youtubeUrl: 'https://www.youtube.com/watch?v=VIDEO_ID'
        }
      },
      transcribe: {
        method: 'POST',
        url: '/transcribe',
        body: {
          audioPath: '/path/to/audio.wav'
        }
      }
    },
    features: {
      videoDownload: 'Best quality up to 1080p',
      audioDownload: 'WAV format',
      transcription: 'OpenAI Whisper via Hugging Face API',
      wordTimestamps: 'Word-level timing information'
    },
    environmentVariables: {
      HUGGINGFACE_API_KEY: 'Required for transcription',
      HUGGINGFACE_MODEL: 'Optional (default: openai/whisper-large-v3)',
      HUGGINGFACE_API_URL: 'Optional (default: https://api-inference.huggingface.co)'
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