import { STORAGE_KEYS } from './config';
import { WhitelistPattern } from './types/global';
import { logger } from './utils/logger';

export async function isWhitelisted(url: string): Promise<boolean> {
  try {
    const patterns = await getWhitelistPatterns();
    const hostname = new URL(url).hostname;
    
    // Check if patterns match the URL
    const isPatternMatch = patterns.some(pattern => matchesPattern(url, pattern.pattern));
    
    if (!isPatternMatch) {
      logger.log(`URL not in whitelist patterns: ${url}`);
      return false;
    }
    
    // Check per-hostname toggle
    const captureEnabled = await getHostCaptureToggle(hostname);
    
    logger.log(`Whitelist check for ${url}: pattern match=${isPatternMatch}, host toggle=${captureEnabled}`);
    return captureEnabled;
  } catch (error) {
    logger.error('Error checking whitelist:', error);
    return false;
  }
}

async function getWhitelistPatterns(): Promise<WhitelistPattern[]> {
  // Hardcoded whitelist patterns
  const patterns: WhitelistPattern[] = [
    { pattern: 'https://www.midjourney.com/imagine*' },
    { pattern: 'https://*.midjourney.com/*' },
  ];
  logger.log('Using hardcoded whitelist patterns');
  return patterns;
}

function matchesPattern(url: string, pattern: string): boolean {
  try {
    // Convert wildcard pattern to regex
    // Escape special regex characters except *
    const escapedPattern = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    // Replace * with .*
    const regexPattern = escapedPattern.replace(/\\\*/g, '.*');
    // Anchor the pattern
    const regex = new RegExp(`^${regexPattern}$`, 'i');
    
    return regex.test(url);
  } catch (error) {
    logger.error('Error matching pattern:', pattern, error);
    return false;
  }
}

// Remove caching functions as they are no longer needed with hardcoded whitelist
// async function getCachedWhitelist(): Promise<WhitelistCache | null> {
//   try {
//     const result = await chrome.storage.session.get([
//       STORAGE_KEYS.WHITELIST_CACHE,
//       STORAGE_KEYS.WHITELIST_CACHE_TIMESTAMP,
//     ]);
// 
//     const patterns = result[STORAGE_KEYS.WHITELIST_CACHE];
//     const timestamp = result[STORAGE_KEYS.WHITELIST_CACHE_TIMESTAMP];
// 
//     if (patterns && timestamp) {
//       return { patterns, timestamp };
//     }
// 
//     return null;
//   } catch (error) {
//     logger.error('Error reading cached whitelist:', error);
//     return null;
//   }
// }
// 
// async function cacheWhitelist(patterns: WhitelistPattern[]): Promise<void> {
//   try {
//     await chrome.storage.session.set({
//       [STORAGE_KEYS.WHITELIST_CACHE]: patterns,
//       [STORAGE_KEYS.WHITELIST_CACHE_TIMESTAMP]: Date.now(),
//     });
// 
//     logger.log('Whitelist patterns cached successfully');
//   } catch (error) {
//     logger.error('Error caching whitelist patterns:', error);
//   }
// }
// 
// function isCacheValid(timestamp: number): boolean {
//   return Date.now() - timestamp < WHITELIST_CACHE_DURATION;
// }

export async function getHostCaptureToggle(hostname: string): Promise<boolean> {
  try {
    const key = `${STORAGE_KEYS.CAPTURE_TOGGLE_PREFIX}${hostname}:captureEnabled`;
    const result = await chrome.storage.sync.get(key);
    
    // Default to true if not set
    return result[key] !== false;
  } catch (error) {
    logger.error('Error getting host capture toggle:', error);
    return true; // Default to enabled
  }
}

export async function setHostCaptureToggle(hostname: string, enabled: boolean): Promise<void> {
  try {
    const key = `${STORAGE_KEYS.CAPTURE_TOGGLE_PREFIX}${hostname}:captureEnabled`;
    await chrome.storage.sync.set({ [key]: enabled });
    
    logger.log(`Set capture toggle for ${hostname}: ${enabled}`);
  } catch (error) {
    logger.error('Error setting host capture toggle:', error);
    throw error;
  }
}