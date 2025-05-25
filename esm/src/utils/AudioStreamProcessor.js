import { Readable } from 'stream';
import ffmpegManager from './FFmpegManager.js';

class AudioStreamProcessor {
  /**
   * @param {ReadableStream} inputStream
   * @param {Object} options
   * @returns {ReadableStream}
   */
  static processForDiscord(inputStream, options = {}) {
    if (!(inputStream instanceof Readable)) {
      throw new Error('Input stream must be a readable stream');
    }

    const discordOptions = {
      format: 'opus',
      channels: 2,
      bitrate: '96k',
      sampleRate: 48000,
      ...options
    };

    return ffmpegManager.convertAudioStream(inputStream, discordOptions);
  }

  /**
   * @param {ReadableStream} inputStream
   * @param {Object} options
   * @returns {ReadableStream}
   */
  static convertToMp3(inputStream, options = {}) {
    if (!(inputStream instanceof Readable)) {
      throw new Error('Input stream must be a readable stream');
    }

    const mp3Options = {
      format: 'mp3',
      channels: 2,
      bitrate: '128k',
      sampleRate: 44100,
      ...options
    };

    return ffmpegManager.convertAudioStream(inputStream, mp3Options);
  }
}

export default AudioStreamProcessor;