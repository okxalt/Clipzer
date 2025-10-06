const express = require('express');
const ytdlp = require('yt-dlp-exec');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const axios = require('axios');
const FormData = require('form-data');
const Groq = require('groq-sdk');
const { spawn } = require('child_process');
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

// Groq API configuration
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama3-8b-8192';

// Initialize Groq client
const groq = new Groq({
  apiKey: GROQ_API_KEY,
});

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

// Find viral clips using Groq API
async function findViralClips(transcript) {
  try {
    if (!GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY environment variable is not set');
    }

    if (!transcript || !transcript.text) {
      throw new Error('Invalid transcript data provided');
    }

    console.log('Analyzing transcript for viral clips...');
    
    // Format the transcript with word-level timestamps for the AI
    let formattedTranscript = '';
    
    if (transcript.words && transcript.words.length > 0) {
      // Use word-level timestamps if available
      formattedTranscript = transcript.words.map(word => 
        `[${word.start.toFixed(2)}s-${word.end.toFixed(2)}s] ${word.word}`
      ).join(' ');
    } else if (transcript.chunks && transcript.chunks.length > 0) {
      // Use chunk-level timestamps if available
      formattedTranscript = transcript.chunks.map(chunk => 
        `[${chunk.timestamp[0].toFixed(2)}s-${chunk.timestamp[1].toFixed(2)}s] ${chunk.text}`
      ).join(' ');
    } else {
      // Fallback to just the text
      formattedTranscript = transcript.text;
    }

    const prompt = `You are a viral video expert. Analyze this transcript which includes word-level timestamps. Identify up to 7 segments between 30 and 60 seconds long that are perfect for a TikTok video. For each segment, provide a JSON object with: start_time, end_time, a virality_score from 1 to 100, a reasoning for why it's viral, and a short, punchy hook_title under 10 words. Respond ONLY with a JSON array of these objects.

Transcript:
${formattedTranscript}

Requirements:
- Each segment must be 30-60 seconds long
- Virality score should be 1-100 based on engagement potential
- Reasoning should explain why it would go viral
- Hook title should be under 10 words and attention-grabbing
- Return ONLY a valid JSON array, no other text`;

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      model: GROQ_MODEL,
      temperature: 0.7,
      max_tokens: 2000,
    });

    const responseText = completion.choices[0]?.message?.content;
    
    if (!responseText) {
      throw new Error('No response received from Groq API');
    }

    console.log('Raw Groq response:', responseText);

    // Try to parse the JSON response
    let viralClips;
    try {
      // Clean the response to extract JSON
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      const jsonString = jsonMatch ? jsonMatch[0] : responseText;
      viralClips = JSON.parse(jsonString);
    } catch (parseError) {
      console.error('Failed to parse JSON response:', parseError);
      console.error('Raw response:', responseText);
      throw new Error('Failed to parse viral clips response as JSON');
    }

    // Validate the response structure
    if (!Array.isArray(viralClips)) {
      throw new Error('Response is not an array');
    }

    // Validate each clip has required fields
    const validatedClips = viralClips.map((clip, index) => {
      if (!clip.start_time || !clip.end_time || !clip.virality_score || !clip.reasoning || !clip.hook_title) {
        console.warn(`Clip ${index} missing required fields:`, clip);
      }
      
      return {
        start_time: parseFloat(clip.start_time) || 0,
        end_time: parseFloat(clip.end_time) || 0,
        virality_score: parseInt(clip.virality_score) || 0,
        reasoning: clip.reasoning || 'No reasoning provided',
        hook_title: clip.hook_title || 'Untitled',
        duration: (parseFloat(clip.end_time) || 0) - (parseFloat(clip.start_time) || 0)
      };
    });

    // Sort by virality score (highest first)
    validatedClips.sort((a, b) => b.virality_score - a.virality_score);

    console.log(`Found ${validatedClips.length} viral clips`);
    console.log('Top clip:', validatedClips[0]);

    return {
      success: true,
      clips: validatedClips,
      total_clips: validatedClips.length,
      analysis_model: GROQ_MODEL
    };

  } catch (error) {
    console.error('Error finding viral clips:', error.message);
    
    // Handle specific API errors
    if (error.message.includes('API key')) {
      throw new Error('Invalid Groq API key');
    } else if (error.message.includes('rate limit')) {
      throw new Error('Groq API rate limit exceeded. Please try again later');
    } else if (error.message.includes('quota')) {
      throw new Error('Groq API quota exceeded. Please check your usage limits');
    }
    
    throw error;
  }
}

