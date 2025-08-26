import { Msg } from './messages';
import { postCaptureDom, triggerParse } from './api';
import { getHostCaptureToggle, setHostCaptureToggle } from './whitelist';
import { logger } from './utils/logger';
import { saveCaptureToDb, listCaptures, getCaptureHtml, deleteCapture } from './utils/storage';
import { CaptureMetadata } from './types/global';

logger.log('Background service worker initialized');

chrome.runtime.onMessage.addListener((message: Msg, _sender, sendResponse) => {
  logger.log('Background received message:', (message as any).type);
  
  switch (message.type) {
    case 'CAPTURE_DOM':
      handleCaptureDom(message.payload, sendResponse);
      return true;
    case 'GET_TOGGLE':
      handleGetToggle(message.hostname, sendResponse);
      return true;
    case 'TOGGLE_CAPTURE':
      handleToggleCapture(message.hostname, message.enabled, sendResponse);
      return true;
    case 'LIST_CAPTURES':
      listCaptures().then((items) => sendResponse({ ok: true, items })).catch((e) => sendResponse({ ok: false, error: String(e) }));
      return true;
    case 'GET_CAPTURE_HTML':
      getCaptureHtml(message.id).then((html) => sendResponse({ ok: true, html })).catch((e) => sendResponse({ ok: false, error: String(e) }));
      return true;
    case 'DELETE_CAPTURE':
      deleteCapture(message.id).then(() => sendResponse({ ok: true })).catch((e) => sendResponse({ ok: false, error: String(e) }));
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

    // Persist to IndexedDB with metadata (hybrid approach retains download fallback below)
    const captureId = `cap_${Date.now()}`;
    await saveCaptureToDb(captureId, payload.domHtml, {
      id: captureId,
      url: payload.url,
      timestamp: payload.meta?.timestamp ?? Date.now(),
      title: payload.meta?.title,
      sizeBytes: payload.domHtml.length,
    });

    // Optional: also initiate a download (kept as backup UX)
    try {
      const blob = new Blob([payload.domHtml], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      await chrome.downloads.download({ url, filename: `creator-os/${captureId}.html` });
    } catch (e) {
      logger.warn('Download backup failed or was blocked:', e);
    }

    // Post to backend / demo flow
    const captureResult = await postCaptureDom(payload);
    await triggerParse(captureResult.id);

    sendResponse({ type: 'CAPTURE_RESULT', ok: true, captureId: captureResult.id, storedId: captureId });
    logger.log('Capture stored and processed:', { storedId: captureId, captureId: captureResult.id });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Capture processing failed:', error);
    sendResponse({ type: 'CAPTURE_RESULT', ok: false, error: errorMessage });
  }
}

async function handleGetToggle(hostname: string, sendResponse: (response?: any) => void) {
  try {
    const enabled = await getHostCaptureToggle(hostname);
    sendResponse({ type: 'GET_TOGGLE_RESPONSE', hostname, enabled });
  } catch (error) {
    logger.error('Failed to get toggle state:', error);
    sendResponse({ type: 'GET_TOGGLE_RESPONSE', hostname, enabled: true });
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