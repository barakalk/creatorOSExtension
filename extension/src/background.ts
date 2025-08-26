import { Msg } from './messages';
import { postCaptureDom, triggerParse } from './api';
import { getHostCaptureToggle, setHostCaptureToggle } from './whitelist';
import { logger } from './utils/logger';
import { CaptureMetadata } from './types/global';

logger.log('Background service worker initialized');

chrome.runtime.onMessage.addListener((message: Msg, _sender, sendResponse) => {
  logger.log('Background received message:', message.type);
  
  switch (message.type) {
    case 'CAPTURE_DOM':
      handleCaptureDom(message.payload, sendResponse);
      return true; // Keep message channel open for async response
      
    case 'GET_TOGGLE':
      handleGetToggle(message.hostname, sendResponse);
      return true;
      
    case 'TOGGLE_CAPTURE':
      handleToggleCapture(message.hostname, message.enabled, sendResponse);
      return true;
      
    default:
      logger.warn('Unknown message type:', (message as any).type);
      sendResponse({ error: 'Unknown message type' });
  }
});

async function handleCaptureDom(
  payload: { url: string; domHtml: string; meta?: CaptureMetadata },
  sendResponse: (response?: any) => void
) {
  try {
    logger.log('Processing DOM capture request:', {
      url: payload.url,
      domSize: payload.domHtml.length,
    });

    // Save DOM dump to a file for inspection
    try {
      const blob = new Blob([payload.domHtml], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      await chrome.downloads.download({
        url,
        filename: 'creator-os-dom-dump.html',
        saveAs: true,
      });
      logger.log('DOM dump download initiated');
    } catch (e) {
      logger.warn('Could not download DOM dump:', e);
    }
    
    // Step 1: Post DOM to backend (or demo mock)
    const captureResult = await postCaptureDom(payload);
    
    // Step 2: Trigger parse immediately
    await triggerParse(captureResult.id);
    
    // Send success response
    sendResponse({
      type: 'CAPTURE_RESULT',
      ok: true,
      captureId: captureResult.id,
    });
    
    logger.log('Capture and parse completed successfully:', captureResult.id);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    logger.error('Capture processing failed:', error);
    
    sendResponse({
      type: 'CAPTURE_RESULT',
      ok: false,
      error: errorMessage,
    });
  }
}

async function handleGetToggle(hostname: string, sendResponse: (response?: any) => void) {
  try {
    const enabled = await getHostCaptureToggle(hostname);
    sendResponse({
      type: 'GET_TOGGLE_RESPONSE',
      hostname,
      enabled,
    });
  } catch (error) {
    logger.error('Failed to get toggle state:', error);
    sendResponse({
      type: 'GET_TOGGLE_RESPONSE',
      hostname,
      enabled: true, // Default to enabled
    });
  }
}

async function handleToggleCapture(
  hostname: string,
  enabled: boolean,
  sendResponse: (response?: any) => void
) {
  try {
    await setHostCaptureToggle(hostname, enabled);
    sendResponse({ success: true });
    
    logger.log(`Capture toggle updated for ${hostname}: ${enabled}`);
  } catch (error) {
    logger.error('Failed to set toggle state:', error);
    sendResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
}