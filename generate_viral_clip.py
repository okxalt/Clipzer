#!/usr/bin/env python3
"""
Viral Video Clip Generator

This script creates TikTok-style vertical video clips from longer videos with:
- 9:16 aspect ratio cropping
- Animated captions with word highlighting
- Hook title overlay
- Zoom-in effect
- Emoji integration

Usage: python generate_viral_clip.py <video_path> <transcript_json> <start_time> <end_time> <hook_title>
"""

import sys
import json
import os
import re
from moviepy.editor import *
from moviepy.video.fx import resize, crop
import argparse
from typing import List, Dict, Any

# Emoji mapping for common words
EMOJI_MAP = {
    'money': '💰', 'cash': '💰', 'dollar': '💰', 'rich': '💰', 'wealth': '💰',
    'idea': '💡', 'think': '💡', 'brain': '🧠', 'smart': '🧠', 'genius': '🧠',
    'fire': '🔥', 'hot': '🔥', 'amazing': '🔥', 'incredible': '🔥', 'awesome': '🔥',
    'love': '❤️', 'heart': '❤️', 'like': '❤️', 'adore': '❤️',
    'star': '⭐', 'best': '⭐', 'top': '⭐', 'winner': '⭐',
    'rocket': '🚀', 'launch': '🚀', 'boost': '🚀', 'success': '🚀',
    'lightning': '⚡', 'fast': '⚡', 'quick': '⚡', 'speed': '⚡',
    'crown': '👑', 'king': '👑', 'queen': '👑', 'royal': '👑',
    'diamond': '💎', 'precious': '💎', 'valuable': '💎',
    'trophy': '🏆', 'win': '🏆', 'victory': '🏆', 'champion': '🏆',
    'party': '🎉', 'celebrate': '🎉', 'fun': '🎉', 'excited': '🎉',
    'shock': '😱', 'surprised': '😱', 'wow': '😱', 'unbelievable': '😱',
    'laugh': '😂', 'funny': '😂', 'hilarious': '😂', 'joke': '😂',
    'cry': '😭', 'sad': '😭', 'emotional': '😭', 'touching': '😭',
    'angry': '😡', 'mad': '😡', 'furious': '😡', 'rage': '😡',
    'confused': '😕', 'lost': '😕', 'puzzled': '😕',
    'cool': '😎', 'awesome': '😎', 'smooth': '😎',
    'eyes': '👀', 'look': '👀', 'see': '👀', 'watch': '👀',
    'hand': '✋', 'stop': '✋', 'wait': '✋', 'hold': '✋',
    'thumbs': '👍', 'good': '👍', 'yes': '👍', 'approve': '👍',
    'thumbs_down': '👎', 'bad': '👎', 'no': '👎', 'disapprove': '👎',
    'clap': '👏', 'applaud': '👏', 'cheer': '👏', 'praise': '👏',
    'muscle': '💪', 'strong': '💪', 'power': '💪', 'tough': '💪',
    'brain': '🧠', 'think': '🧠', 'smart': '🧠', 'intelligent': '🧠',
    'heart': '❤️', 'love': '❤️', 'care': '❤️', 'passion': '❤️',
    'star': '⭐', 'shine': '⭐', 'bright': '⭐', 'glow': '⭐',
    'moon': '🌙', 'night': '🌙', 'dark': '🌙', 'sleep': '🌙',
    'sun': '☀️', 'day': '☀️', 'bright': '☀️', 'light': '☀️',
    'rainbow': '🌈', 'colorful': '🌈', 'beautiful': '🌈', 'magic': '🌈'
}

def get_emoji_for_word(word: str) -> str:
    """Get relevant emoji for a word based on keyword matching."""
    word_lower = word.lower().strip('.,!?;:"')
    
    # Direct match
    if word_lower in EMOJI_MAP:
        return EMOJI_MAP[word_lower]
    
    # Partial match
    for keyword, emoji in EMOJI_MAP.items():
        if keyword in word_lower or word_lower in keyword:
            return emoji
    
    # Default emoji for emphasis words
    emphasis_words = ['wow', 'amazing', 'incredible', 'unbelievable', 'shocking', 'crazy']
    if any(emphasis in word_lower for emphasis in emphasis_words):
        return '😱'
    
    return '✨'  # Default sparkle emoji

