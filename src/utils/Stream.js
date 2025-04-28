import axios from 'axios';
import { Readable } from 'stream';

const API_KEY = process.env.RAPIDAPI_KEY || '195d9d56f0mshf2ef5b15de50facp11ef65jsn7dbd159005d4'; // Fallback only for testing
const API_HOST = 'youtube-mp4-mp3-downloader.p.rapidapi.com';
const BASE_URL = `https://youtube-mp4-mp3-downloader.p.rapidapi.com/api/v1`;

const commonHeaders = {
  'x-rapidapi-key': API_KEY,
  'x-rapidapi-host': API_HOST,
};

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function extractYouTubeId(url) {
  if (!url) return null;
  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

async function getAudioStream(youtubeUrl, options = {}) {
  const videoId = extractYouTubeId(youtubeUrl);
  if (!videoId) {
    // Throwing an error is better than just logging for control flow
    throw new Error(`Could not extract video ID from URL: ${youtubeUrl}`);
  }

  // Seek option is ignored as this API method doesn't support it.
  // No warning log as requested by user.

  let progressId;
  try {
    const initialOptions = {
      method: 'GET',
      url: `${BASE_URL}/download`,
      params: {
        id: videoId,
        format: 'mp3',
        audioQuality: '320',
        addInfo: 'false'
      },
      headers: commonHeaders,
    };
    const initialResponse = await axios.request(initialOptions);

    if (!initialResponse.data?.success || !initialResponse.data?.progressId) {
      console.error("[Stream] Invalid initial API response:", initialResponse.data);
      throw new Error(`Failed to initiate process via API: ${initialResponse.data?.message || 'Invalid API response'}`);
    }
    progressId = initialResponse.data.progressId;

  } catch (error) {
    // Log specific axios errors if available
    console.error("[Stream] Error during initial request:", error.response?.data || error.message);
    throw new Error(`Error requesting download from API: ${error.response?.data?.message || error.message}`);
  }

  let downloadUrl = null;
  const pollInterval = 3000;
  const maxAttempts = 40;
  let attempts = 0;

  while (attempts < maxAttempts) {
    attempts++;
    await delay(pollInterval);

    try {
      const progressOptions = {
        method: 'GET',
        url: `${BASE_URL}/progress`,
        params: { id: progressId },
        headers: commonHeaders,
      };
      const progressResponse = await axios.request(progressOptions);
      const data = progressResponse.data;

      if (data?.status === 'Finished') {
        if (!data.downloadUrl) {
            console.error("[Stream] Status 'Finished' but no downloadUrl received:", data);
            throw new Error("API returned status 'Finished' but download URL was missing.");
        }
        downloadUrl = data.downloadUrl;
        break;
      } else if (data?.status === 'Error' || data?.status === 'Failed') {
          console.error("[Stream] API returned error during progress check:", data);
          throw new Error(`API failed to process video (Status: ${data.status}).`);
      }
      // Continue loop if status is 'Processing', 'Queued', etc.

    } catch (error) {
      console.error(`[Stream] Error during polling (attempt ${attempts}/${maxAttempts}):`, error.response?.data || error.message);
      if (attempts >= maxAttempts) {
          throw new Error(`Error or timeout during progress polling: ${error.response?.data?.message || error.message}`);
      }
      // Continue polling on error unless max attempts reached
    }
  }

  if (!downloadUrl) {
    throw new Error(`Timeout: Video processing did not complete within ${maxAttempts * pollInterval / 1000} seconds.`);
  }

  try {
    const audioStreamResponse = await axios.get(downloadUrl, {
      responseType: 'stream',
      timeout: 60000, // Add a timeout for fetching the final stream (e.g., 60 seconds)
    });

    if (!(audioStreamResponse.data instanceof Readable)) {
        console.error("[Stream] Response from downloadUrl was not a readable stream.");
        throw new Error("Final download URL did not return a valid stream.");
    }

     audioStreamResponse.data.on('error', (error) => {
        //console.error(`[Stream] Error during final audio streaming for ${videoId}:`, error.message);
        return;
     });

    return audioStreamResponse.data;

  } catch (error) {
    console.error(`[Stream] Error fetching final stream from downloadUrl (${downloadUrl}):`, error.response?.status, error.response?.statusText, error.message);
    throw new Error(`Failed to download processed audio: ${error.response?.statusText || error.message}`);
  }
}

export { getAudioStream };