/**
 * Verify Update Script
 * Checks if a new version of Suwaku is available on npm
 */

import https from 'https';
import { writeFileSync, existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import packageJson from '../package.json' with { type: 'json' };

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const currentVersion = packageJson.version;

const PACKAGE_NAME = 'suwaku';
const NPM_REGISTRY = 'https://registry.npmjs.org';
const CHECK_INTERVAL = 86400000; // 24 hours in milliseconds

/**
 * Compare two semantic versions
 * @param {string} current - Current version
 * @param {string} latest - Latest version
 * @returns {number} -1 if current < latest, 0 if equal, 1 if current > latest
 */
function compareVersions(current, latest) {
  const currentParts = current.replace(/^v/, '').split('.').map(Number);
  const latestParts = latest.replace(/^v/, '').split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    const curr = currentParts[i] || 0;
    const lat = latestParts[i] || 0;

    if (curr < lat) return -1;
    if (curr > lat) return 1;
  }

  return 0;
}

/**
 * Fetch latest version from npm registry
 * @returns {Promise<string>} Latest version
 */
function fetchLatestVersion() {
  return new Promise((resolve, reject) => {
    const url = `${NPM_REGISTRY}/${PACKAGE_NAME}/latest`;

    https.get(url, { timeout: 5000 }, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json.version);
        } catch (error) {
          reject(new Error('Failed to parse npm registry response'));
        }
      });
    }).on('error', (error) => {
      reject(error);
    }).on('timeout', () => {
      reject(new Error('Request timeout'));
    });
  });
}

/**
 * Get update notification message
 * @param {string} current - Current version
 * @param {string} latest - Latest version
 * @returns {string} Notification message
 */
function getUpdateMessage(current, latest) {
  const comparison = compareVersions(current, latest);

  if (comparison < 0) {
    return `
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║  🎵 Suwaku Update Available!                              ║
║                                                            ║
║  Current Version: ${current.padEnd(10)} → Latest: ${latest.padEnd(10)}      ║
║                                                            ║
║  Run: npm install suwaku@latest                           ║
║                                                            ║
║  Changelog: https://github.com/shindozk/Suwaku/releases   ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
`;
  } else if (comparison > 0) {
    return `
ℹ️  You are using a pre-release version (${current})
   Latest stable: ${latest}
`;
  } else {
    return `✅ You are using the latest version of Suwaku (${current})`;
  }
}

/**
 * Check for updates
 * @param {Object} options - Check options
 * @param {boolean} [options.silent=false] - Suppress output if up to date
 * @param {boolean} [options.force=false] - Force check even if recently checked
 * @returns {Promise<Object>} Update information
 */
async function checkForUpdates(options = {}) {
  const { silent = false, force = false } = options;

  try {
    // Check if we should skip (unless forced)
    if (!force) {
      const lastCheck = getLastCheckTime();
      const now = Date.now();

      if (lastCheck && (now - lastCheck) < CHECK_INTERVAL) {
        if (!silent) {
          console.log('ℹ️  Update check skipped (checked recently)');
          console.log('   Use --force to check anyway');
        }
        return { skipped: true };
      }
    }

    if (!silent) {
      console.log('🔍 Checking for Suwaku updates...');
    }

    const latestVersion = await fetchLatestVersion();
    const comparison = compareVersions(currentVersion, latestVersion);

    // Save last check time
    saveLastCheckTime();

    const result = {
      current: currentVersion,
      latest: latestVersion,
      updateAvailable: comparison < 0,
      isPreRelease: comparison > 0,
      isLatest: comparison === 0
    };

    if (!silent || result.updateAvailable) {
      console.log(getUpdateMessage(currentVersion, latestVersion));
    }

    return result;
  } catch (error) {
    if (!silent) {
      console.error('❌ Failed to check for updates:', error.message);
      console.error('   This is not critical - Suwaku will continue to work normally');
    }
    return { error: error.message };
  }
}

/**
 * Get last check timestamp from cache
 * @returns {number|null} Timestamp or null
 */
function getLastCheckTime() {
  try {
    const cacheFile = join(__dirname, '..', '.update-check');

    if (existsSync(cacheFile)) {
      const data = readFileSync(cacheFile, 'utf8');
      return parseInt(data, 10);
    }
  } catch {
    // Ignore errors
  }
  return null;
}

/**
 * Save last check timestamp to cache
 */
function saveLastCheckTime() {
  try {
    const cacheFile = join(__dirname, '..', '.update-check');
    writeFileSync(cacheFile, Date.now().toString(), 'utf8');
  } catch {
    // Ignore errors
  }
}

/**
 * CLI interface
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const options = {
    silent: args.includes('--silent') || args.includes('-s'),
    force: args.includes('--force') || args.includes('-f')
  };

  checkForUpdates(options)
    .then((result) => {
      if (result.updateAvailable) {
        process.exit(1); // Exit with code 1 if update available
      }
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(2);
    });
}

export {
  checkForUpdates,
  compareVersions,
  fetchLatestVersion,
  getUpdateMessage
};
