# YouTube Downloader Server

A Node.js Express server that downloads YouTube videos and audio using `yt-dlp-exec`.

## Features

- Download best quality video (up to 1080p)
- Download audio as WAV format
- Store files in temporary directory
- Comprehensive error handling
- File size reporting
- Health check endpoint

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

## API Endpoints

### POST /process-video
Downloads a YouTube video and its audio.

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
  "message": "Video and audio downloaded successfully",
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
  "downloadDir": "/path/to/download/directory"
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