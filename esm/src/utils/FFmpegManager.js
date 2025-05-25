import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';

class FFmpegManager {
  constructor() {
    ffmpeg.setFfmpegPath(ffmpegPath);
    
    //console.log(`[FFmpegManager] Start ffmpeg-static: ${ffmpegPath}`);
  }

  /**
   * @param {ReadableStream} inputStream
   * @param {Object} options
   * @returns {ReadableStream}
   */
  convertAudioStream(inputStream, options = {}) {
    const {
      format = 'opus',
      channels = 2,
      bitrate = '96k',
      sampleRate = 48000,
    } = options;

    return ffmpeg(inputStream)
      .noVideo()
      .audioChannels(channels)
      .audioFrequency(sampleRate)
      .audioBitrate(bitrate)
      .format(format)
      .on('error', error => {
        //console.error(`[FFmpegManager]: ${error.message}`);
        return;
      })
      .pipe();
  }

  /**
   * @param {string} inputPath
   * @param {string} outputPath
   * @param {Object} options
   * @returns {Promise}
   */
  processAudioFile(inputPath, outputPath, options = {}) {
    return new Promise((resolve, reject) => {
      const {
        format = 'mp3',
        channels = 2,
        bitrate = '128k',
        sampleRate = 44100,
      } = options;

      ffmpeg(inputPath)
        .noVideo()
        .audioChannels(channels)
        .audioFrequency(sampleRate)
        .audioBitrate(bitrate)
        .format(format)
        .on('end', () => {
          resolve(outputPath);
        })
        .on('error', error => {
          //console.error(`[FFmpegManager]: ${error.message}`);
          return;
          reject(error);
        })
        .save(outputPath);
    });
  }
}

const ffmpegManager = new FFmpegManager();
export default ffmpegManager;