def create_word_clip(word_data: Dict[str, Any], duration: float, font_size: int = 50) -> TextClip:
    """Create a TextClip for a single word with emoji."""
    word = word_data.get('word', '')
    emoji = get_emoji_for_word(word)
    
    # Create text with emoji
    text_with_emoji = f"{word} {emoji}"
    
    # Create the text clip
    clip = TextClip(
        text_with_emoji,
        fontsize=font_size,
        color='white',
        font='Arial-Bold',
        stroke_color='black',
        stroke_width=2
    ).set_duration(duration)
    
    return clip

def create_highlighted_word_clip(word_data: Dict[str, Any], duration: float, font_size: int = 50) -> TextClip:
    """Create a highlighted TextClip for the current word."""
    word = word_data.get('word', '')
    emoji = get_emoji_for_word(word)
    
    # Create text with emoji
    text_with_emoji = f"{word} {emoji}"
    
    # Create the highlighted text clip (yellow background)
    clip = TextClip(
        text_with_emoji,
        fontsize=font_size,
        color='black',
        font='Arial-Bold',
        stroke_color='yellow',
        stroke_width=3
    ).set_duration(duration)
    
    return clip

def create_caption_line(words: List[Dict[str, Any]], start_time: float, end_time: float, 
                       font_size: int = 40, line_height: int = 60) -> CompositeVideoClip:
    """Create a line of captions with word highlighting."""
    duration = end_time - start_time
    clips = []
    
    # Calculate total text width for centering
    total_text = " ".join([word.get('word', '') for word in words])
    total_width = len(total_text) * (font_size * 0.6)  # Approximate character width
    
    current_x = 0
    
    for i, word_data in enumerate(words):
        word_duration = duration / len(words)
        word_start = start_time + (i * word_duration)
        
        # Create word clip
        if i == 0:  # Highlight first word
            word_clip = create_highlighted_word_clip(word_data, word_duration, font_size)
        else:
            word_clip = create_word_clip(word_data, word_duration, font_size)
        
        # Position the word
        word_clip = word_clip.set_position(('center', 0)).set_start(word_start - start_time)
        clips.append(word_clip)
    
    return CompositeVideoClip(clips, size=(1920, line_height))

def create_hook_title_overlay(hook_title: str, duration: float, video_width: int, video_height: int) -> TextClip:
    """Create a hook title overlay at the top of the video."""
    # Create background rectangle
    bg_clip = ColorClip(size=(video_width, 120), color=(0, 0, 0)).set_duration(duration)
    
    # Create title text
    title_clip = TextClip(
        hook_title,
        fontsize=60,
        color='yellow',
        font='Arial-Bold',
        stroke_color='black',
        stroke_width=3
    ).set_duration(duration)
    
    # Center the title
    title_clip = title_clip.set_position(('center', 30))
    
    # Composite background and title
    return CompositeVideoClip([bg_clip, title_clip])

def crop_to_vertical(video: VideoFileClip, target_ratio: float = 9/16) -> VideoFileClip:
    """Crop video to vertical (9:16) aspect ratio, keeping center content."""
    original_width, original_height = video.size
    original_ratio = original_width / original_height
    
    if original_ratio > target_ratio:
        # Video is wider than target, crop width
        new_width = int(original_height * target_ratio)
        x_center = original_width // 2
        x1 = x_center - new_width // 2
        x2 = x_center + new_width // 2
        return video.crop(x1=x1, x2=x2, y1=0, y2=original_height)
    else:
        # Video is taller than target, crop height
        new_height = int(original_width / target_ratio)
        y_center = original_height // 2
        y1 = y_center - new_height // 2
        y2 = y_center + new_height // 2
        return video.crop(x1=0, x2=original_width, y1=y1, y2=y2)

def add_zoom_effect(video: VideoFileClip, zoom_factor: float = 1.1) -> VideoFileClip:
    """Add a slow zoom-in effect to the video."""
    def zoom_func(t):
        # Slow zoom from 1.0 to zoom_factor over the duration
        progress = t / video.duration
        return 1.0 + (zoom_factor - 1.0) * progress
    
    return video.resize(zoom_func)

