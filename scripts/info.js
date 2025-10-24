/**
 * Info Script
 * Displays system and package information for debugging
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import os from 'os';
import packageJson from '../package.json' with { type: 'json' };

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const version = packageJson.version;

function getNodeVersion() {
  return process.version;
}

function getDiscordJsVersion() {
  try {
    const djsPackage = JSON.parse(readFileSync(join(process.cwd(), 'node_modules', 'discord.js', 'package.json'), 'utf-8'));
    return djsPackage.version;
  } catch {
    return 'Not installed';
  }
}

function getInstalledDependencies() {
  try {
    const deps = packageJson.dependencies || {};
    const installed = {};

    for (const [name] of Object.entries(deps)) {
      try {
        const depPackage = JSON.parse(readFileSync(join(process.cwd(), 'node_modules', name, 'package.json'), 'utf-8'));
        installed[name] = depPackage.version;
      } catch {
        installed[name] = 'Not installed';
      }
    }

    return installed;
  } catch {
    return {};
  }
}

function getSystemInfo() {
  return {
    platform: os.platform(),
    arch: os.arch(),
    nodeVersion: getNodeVersion(),
    cpus: os.cpus().length,
    totalMemory: `${Math.round(os.totalmem() / 1024 / 1024 / 1024)}GB`,
    freeMemory: `${Math.round(os.freemem() / 1024 / 1024 / 1024)}GB`
  };
}

function displayInfo() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Suwaku System Information');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

  console.log('📦 Package Information:');
  console.log(`   Suwaku Version: ${version}`);
  console.log(`   Discord.js Version: ${getDiscordJsVersion()}`);
  console.log('');

  console.log('💻 System Information:');
  const sysInfo = getSystemInfo();
  console.log(`   Platform: ${sysInfo.platform} (${sysInfo.arch})`);
  console.log(`   Node.js: ${sysInfo.nodeVersion}`);
  console.log(`   CPUs: ${sysInfo.cpus}`);
  console.log(`   Memory: ${sysInfo.freeMemory} free / ${sysInfo.totalMemory} total`);
  console.log('');

  console.log('📚 Dependencies:');
  const deps = getInstalledDependencies();
  for (const [name, ver] of Object.entries(deps)) {
    console.log(`   ${name}: ${ver}`);
  }
  console.log('');

  console.log('📁 Paths:');
  console.log(`   Working Directory: ${process.cwd()}`);
  console.log(`   Suwaku Location: ${dirname(__dirname)}`);
  console.log('');

  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  displayInfo();
}

export {
  getSystemInfo,
  getNodeVersion,
  getDiscordJsVersion,
  getInstalledDependencies,
  displayInfo
};
