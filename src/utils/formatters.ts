/**
 * Utility functions for formatting data
 * @module utils/formatters
 */

/**
 * Convert milliseconds to MM:SS or HH:MM:SS format
 * @param ms - Duration in milliseconds
 * @returns Formatted duration string
 */
export function formatDuration(ms: number): string {
  if (isNaN(ms) || ms < 0) return '0:00';

  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor(ms / (1000 * 60 * 60));

  const pad = (num: number): string => String(num).padStart(2, '0');

  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${minutes}:${pad(seconds)}`;
}

/**
 * Parse duration string (MM:SS or HH:MM:SS) to milliseconds
 * @param duration - Duration string
 * @returns Duration in milliseconds
 */
export function parseDuration(duration: string): number {
  if (!duration || typeof duration !== 'string') return 0;

  const parts = duration.split(':').map(Number);
  if (parts.some(isNaN)) return 0;

  if (parts.length === 2) {
    // MM:SS
    return (parts[0] * 60 + parts[1]) * 1000;
  } else if (parts.length === 3) {
    // HH:MM:SS
    return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
  }

  return 0;
}

/**
 * Format bytes to human-readable string
 * @param bytes - Number of bytes
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string (e.g., "1.5 MB")
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

/**
 * Format timestamp to readable date/time
 * @param timestamp - Unix timestamp in milliseconds
 * @param locale - Locale for formatting (default: system locale)
 * @param options - Intl.DateTimeFormatOptions
 * @returns Formatted date/time string
 */
export function formatTimestamp(
  timestamp: number,
  locale?: string,
  options?: Intl.DateTimeFormatOptions
): string {
  const date = new Date(timestamp);
  return date.toLocaleString(locale, options);
}

/**
 * Create a progress bar string
 * @param current - Current position in milliseconds
 * @param total - Total duration in milliseconds
 * @param length - Length of the progress bar (default: 20)
 * @param filledChar - Character for filled portion (default: '▓')
 * @param emptyChar - Character for empty portion (default: '░')
 * @returns Progress bar string
 */
export function createProgressBar(
  current: number,
  total: number,
  length = 20,
  filledChar = '▓',
  emptyChar = '░'
): string {
  if (total === 0) return emptyChar.repeat(length);

  const progress = Math.min(current / total, 1);
  const filled = Math.round(progress * length);
  const empty = length - filled;

  return filledChar.repeat(filled) + emptyChar.repeat(empty);
}

/**
 * Truncate string to specified length
 * @param str - String to truncate
 * @param maxLength - Maximum length
 * @param suffix - Suffix to append when truncated (default: '...')
 * @returns Truncated string
 */
export function truncate(str: string, maxLength = 50, suffix = '...'): string {
  if (!str || str.length <= maxLength) return str;
  return `${str.substring(0, maxLength - suffix.length)}${suffix}`;
}

/**
 * Format number with commas/thousands separators
 * @param num - Number to format
 * @param locale - Locale for formatting (default: system locale)
 * @returns Formatted number string
 */
export function formatNumber(num: number, locale?: string): string {
  return num.toLocaleString(locale);
}

/**
 * Format milliseconds to human-readable time (e.g., "2h 30m 15s")
 * @param ms - Duration in milliseconds
 * @param short - Use short format (default: false)
 * @returns Formatted time string
 */
export function formatTime(ms: number, short = false): string {
  if (isNaN(ms) || ms < 0) return short ? '0s' : '0 seconds';

  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));

  const parts: string[] = [];

  if (days > 0) parts.push(short ? `${days}d` : `${days} day${days !== 1 ? 's' : ''}`);
  if (hours > 0) parts.push(short ? `${hours}h` : `${hours} hour${hours !== 1 ? 's' : ''}`);
  if (minutes > 0) parts.push(short ? `${minutes}m` : `${minutes} minute${minutes !== 1 ? 's' : ''}`);
  if (seconds > 0 || parts.length === 0) parts.push(short ? `${seconds}s` : `${seconds} second${seconds !== 1 ? 's' : ''}`);

  return parts.join(short ? ' ' : ', ');
}

/**
 * Format a queue position
 * @param position - Position (0-indexed)
 * @returns Formatted position (1-indexed)
 */
export function formatQueuePosition(position: number): string {
  return `#${position + 1}`;
}

/**
 * Format volume percentage
 * @param volume - Volume (0-1000)
 * @returns Formatted volume string
 */
export function formatVolume(volume: number): string {
  return `${Math.round(Math.min(Math.max(volume, 0), 1000))}%`;
}

/**
 * Format filter settings for display
 * @param filters - Filter settings object
 * @returns Formatted filter string
 */
export function formatFilters(filters: Record<string, unknown>): string {
  if (!filters || Object.keys(filters).length === 0) return 'None';

  const entries = Object.entries(filters);
  return entries
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        return `${key}: [${value.map(v => JSON.stringify(v)).join(', ')}]`;
      }
      return `${key}: ${JSON.stringify(value)}`;
    })
    .join(', ');
}

/**
 * Create a Discord-friendly embed field value
 * @param lines - Array of lines
 * @param maxLength - Maximum length (default: 1024)
 * @returns Formatted string for embed field
 */
export function formatEmbedField(lines: string[], maxLength = 1024): string {
  const joined = lines.join('\n');
  if (joined.length <= maxLength) return joined;
  return truncate(joined, maxLength);
}

/**
 * Format memory usage
 * @param used - Used memory in bytes
 * @param total - Total memory in bytes
 * @returns Formatted memory string
 */
export function formatMemoryUsage(used: number, total: number): string {
  const percentage = total > 0 ? ((used / total) * 100).toFixed(1) : '0.0';
  return `${formatBytes(used)} / ${formatBytes(total)} (${percentage}%)`;
}

/**
 * Format CPU load
 * @param load - System load (0-1)
 * @param cores - Number of CPU cores
 * @returns Formatted CPU load string
 */
export function formatCpuLoad(load: number, cores?: number): string {
  const percentage = (load * 100).toFixed(1);
  return cores ? `${percentage}% (${cores} cores)` : `${percentage}%`;
}

/**
 * Sanitize string for safe display (remove mentions, code blocks, etc.)
 * @param str - String to sanitize
 * @returns Sanitized string
 */
export function sanitize(str: string): string {
  return str
    .replace(/@(everyone|here)/g, '@\u200b$1')
    .replace(/`/g, '\u200b`')
    .replace(/```/g, '\u200b```');
}

/**
 * Format track info for display
 * @param track - Track data
 * @returns Formatted track string
 */
export function formatTrackInfo(track: {
  title: string;
  author: string;
  duration: number;
  url?: string;
  requester?: { username?: string; displayName?: string };
}): string {
  const requester = track.requester?.displayName || track.requester?.username || 'Unknown';
  const duration = formatDuration(track.duration);
  const link = track.url ? `[${track.title}](${track.url})` : track.title;
  
  return `**${link}** by *${track.author}* \`[${duration}]\`\nRequested by: ${requester}`;
}

/**
 * Capitalize first letter of each word
 * @param str - String to capitalize
 * @returns Capitalized string
 */
export function capitalize(str: string): string {
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Convert camelCase/PascalCase to Title Case
 * @param str - String to convert
 * @returns Title case string
 */
export function toTitleCase(str: string): string {
  return str
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, char => char.toUpperCase())
    .trim();
}

/**
 * Format error for display
 * @param error - Error object
 * @returns Formatted error string
 */
export function formatError(error: Error | unknown): string {
  if (error instanceof Error) {
    return `**${error.name}**: ${error.message}`;
  }
  return `**Error**: ${String(error)}`;
}