def generate_viral_clip(video_path: str, transcript_json: str, start_time: float, 
                       end_time: float, hook_title: str, output_path: str = "output.mp4"):
    """Generate a viral video clip with all effects."""
    
    print(f"Loading video: {video_path}")
    video = VideoFileClip(video_path)
    
    # Create subclip
    print(f"Creating subclip from {start_time}s to {end_time}s")
    subclip = video.subclip(start_time, end_time)
    
    # Crop to vertical (9:16) aspect ratio
    print("Cropping to 9:16 aspect ratio")
    vertical_clip = crop_to_vertical(subclip)
    
    # Add zoom effect
    print("Adding zoom effect")
    zoomed_clip = add_zoom_effect(vertical_clip)
    
    # Parse transcript
    try:
        transcript_data = json.loads(transcript_json)
    except json.JSONDecodeError as e:
        print(f"Error parsing transcript JSON: {e}")
        return False
    
    # Get words from transcript
    words = transcript_data.get('words', [])
    if not words:
        print("No words found in transcript")
        return False
    
    # Filter words within the clip timeframe
    clip_words = [word for word in words 
                  if word.get('start', 0) >= start_time and word.get('end', 0) <= end_time]
    
    if not clip_words:
        print("No words found in the specified timeframe")
        return False
    
    print(f"Found {len(clip_words)} words in clip timeframe")
    
    # Create captions
    print("Creating animated captions")
    caption_clips = []
    
    # Group words into lines (approximately 6-8 words per line)
    words_per_line = 6
    for i in range(0, len(clip_words), words_per_line):
        line_words = clip_words[i:i + words_per_line]
        if line_words:
            line_start = line_words[0].get('start', start_time) - start_time
            line_end = line_words[-1].get('end', end_time) - start_time
            
            caption_line = create_caption_line(line_words, line_start, line_end)
            # Position at bottom of video
            caption_line = caption_line.set_position(('center', vertical_clip.h - 200))
            caption_clips.append(caption_line)
    
    # Create hook title overlay
    print("Creating hook title overlay")
    title_overlay = create_hook_title_overlay(
        hook_title, 
        vertical_clip.duration, 
        vertical_clip.w, 
        vertical_clip.h
    )
    
    # Composite all elements
    print("Compositing final video")
    final_clips = [zoomed_clip, title_overlay] + caption_clips
    final_video = CompositeVideoClip(final_clips, size=vertical_clip.size)
    
    # Export video
    print(f"Exporting video to {output_path}")
    final_video.write_videofile(
        output_path,
        codec='libx264',
        audio_codec='aac',
        temp_audiofile='temp-audio.m4a',
        remove_temp=True,
        fps=30,
        preset='medium'
    )
    
    # Clean up
    video.close()
    subclip.close()
    vertical_clip.close()
    zoomed_clip.close()
    final_video.close()
    
    print("Video generation completed successfully!")
    return True

def main():
    """Main function to handle command line arguments."""
    parser = argparse.ArgumentParser(description='Generate viral video clips')
    parser.add_argument('video_path', help='Path to the input video file')
    parser.add_argument('transcript_json', help='JSON string containing transcript data')
    parser.add_argument('start_time', type=float, help='Start time in seconds')
    parser.add_argument('end_time', type=float, help='End time in seconds')
    parser.add_argument('hook_title', help='Hook title for the video')
    parser.add_argument('--output', default='output.mp4', help='Output file path')
    
    args = parser.parse_args()
    
    # Validate inputs
    if not os.path.exists(args.video_path):
        print(f"Error: Video file not found: {args.video_path}")
        sys.exit(1)
    
    if args.start_time >= args.end_time:
        print("Error: Start time must be less than end time")
        sys.exit(1)
    
    if args.end_time - args.start_time < 30:
        print("Warning: Clip duration is less than 30 seconds")
    elif args.end_time - args.start_time > 60:
        print("Warning: Clip duration is more than 60 seconds")
    
    # Generate the viral clip
    success = generate_viral_clip(
        args.video_path,
        args.transcript_json,
        args.start_time,
        args.end_time,
        args.hook_title,
        args.output
    )
    
    if success:
        print(f"✅ Viral clip generated successfully: {args.output}")
        sys.exit(0)
    else:
        print("❌ Failed to generate viral clip")
        sys.exit(1)

if __name__ == "__main__":
    main()