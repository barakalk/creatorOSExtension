const cheerio = require('cheerio');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

class HTMLParser {
  constructor() {
    this.idCounter = 1;
  }

  /**
   * Parse HTML content and extract Midjourney data
   * @param {string} htmlContent - The HTML content to parse
   * @returns {Array} Array of parsed JSON objects
   */
  parseHTML(htmlContent) {
    try {
      const $ = cheerio.load(htmlContent);
      const results = [];

      // Find all image containers (Midjourney DOM structure)
      const imageContainers = $('div.relative.group, div[style*="aspect-ratio"], a[href*="/jobs/"]').parent();
      
      if (imageContainers.length === 0) {
        // Fallback: look for any img tags with Midjourney URLs
        const midjourneyImages = $('img[src*="cdn.midjourney.com"]');
        midjourneyImages.each((index, element) => {
          const parsedData = this.parseImageElement($, $(element));
          if (parsedData) {
            results.push(parsedData);
          }
        });
      } else {
        imageContainers.each((index, container) => {
          const parsedData = this.parseContainer($, $(container));
          if (parsedData) {
            results.push(parsedData);
          }
        });
      }

      logger.info(`Parsed ${results.length} items from HTML`);
      return results;
    } catch (error) {
      logger.error('Error parsing HTML:', error);
      throw new Error(`HTML parsing failed: ${error.message}`);
    }
  }

  /**
   * Parse a single container element
   * @param {CheerioAPI} $ - Cheerio instance
   * @param {Cheerio} container - Container element
   * @returns {Object|null} Parsed data object
   */
  parseContainer($, container) {
    try {
      // Find image or video element
      const img = container.find('img').first();
      const video = container.find('video').first();
      const mediaElement = img.length ? img : video;

      if (!mediaElement.length) {
        return null;
      }

      const assetUrl = mediaElement.attr('src') || mediaElement.attr('data-src');
      if (!assetUrl || !assetUrl.includes('cdn.midjourney.com')) {
        return null;
      }

      // Extract job ID from URL
      const jobId = this.extractJobId(assetUrl);
      
      // Extract prompt text
      const promptText = this.extractPromptText($, container);
      
      // Extract metadata
      const metadata = this.extractMetadata($, container);
      
      // Determine asset properties
      const assetProps = this.analyzeAsset(assetUrl, mediaElement);

      return {
        id: this.idCounter++,
        prompt: {
          text: promptText,
          type: this.determinePromptType(promptText, container),
          category: assetProps.type,
          tokens: this.countTokens(promptText)
        },
        asset: {
          url: assetUrl,
          type: assetProps.type,
          jobId: jobId,
          resolution: assetProps.resolution,
          isUpscaled: assetProps.isUpscaled,
          isVariation: assetProps.isVariation
        },
        metadata: {
          username: metadata.username,
          version: metadata.version,
          aspectRatio: metadata.aspectRatio,
          duration: metadata.duration,
          estimatedTimestamp: metadata.timestamp,
          model: metadata.model,
          settings: metadata.settings
        }
      };
    } catch (error) {
      logger.warn('Error parsing container:', error);
      return null;
    }
  }

  /**
   * Parse individual image element (fallback method)
   */
  parseImageElement($, img) {
    const container = img.closest('div, article, section').first();
    return this.parseContainer($, container);
  }

  /**
   * Extract job ID from Midjourney URL
   * @param {string} url - Asset URL
   * @returns {string|null} Job ID
   */
  extractJobId(url) {
    const jobIdMatch = url.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
    return jobIdMatch ? jobIdMatch[1] : null;
  }

  /**
   * Extract prompt text from container
   * @param {CheerioAPI} $ - Cheerio instance
   * @param {Cheerio} container - Container element
   * @returns {string} Prompt text
   */
  extractPromptText($, container) {
    // Look for prompt text in various possible locations
    const selectors = [
      'span.relative',
      '[class*="prompt"]',
      'span:contains("--")',
      'p',
      'div[class*="text"]'
    ];

    for (const selector of selectors) {
      const element = container.find(selector).first();
      if (element.length) {
        const text = element.text().trim();
        // Filter out button text and metadata
        if (text && !text.startsWith('--') && text.length > 10) {
          return text;
        }
      }
    }

    // Fallback: look in parent elements
    const parentText = container.parent().find('span, p, div').filter((i, el) => {
      const text = $(el).text().trim();
      return text && !text.startsWith('--') && text.length > 10 && !text.match(/^(upscale|variation|edit|generate)$/i);
    }).first().text().trim();

    return parentText || 'No prompt found';
  }

