# YouTube Downloader Server with AI Analysis

A Node.js Express server that downloads YouTube videos and audio using `yt-dlp-exec`, transcribes audio using OpenAI Whisper via Hugging Face API, and identifies viral video segments using Groq's Llama 3 8B model.

## Features

- Download best quality video (up to 1080p)
- Download audio as WAV format
- AI-powered audio transcription with word-level timestamps
- AI-powered viral clips analysis with virality scoring
- Store files in temporary directory
- Comprehensive error handling
- File size reporting
- Health check endpoint
- Separate endpoints for transcription and viral clips analysis

## Installation

1. Install dependencies:
```bash
npm install
```

2. Make sure you have `yt-dlp` installed on your system:
```bash
# On Ubuntu/Debian
sudo apt install yt-dlp

# On macOS with Homebrew
brew install yt-dlp

# Or install via pip
pip install yt-dlp
```

3. Set up environment variables:
```bash
# Copy the example file
cp .env.example .env

# Edit .env and add your API keys
HUGGINGFACE_API_KEY=your_huggingface_api_key_here
GROQ_API_KEY=your_groq_api_key_here
```

## Usage

1. Start the server:
```bash
npm start
```

2. Send a POST request to `/process-video` with a YouTube URL:

```bash
curl -X POST http://localhost:3000/process-video \
  -H "Content-Type: application/json" \
  -d '{"youtubeUrl": "https://www.youtube.com/watch?v=VIDEO_ID"}'
```

3. Or transcribe an existing audio file:

```bash
curl -X POST http://localhost:3000/transcribe \
  -H "Content-Type: application/json" \
  -d '{"audioPath": "/path/to/audio.wav"}'
```

4. Or analyze transcript for viral clips:

```bash
curl -X POST http://localhost:3000/find-viral-clips \
  -H "Content-Type: application/json" \
  -d '{"transcript": {"text": "transcript text...", "words": [{"word": "hello", "start": 0.5, "end": 0.8}]}}'
```

## API Endpoints

### POST /process-video
Downloads a YouTube video, its audio, transcribes the audio, and identifies viral clips.

**Request Body:**
```json
{
  "youtubeUrl": "https://www.youtube.com/watch?v=VIDEO_ID"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Video and audio downloaded successfully and audio transcribed successfully",
  "files": {
    "video": {
      "path": "/path/to/video.mp4",
      "filename": "video.mp4",
      "size": 12345678,
      "sizeFormatted": "11.77 MB"
    },
    "audio": {
      "path": "/path/to/audio.wav",
      "filename": "audio.wav",
      "size": 5678901,
      "sizeFormatted": "5.42 MB"
    }
  },
  "transcription": {
    "success": true,
    "text": "Full transcript text here...",
    "words": [
      {
        "word": "Hello",
        "start": 0.5,
        "end": 0.8
      }
    ],
    "chunks": [
      {
        "text": "Hello world",
        "timestamp": [0.5, 1.2]
      }
    ],
    "language": "en",
    "duration": 120.5
  },
  "viral_clips": {
    "success": true,
    "clips": [
      {
        "start_time": 15.5,
        "end_time": 45.2,
        "virality_score": 85,
        "reasoning": "High energy moment with clear hook and emotional appeal",
        "hook_title": "This Will Shock You!",
        "duration": 29.7
      }
    ],
    "total_clips": 5,
    "analysis_model": "llama3-8b-8192"
  },
  "downloadDir": "/path/to/download/directory"
}
```

### POST /transcribe
Transcribes an existing audio file.

**Request Body:**
```json
{
  "audioPath": "/path/to/audio.wav"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Audio transcribed successfully",
  "transcription": {
    "success": true,
    "text": "Full transcript text here...",
    "words": [
      {
        "word": "Hello",
        "start": 0.5,
        "end": 0.8
      }
    ],
    "chunks": [
      {
        "text": "Hello world",
        "timestamp": [0.5, 1.2]
      }
    ],
    "language": "en",
    "duration": 120.5
  }
}
```

### POST /find-viral-clips
Analyzes a transcript to identify viral video segments.

**Request Body:**
```json
{
  "transcript": {
    "text": "Full transcript text...",
    "words": [
      {
        "word": "Hello",
        "start": 0.5,
        "end": 0.8
      }
    ]
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Viral clips analysis completed successfully",
  "viral_clips": {
    "success": true,
    "clips": [
      {
        "start_time": 15.5,
        "end_time": 45.2,
        "virality_score": 85,
        "reasoning": "High energy moment with clear hook and emotional appeal",
        "hook_title": "This Will Shock You!",
        "duration": 29.7
      }
    ],
    "total_clips": 5,
    "analysis_model": "llama3-8b-8192"
  }
}
```

### GET /health
Health check endpoint.

### GET /
Server information and available endpoints.

## File Structure

```
├── server.js          # Main server file
├── package.json       # Dependencies and scripts
├── temp/              # Temporary download directory (created automatically)
└── README.md          # This file
```

## Notes

- Downloaded files are stored in the `temp/` directory
- Each download creates a unique timestamped folder
- The server downloads the best quality video up to 1080p
- Audio is extracted and converted to WAV format
- Make sure you have sufficient disk space for downloads