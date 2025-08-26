import { isWhitelisted } from './whitelist';
import { serializeSanitizedDom } from './sanitize';
import { sendMessage } from './messages';
import { CaptureMetadata } from './types/global';
import { logger } from './utils/logger';

// Guard to prevent multiple captures per navigation
let captureAttempted = false;

// Reset guard on new navigation
if (document.readyState === 'loading') {
  captureAttempted = false;
}

logger.log('Content script initialized', {
  url: window.location.href,
  readyState: document.readyState,
  captureAttempted,
});

// Main capture logic
async function attemptCapture(forced = false): Promise<void> {
  if (captureAttempted && !forced) {
    logger.log('Capture already attempted for this navigation, skipping');
    return;
  }
  
  if (!forced) {
    captureAttempted = true;
  }
  
  try {
    const url = window.location.href;
    
    // Check if URL is whitelisted
    const whitelisted = await isWhitelisted(url);
    if (!whitelisted) {
      logger.log('URL not whitelisted, skipping capture');
      return;
    }
    
    logger.log('Starting DOM capture for:', url);
    
    // Serialize the DOM
    const domHtml = serializeSanitizedDom(document);
    
    // Collect metadata
    const meta: CaptureMetadata = {
      title: document.title,
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      timestamp: Date.now(),
    };
    
    // Send capture message to background
    const response = await sendMessage({
      type: 'CAPTURE_DOM',
      payload: {
        url,
        domHtml,
        meta,
      },
    });
    
    if (response?.ok) {
      logger.log('DOM capture successful:', response.captureId);
    } else {
      logger.error('DOM capture failed:', response?.error);
    }
  } catch (error) {
    logger.error('Error during capture attempt:', error);
  }
}

// Listen for manual capture requests from popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  logger.log('Content script received message:', message.type);
  
  if (message.type === 'CAPTURE_REQUEST') {
    attemptCapture(true) // Force capture regardless of guard
      .then(() => sendResponse({ success: true }))
      .catch((error) => {
        logger.error('Manual capture failed:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep message channel open for async response
  }
});

// Auto-capture on document idle (if not already attempted)
if (document.readyState === 'complete') {
  // Document already loaded, attempt capture immediately
  attemptCapture();
} else {
  // Wait for document to be ready
  if (document.readyState === 'interactive') {
    // DOM ready but resources may still be loading
    attemptCapture();
  } else {
    // Document still loading, wait for DOMContentLoaded
    document.addEventListener('DOMContentLoaded', () => {
      attemptCapture();
    });
  }
}