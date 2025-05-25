import axios from 'axios';
import semver from 'semver';
import { version } from "../../../package.json";

async function checkForUpdates() {
  try {
    const response = await axios.get("https://registry.npmjs.com/yukufy");
    const latestVersion = response.data["dist-tags"].latest;

    if (semver.gt(latestVersion, version)) {
      console.log(`\x1b[38;5;215mYou are using an outdated version of Yukufy. Update to the latest version using the command: \x1b[38;5;119m'npm i yukufy@${latestVersion}'\x1b[38;5;215m to get new features and bug fixes.\x1B[0m`);
    }
  } catch (err) {
    console.error("Error checking for updates:", err);
  }
}

// Check for updates every 5 minutes (300,000 milliseconds)
setInterval(checkForUpdates, 1000 * 300000);

checkForUpdates();