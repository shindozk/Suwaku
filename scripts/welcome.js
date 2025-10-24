/**
 * Welcome Script
 * Displays helpful information when Suwaku is installed
 */

import packageJson from '../package.json' with { type: 'json' };
const { version } = packageJson;

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m'
};

function colorize(text, color) {
  return `${COLORS[color]}${text}${COLORS.reset}`;
}

function displayWelcome() {
  console.log('');
  console.log(colorize('╔════════════════════════════════════════════════════════════╗', 'cyan'));
  console.log(colorize('║                                                            ║', 'cyan'));
  console.log(colorize('║  ', 'cyan') + colorize('🎵 Suwaku', 'bright') + colorize(' - Lavalink Music Player for Discord.js     ║', 'cyan'));
  console.log(colorize('║                                                            ║', 'cyan'));
  console.log(colorize('║  ', 'cyan') + colorize(`Version: ${version}`, 'green') + colorize('                                          ║', 'cyan'));
  console.log(colorize('║                                                            ║', 'cyan'));
  console.log(colorize('╚════════════════════════════════════════════════════════════╝', 'cyan'));
  console.log('');
  console.log(colorize('📚 Quick Start:', 'bright'));
  console.log('');
  console.log('  1. Set up Lavalink server:');
  console.log(colorize('     Download from: https://github.com/lavalink-devs/Lavalink/releases', 'blue'));
  console.log('');
  console.log('  2. Configure your bot:');
  console.log(colorize('     import { SuwakuClient } from \'suwaku\';', 'yellow'));
  console.log(colorize('     const suwaku = new SuwakuClient(client, {', 'yellow'));
  console.log(colorize('       nodes: [{ host: \'localhost\', port: 2333, password: \'pass\' }]', 'yellow'));
  console.log(colorize('     });', 'yellow'));
  console.log('');
  console.log('  3. Play music:');
  console.log(colorize('     await suwaku.play({ query, voiceChannel, textChannel, member });', 'yellow'));
  console.log('');
  console.log(colorize('📖 Documentation:', 'bright'));
  console.log(colorize('   https://github.com/shindozk/Suwaku#readme', 'blue'));
  console.log('');
  console.log(colorize('💬 Support:', 'bright'));
  console.log(colorize('   https://discord.gg/your-server', 'blue'));
  console.log('');
  console.log(colorize('🐛 Issues:', 'bright'));
  console.log(colorize('   https://github.com/shindozk/Suwaku/issues', 'blue'));
  console.log('');
  console.log(colorize('⭐ Star us on GitHub if you like Suwaku!', 'magenta'));
  console.log('');
}

// Check if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  displayWelcome();
}

export { displayWelcome };