  /**
   * Extract metadata from container
   * @param {CheerioAPI} $ - Cheerio instance
   * @param {Cheerio} container - Container element
   * @returns {Object} Metadata object
   */
  extractMetadata($, container) {
    const metadata = {
      username: null,
      version: null,
      aspectRatio: null,
      duration: null,
      timestamp: null,
      model: null,
      settings: {
        stylization: 100,
        weirdness: 0,
        variety: 0,
        mode: 'standard'
      }
    };

    // Extract username
    const usernameElement = container.find('.username, [class*="user"], span[title*="user"]').first();
    if (usernameElement.length) {
      metadata.username = usernameElement.text().trim();
    }

    // Extract version from buttons or spans
    const versionElement = container.find('button[title*="Version"], span:contains("--v")').first();
    if (versionElement.length) {
      const versionMatch = versionElement.text().match(/--v\s*(\d+)/);
      if (versionMatch) {
        metadata.version = versionMatch[1];
        metadata.model = `v${versionMatch[1]}`;
      }
    }

    // Extract aspect ratio
    const aspectRatioElement = container.find('button[title*="aspect"], span:contains("--ar")').first();
    if (aspectRatioElement.length) {
      const arMatch = aspectRatioElement.text().match(/--ar\s*([\d:]+)/);
      if (arMatch) {
        metadata.aspectRatio = arMatch[1];
      }
    }

    // Extract other settings
    const settingsElements = container.find('button, span').filter((i, el) => {
      const text = $(el).text();
      return text.includes('--s') || text.includes('--w') || text.includes('--c');
    });

    settingsElements.each((i, el) => {
      const text = $(el).text();
      
      // Stylization
      const styMatch = text.match(/--s\s*(\d+)/);
      if (styMatch) {
        metadata.settings.stylization = parseInt(styMatch[1]);
      }

      // Weirdness
      const weirdMatch = text.match(/--w\s*(\d+)/);
      if (weirdMatch) {
        metadata.settings.weirdness = parseInt(weirdMatch[1]);
      }

      // Chaos/Variety
      const chaosMatch = text.match(/--c\s*(\d+)/);
      if (chaosMatch) {
        metadata.settings.variety = parseInt(chaosMatch[1]);
      }
    });

    return metadata;
  }

  /**
   * Analyze asset properties from URL and element
   * @param {string} url - Asset URL
   * @param {Cheerio} element - Media element
   * @returns {Object} Asset properties
   */
  analyzeAsset(url, element) {
    const isVideo = element.is('video') || url.includes('.mp4') || url.includes('.webm');
    const isUpscaled = url.includes('_0_') || url.includes('upscale') || url.includes('_N.');
    const isVariation = url.includes('_1_') || url.includes('_2_') || url.includes('_3_') || url.includes('variation');
    
    let resolution = 'standard';
    if (isUpscaled) {
      resolution = 'upscaled';
    } else if (url.includes('640_')) {
      resolution = 'medium';
    } else if (url.includes('1024_') || url.includes('2048_')) {
      resolution = 'high';
    }

    return {
      type: isVideo ? 'video' : 'image',
      resolution,
      isUpscaled,
      isVariation
    };
  }

  /**
   * Determine prompt type based on content and context
   * @param {string} promptText - Prompt text
   * @param {Cheerio} container - Container element
   * @returns {string} Prompt type
   */
  determinePromptType(promptText, container) {
    const text = promptText.toLowerCase();
    
    if (text.includes('upscale') || container.find('*:contains("Upscale")').length) {
      return 'upscale';
    }
    if (text.includes('variation') || container.find('*:contains("Variation")').length) {
      return 'variation';
    }
    if (text.includes('edit') || container.find('*:contains("Edit")').length) {
      return 'edit';
    }
    
    return 'generate';
  }

  /**
   * Count tokens in prompt text (simple word count approximation)
   * @param {string} text - Text to count tokens for
   * @returns {number} Token count
   */
  countTokens(text) {
    if (!text || typeof text !== 'string') return 0;
    return text.trim().split(/\s+/).length;
  }
}

module.exports = HTMLParser;
