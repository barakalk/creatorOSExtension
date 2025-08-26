import { l as logger } from "./logger.js";
import { g as getHostCaptureToggle, s as setHostCaptureToggle } from "./whitelist.js";
function simpleHash(input) {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}
async function postCaptureDom(payload) {
  {
    const mock = {
      id: `demo-${Date.now()}`,
      domHash: simpleHash(`${payload.url}|${payload.domHtml.length}`)
    };
    logger.log("[DEMO] Pretending to post DOM capture:", { url: payload.url, size: payload.domHtml.length });
    return Promise.resolve(mock);
  }
}
async function triggerParse(captureId) {
  {
    logger.log("[DEMO] Pretending to trigger parse for capture:", captureId);
    return Promise.resolve();
  }
}
logger.log("Background service worker initialized");
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  logger.log("Background received message:", message.type);
  switch (message.type) {
    case "CAPTURE_DOM":
      handleCaptureDom(message.payload, sendResponse);
      return true;
    case "GET_TOGGLE":
      handleGetToggle(message.hostname, sendResponse);
      return true;
    case "TOGGLE_CAPTURE":
      handleToggleCapture(message.hostname, message.enabled, sendResponse);
      return true;
    default:
      logger.warn("Unknown message type:", message.type);
      sendResponse({ error: "Unknown message type" });
  }
});
async function handleCaptureDom(payload, sendResponse) {
  try {
    logger.log("Processing DOM capture request:", {
      url: payload.url,
      domSize: payload.domHtml.length
    });
    try {
      const blob = new Blob([payload.domHtml], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      await chrome.downloads.download({
        url,
        filename: "creator-os-dom-dump.html",
        saveAs: true
      });
      logger.log("DOM dump download initiated");
    } catch (e) {
      logger.warn("Could not download DOM dump:", e);
    }
    const captureResult = await postCaptureDom(payload);
    await triggerParse(captureResult.id);
    sendResponse({
      type: "CAPTURE_RESULT",
      ok: true,
      captureId: captureResult.id
    });
    logger.log("Capture and parse completed successfully:", captureResult.id);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logger.error("Capture processing failed:", error);
    sendResponse({
      type: "CAPTURE_RESULT",
      ok: false,
      error: errorMessage
    });
  }
}
async function handleGetToggle(hostname, sendResponse) {
  try {
    const enabled = await getHostCaptureToggle(hostname);
    sendResponse({
      type: "GET_TOGGLE_RESPONSE",
      hostname,
      enabled
    });
  } catch (error) {
    logger.error("Failed to get toggle state:", error);
    sendResponse({
      type: "GET_TOGGLE_RESPONSE",
      hostname,
      enabled: true
      // Default to enabled
    });
  }
}
async function handleToggleCapture(hostname, enabled, sendResponse) {
  try {
    await setHostCaptureToggle(hostname, enabled);
    sendResponse({ success: true });
    logger.log(`Capture toggle updated for ${hostname}: ${enabled}`);
  } catch (error) {
    logger.error("Failed to set toggle state:", error);
    sendResponse({ success: false, error: error instanceof Error ? error.message : "Unknown error" });
  }
}
//# sourceMappingURL=background.js.map
