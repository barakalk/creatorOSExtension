const logger = require('../../utils/logger');

/**
 * Abstract base class for platform-specific parsers
 */
class BasePlatformParser {
  constructor(platformName) {
    this.platformName = platformName;
    this.idCounter = 1;
  }

  /**
   * Parse HTML content - must be implemented by subclasses
   * @param {CheerioAPI} $ - Cheerio instance
   * @param {string} htmlContent - Raw HTML content
   * @returns {Array} Array of parsed data objects
   */
  parse($, htmlContent) {
    throw new Error(`Parse method must be implemented by ${this.platformName} parser`);
  }

  /**
   * Detect if this parser can handle the given HTML content
   * @param {string} htmlContent - Raw HTML content
   * @returns {boolean} True if this parser can handle the content
   */
  canParse(htmlContent) {
    throw new Error(`canParse method must be implemented by ${this.platformName} parser`);
  }

  /**
   * Get platform-specific confidence score (0-1)
   * @param {string} htmlContent - Raw HTML content
   * @returns {number} Confidence score
   */
  getConfidenceScore(htmlContent) {
    return this.canParse(htmlContent) ? 1.0 : 0.0;
  }

  /**
   * Extract common data structure
   * @param {Object} rawData - Platform-specific raw data
   * @returns {Object} Standardized data object
   */
  createStandardizedOutput(rawData) {
    return {
      id: this.idCounter++,
      prompt: {
        text: rawData.prompt || 'No prompt found',
        type: rawData.promptType || 'generate',
        category: rawData.category || 'image',
        tokens: this.countTokens(rawData.prompt || '')
      },
      asset: {
        url: rawData.assetUrl || '',
        type: rawData.assetType || 'image',
        jobId: rawData.jobId || null,
        resolution: rawData.resolution || 'standard',
        isUpscaled: rawData.isUpscaled || false,
        isVariation: rawData.isVariation || false
      },
      metadata: {
        username: rawData.username || null,
        version: rawData.version || null,
        aspectRatio: rawData.aspectRatio || null,
        duration: rawData.duration || null,
        estimatedTimestamp: rawData.timestamp || null,
        model: rawData.model || null,
        platform: this.platformName,
        settings: rawData.settings || {}
      }
    };
  }

  /**
   * Count tokens in text (simple word count approximation)
   * @param {string} text - Text to count
   * @returns {number} Token count
   */
  countTokens(text) {
    if (!text || typeof text !== 'string') return 0;
    return text.trim().split(/\s+/).length;
  }

  /**
   * Extract job/generation ID from URL
   * @param {string} url - Asset URL
   * @returns {string|null} Job ID
   */
  extractJobId(url) {
    // Default UUID pattern - can be overridden by subclasses
    const uuidMatch = url.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
    return uuidMatch ? uuidMatch[1] : null;
  }

  /**
   * Determine asset type from URL or element
   * @param {string} url - Asset URL
   * @param {Cheerio} element - Media element
   * @returns {string} Asset type (image/video)
   */
  determineAssetType(url, element = null) {
    if (element && element.is('video')) return 'video';
    if (url.match(/\.(mp4|webm|mov|avi|mkv)(\?|$)/i)) return 'video';
    return 'image';
  }

  /**
   * Analyze resolution from URL or metadata
   * @param {string} url - Asset URL
   * @param {Object} metadata - Additional metadata
   * @returns {string} Resolution category
   */
  analyzeResolution(url, metadata = {}) {
    if (url.includes('4k') || url.includes('2160') || metadata.height >= 2160) return '4k';
    if (url.includes('1080') || metadata.height >= 1080) return 'hd';
    if (url.includes('720') || metadata.height >= 720) return 'hd-ready';
    return 'standard';
  }

  /**
   * Clean and normalize prompt text
   * @param {string} text - Raw prompt text
   * @returns {string} Cleaned prompt text
   */
  cleanPromptText(text) {
    if (!text) return '';
    return text
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/^["']|["']$/g, '') // Remove quotes
      .substring(0, 2000); // Limit length
  }

  /**
   * Extract timestamp from various formats
   * @param {string|Date} timestamp - Timestamp in various formats
   * @returns {string|null} ISO timestamp or null
   */
  normalizeTimestamp(timestamp) {
    if (!timestamp) return null;
    try {
      const date = new Date(timestamp);
      return date.toISOString();
    } catch (error) {
      logger.warn(`Failed to parse timestamp: ${timestamp}`);
      return null;
    }
  }

  /**
   * Log parsing results
   * @param {Array} results - Parsed results
   */
  logResults(results) {
    logger.info(`${this.platformName} parser: Found ${results.length} items`);
  }
}

module.exports = BasePlatformParser;
