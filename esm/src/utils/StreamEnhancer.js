import { Readable } from 'stream';
import ffmpegManager from './FFmpegManager.js';

class StreamEnhancer {
  /**
   * @param {ReadableStream} inputStream
   * @returns {ReadableStream}
   */
  static enhanceStream(inputStream) {
    if (!(inputStream instanceof Readable)) {
      return inputStream;
    }

    try {
      const options = {
        format: 'opus',
        channels: 2,
        bitrate: '96k',
        sampleRate: 48000
      };

      return ffmpegManager.convertAudioStream(inputStream, options);
    } catch (error) {
      //console.error(`[StreamEnhancer]: ${error.message}`);
      return inputStream;
    }
  }
}

export default StreamEnhancer;