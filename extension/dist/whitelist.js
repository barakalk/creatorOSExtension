import { l as logger } from "./logger.js";
const MAX_DOM_BYTES = 15e5;
const STORAGE_KEYS = {
  WHITELIST_CACHE: "whitelist_cache",
  WHITELIST_CACHE_TIMESTAMP: "whitelist_cache_timestamp",
  CAPTURE_TOGGLE_PREFIX: "host:"
  // followed by hostname:captureEnabled
};
async function isWhitelisted(url) {
  try {
    const patterns = await getWhitelistPatterns();
    const hostname = new URL(url).hostname;
    const isPatternMatch = patterns.some((pattern) => matchesPattern(url, pattern.pattern));
    if (!isPatternMatch) {
      logger.log(`URL not in whitelist patterns: ${url}`);
      return false;
    }
    const captureEnabled = await getHostCaptureToggle(hostname);
    logger.log(`Whitelist check for ${url}: pattern match=${isPatternMatch}, host toggle=${captureEnabled}`);
    return captureEnabled;
  } catch (error) {
    logger.error("Error checking whitelist:", error);
    return false;
  }
}
async function getWhitelistPatterns() {
  const patterns = [
    { pattern: "https://www.midjourney.com/imagine*" },
    { pattern: "https://*.midjourney.com/*" }
  ];
  logger.log("Using hardcoded whitelist patterns");
  return patterns;
}
function matchesPattern(url, pattern) {
  try {
    const escapedPattern = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
    const regexPattern = escapedPattern.replace(/\\\*/g, ".*");
    const regex = new RegExp(`^${regexPattern}$`, "i");
    return regex.test(url);
  } catch (error) {
    logger.error("Error matching pattern:", pattern, error);
    return false;
  }
}
async function getHostCaptureToggle(hostname) {
  try {
    const key = `${STORAGE_KEYS.CAPTURE_TOGGLE_PREFIX}${hostname}:captureEnabled`;
    const result = await chrome.storage.sync.get(key);
    return result[key] !== false;
  } catch (error) {
    logger.error("Error getting host capture toggle:", error);
    return true;
  }
}
async function setHostCaptureToggle(hostname, enabled) {
  try {
    const key = `${STORAGE_KEYS.CAPTURE_TOGGLE_PREFIX}${hostname}:captureEnabled`;
    await chrome.storage.sync.set({ [key]: enabled });
    logger.log(`Set capture toggle for ${hostname}: ${enabled}`);
  } catch (error) {
    logger.error("Error setting host capture toggle:", error);
    throw error;
  }
}
export {
  MAX_DOM_BYTES as M,
  getHostCaptureToggle as g,
  isWhitelisted as i,
  setHostCaptureToggle as s
};
//# sourceMappingURL=whitelist.js.map