// Generate viral clip using Python script
async function generateViralClip(videoPath, transcript, startTime, endTime, hookTitle, outputDir) {
  return new Promise((resolve, reject) => {
    try {
      console.log(`Generating viral clip: ${startTime}s - ${endTime}s`);
      console.log(`Hook title: ${hookTitle}`);
      
      // Prepare transcript JSON
      const transcriptJson = JSON.stringify(transcript);
      
      // Output path
      const outputPath = path.join(outputDir, `viral_clip_${Date.now()}.mp4`);
      
      // Python script path
      const pythonScript = path.join(__dirname, 'generate_viral_clip.py');
      
      // Check if Python script exists
      if (!fs.existsSync(pythonScript)) {
        throw new Error('Python script not found: generate_viral_clip.py');
      }
      
      // Check if video file exists
      if (!fs.existsSync(videoPath)) {
        throw new Error(`Video file not found: ${videoPath}`);
      }
      
      // Spawn Python process
      const pythonProcess = spawn('python3', [
        pythonScript,
        videoPath,
        transcriptJson,
        startTime.toString(),
        endTime.toString(),
        hookTitle,
        '--output', outputPath
      ]);
      
      let stdout = '';
      let stderr = '';
      
      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
        console.log(`Python stdout: ${data.toString().trim()}`);
      });
      
      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
        console.error(`Python stderr: ${data.toString().trim()}`);
      });
      
      pythonProcess.on('close', (code) => {
        if (code === 0) {
          console.log('Viral clip generated successfully');
          resolve({
            success: true,
            outputPath: outputPath,
            message: 'Viral clip generated successfully'
          });
        } else {
          console.error(`Python process exited with code ${code}`);
          reject(new Error(`Video generation failed: ${stderr || stdout}`));
        }
      });
      
      pythonProcess.on('error', (error) => {
        console.error('Python process error:', error);
        reject(new Error(`Failed to start Python process: ${error.message}`));
      });
      
    } catch (error) {
      console.error('Error in generateViralClip:', error.message);
      reject(error);
    }
  });
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

    // Find viral clips if transcription is available
    let viralClips = null;
    if (transcription && transcription.success) {
      try {
        console.log('Analyzing transcript for viral clips...');
        viralClips = await findViralClips(transcription);
        console.log('Viral clips analysis completed successfully');
      } catch (viralClipsError) {
        console.warn('Viral clips analysis failed:', viralClipsError.message);
        // Continue without viral clips analysis rather than failing the entire request
      }
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

    // Add viral clips data if available
    if (viralClips) {
      response.viral_clips = viralClips;
      response.message += ' and viral clips identified';
    } else {
      response.viral_clips = {
        success: false,
        error: 'Viral clips analysis failed - check server logs for details'
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

// Find viral clips endpoint
app.post('/find-viral-clips', async (req, res) => {
  try {
    const { transcript } = req.body;
    
    if (!transcript) {
      return res.status(400).json({
        error: 'Transcript is required',
        message: 'Please provide transcript data in the request body'
      });
    }

    console.log('Analyzing transcript for viral clips...');
    
    const viralClips = await findViralClips(transcript);
    
    res.json({
      success: true,
      message: 'Viral clips analysis completed successfully',
      viral_clips: viralClips
    });

  } catch (error) {
    console.error('Error finding viral clips:', error.message);
    res.status(500).json({
      error: 'Failed to analyze viral clips',
      message: error.message
    });
  }
});

// Generate viral clip endpoint
app.post('/generate-viral-clip', async (req, res) => {
  try {
    const { videoPath, transcript, startTime, endTime, hookTitle } = req.body;
    
    if (!videoPath || !transcript || startTime === undefined || endTime === undefined || !hookTitle) {
      return res.status(400).json({
        error: 'Missing required parameters',
        message: 'Please provide videoPath, transcript, startTime, endTime, and hookTitle'
      });
    }

    console.log(`Generating viral clip: ${startTime}s - ${endTime}s`);
    console.log(`Hook title: ${hookTitle}`);
    
    // Generate the viral clip
    const result = await generateViralClip(
      videoPath,
      transcript,
      startTime,
      endTime,
      hookTitle,
      tempDir
    );
    
    // Get file stats
    const stats = fs.statSync(result.outputPath);
    
    res.json({
      success: true,
      message: 'Viral clip generated successfully',
      clip: {
        path: result.outputPath,
        filename: path.basename(result.outputPath),
        size: stats.size,
        sizeFormatted: `${(stats.size / 1024 / 1024).toFixed(2)} MB`,
        duration: endTime - startTime,
        startTime: startTime,
        endTime: endTime,
        hookTitle: hookTitle
      }
    });

  } catch (error) {
    console.error('Error generating viral clip:', error.message);
    res.status(500).json({
      error: 'Failed to generate viral clip',
      message: error.message
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'YouTube downloader server with AI analysis is running',
    timestamp: new Date().toISOString(),
    features: {
      videoDownload: true,
      audioDownload: true,
      transcription: !!HUGGINGFACE_API_KEY,
      viralClipsAnalysis: !!GROQ_API_KEY,
      viralClipGeneration: true
    },
    apis: {
      huggingFace: !!HUGGINGFACE_API_KEY,
      groq: !!GROQ_API_KEY,
      python: true
    }
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'YouTube Downloader Server with AI Analysis',
    endpoints: {
      'POST /process-video': 'Download YouTube video, audio, transcribe, and find viral clips',
      'POST /transcribe': 'Transcribe existing audio file',
      'POST /find-viral-clips': 'Analyze transcript for viral video segments',
      'POST /generate-viral-clip': 'Generate TikTok-style viral video clip',
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
      },
      findViralClips: {
        method: 'POST',
        url: '/find-viral-clips',
        body: {
          transcript: {
            text: 'transcript text...',
            words: [{'word': 'hello', 'start': 0.5, 'end': 0.8}]
          }
        }
      },
      generateViralClip: {
        method: 'POST',
        url: '/generate-viral-clip',
        body: {
          videoPath: '/path/to/video.mp4',
          transcript: {
            text: 'transcript text...',
            words: [{'word': 'hello', 'start': 0.5, 'end': 0.8}]
          },
          startTime: 15.5,
          endTime: 45.2,
          hookTitle: 'This Will Shock You!'
        }
      }
    },
    features: {
      videoDownload: 'Best quality up to 1080p',
      audioDownload: 'WAV format',
      transcription: 'OpenAI Whisper via Hugging Face API',
      viralClipsAnalysis: 'AI-powered viral segment identification',
      viralClipGeneration: 'TikTok-style vertical video clips with captions',
      wordTimestamps: 'Word-level timing information',
      viralityScoring: '1-100 virality scores with reasoning',
      animatedCaptions: 'Word-by-word highlighting with emojis',
      verticalFormat: '9:16 aspect ratio for mobile viewing'
    },
    environmentVariables: {
      HUGGINGFACE_API_KEY: 'Required for transcription',
      HUGGINGFACE_MODEL: 'Optional (default: openai/whisper-large-v3)',
      HUGGINGFACE_API_URL: 'Optional (default: https://api-inference.huggingface.co)',
      GROQ_API_KEY: 'Required for viral clips analysis',
      GROQ_MODEL: 'Optional (default: llama3-8b-8192)'
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