"use strict";
(() => {
  // src/config.ts
  var MAX_DOM_BYTES = 15e5;
  var DEBUG = true;
  var WHITELIST_CACHE_DURATION = 10 * 60 * 1e3;
  var STORAGE_KEYS = {
    WHITELIST_CACHE: "whitelist_cache",
    WHITELIST_CACHE_TIMESTAMP: "whitelist_cache_timestamp",
    CAPTURE_TOGGLE_PREFIX: "host:"
    // followed by hostname:captureEnabled
  };

  // src/utils/logger.ts
  var LOG_PREFIX = "[Creator OS Capture]";
  var logger = {
    log(...args) {
      if (DEBUG) {
        console.log(LOG_PREFIX, ...args);
      }
    },
    warn(...args) {
      if (DEBUG) {
        console.warn(LOG_PREFIX, ...args);
      }
    },
    error(...args) {
      if (DEBUG) {
        console.error(LOG_PREFIX, ...args);
      }
    },
    info(...args) {
      if (DEBUG) {
        console.info(LOG_PREFIX, ...args);
      }
    },
    debug(...args) {
      if (DEBUG) {
        console.debug(LOG_PREFIX, ...args);
      }
    }
  };

  // src/whitelist.ts
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

  // src/sanitize.ts
  var UNSAFE_TAGS = ["script", "style", "noscript", "iframe"];
  var UNSAFE_LINK_RELS = ["preload", "prefetch"];
  function serializeSanitizedDom(doc) {
    const startTime = performance.now();
    try {
      const clonedDoc = doc.cloneNode(true);
      UNSAFE_TAGS.forEach((tagName) => {
        const elements = clonedDoc.getElementsByTagName(tagName);
        Array.from(elements).forEach((element) => element.remove());
      });
      const links = clonedDoc.getElementsByTagName("link");
      Array.from(links).forEach((link) => {
        const rel = link.getAttribute("rel");
        if (rel && UNSAFE_LINK_RELS.includes(rel)) {
          link.remove();
        }
      });
      const allElements = clonedDoc.getElementsByTagName("*");
      Array.from(allElements).forEach((element) => {
        Array.from(element.attributes).forEach((attr) => {
          if (attr.name.startsWith("on")) {
            element.removeAttribute(attr.name);
          }
        });
        if (element instanceof HTMLInputElement) {
          element.value = "";
          element.removeAttribute("value");
        } else if (element instanceof HTMLTextAreaElement) {
          element.value = "";
          element.textContent = "";
        } else if (element instanceof HTMLSelectElement) {
          element.selectedIndex = -1;
          Array.from(element.options).forEach((option) => {
            option.selected = false;
            option.removeAttribute("selected");
          });
        }
        if (element instanceof HTMLImageElement && element.src) {
          try {
            const absoluteUrl = new URL(element.src, doc.baseURI).href;
            element.src = absoluteUrl;
          } catch (e) {
            logger.warn("Failed to convert image URL to absolute:", element.src, e);
          }
        }
      });
      const serializer = new XMLSerializer();
      let htmlString = "<!doctype html>\n" + serializer.serializeToString(clonedDoc.documentElement);
      if (htmlString.length > MAX_DOM_BYTES) {
        htmlString = htmlString.substring(0, MAX_DOM_BYTES - "<!--TRUNCATED-->".length) + "<!--TRUNCATED-->";
      }
      const duration = performance.now() - startTime;
      logger.log(`DOM serialization completed in ${duration.toFixed(2)}ms, size: ${htmlString.length} bytes`);
      return htmlString;
    } catch (error) {
      logger.error("Error during DOM serialization:", error);
      throw new Error(`Failed to serialize DOM: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  // src/messages.ts
  function sendMessage(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }

  // src/content.ts
  var captureAttempted = false;
  if (document.readyState === "loading") {
    captureAttempted = false;
  }
  logger.log("Content script initialized", {
    url: window.location.href,
    readyState: document.readyState,
    captureAttempted
  });
  async function attemptCapture(forced = false) {
    if (captureAttempted && !forced) {
      logger.log("Capture already attempted for this navigation, skipping");
      return;
    }
    if (!forced) {
      captureAttempted = true;
    }
    try {
      const url = window.location.href;
      const whitelisted = await isWhitelisted(url);
      if (!whitelisted) {
        logger.log("URL not whitelisted, skipping capture");
        return;
      }
      logger.log("Starting DOM capture for:", url);
      const domHtml = serializeSanitizedDom(document);
      const meta = {
        title: document.title,
        userAgent: navigator.userAgent,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        },
        timestamp: Date.now()
      };
      const response = await sendMessage({
        type: "CAPTURE_DOM",
        payload: {
          url,
          domHtml,
          meta
        }
      });
      if (response?.ok) {
        logger.log("DOM capture successful:", response.captureId);
      } else {
        logger.error("DOM capture failed:", response?.error);
      }
    } catch (error) {
      logger.error("Error during capture attempt:", error);
    }
  }
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    logger.log("Content script received message:", message.type);
    if (message.type === "CAPTURE_REQUEST") {
      attemptCapture(true).then(() => sendResponse({ success: true })).catch((error) => {
        logger.error("Manual capture failed:", error);
        sendResponse({ success: false, error: error.message });
      });
      return true;
    }
  });
  if (document.readyState === "complete") {
    attemptCapture();
  } else {
    if (document.readyState === "interactive") {
      attemptCapture();
    } else {
      document.addEventListener("DOMContentLoaded", () => {
        attemptCapture();
      });
    }
  }
})();
//# sourceMappingURL=content.js.map
