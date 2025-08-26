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
const DB_NAME = "creator_os_captures";
const DB_VERSION = 1;
const STORE_DATA = "captures";
const STORE_META = "metadata";
function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_DATA)) {
        db.createObjectStore(STORE_DATA, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        const meta = db.createObjectStore(STORE_META, { keyPath: "id" });
        meta.createIndex("timestamp", "timestamp");
        meta.createIndex("url", "url");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function saveCaptureToDb(id, domHtml, meta) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_DATA, STORE_META], "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE_DATA).put({ id, domHtml });
    tx.objectStore(STORE_META).put(meta);
  });
}
async function listCaptures(limit = 100) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_META, "readonly");
    const store = tx.objectStore(STORE_META);
    const index = store.index("timestamp");
    const results = [];
    const cursorReq = index.openCursor(void 0, "prev");
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (cursor && results.length < limit) {
        results.push(cursor.value);
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    cursorReq.onerror = () => reject(cursorReq.error);
  });
}
async function getCaptureHtml(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_DATA, "readonly");
    const store = tx.objectStore(STORE_DATA);
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result ? req.result.domHtml : null);
    req.onerror = () => reject(req.error);
  });
}
async function deleteCapture(id) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_DATA, STORE_META], "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE_DATA).delete(id);
    tx.objectStore(STORE_META).delete(id);
  });
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
    case "LIST_CAPTURES":
      listCaptures().then((items) => sendResponse({ ok: true, items })).catch((e) => sendResponse({ ok: false, error: String(e) }));
      return true;
    case "GET_CAPTURE_HTML":
      getCaptureHtml(message.id).then((html) => sendResponse({ ok: true, html })).catch((e) => sendResponse({ ok: false, error: String(e) }));
      return true;
    case "DELETE_CAPTURE":
      deleteCapture(message.id).then(() => sendResponse({ ok: true })).catch((e) => sendResponse({ ok: false, error: String(e) }));
      return true;
    default:
      logger.warn("Unknown message type:", message.type);
      sendResponse({ error: "Unknown message type" });
  }
});
async function handleCaptureDom(payload, sendResponse) {
  var _a, _b;
  try {
    logger.log("Processing DOM capture request:", {
      url: payload.url,
      domSize: payload.domHtml.length
    });
    const captureId = `cap_${Date.now()}`;
    await saveCaptureToDb(captureId, payload.domHtml, {
      id: captureId,
      url: payload.url,
      timestamp: ((_a = payload.meta) == null ? void 0 : _a.timestamp) ?? Date.now(),
      title: (_b = payload.meta) == null ? void 0 : _b.title,
      sizeBytes: payload.domHtml.length
    });
    try {
      const blob = new Blob([payload.domHtml], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      await chrome.downloads.download({ url, filename: `creator-os/${captureId}.html` });
    } catch (e) {
      logger.warn("Download backup failed or was blocked:", e);
    }
    const captureResult = await postCaptureDom(payload);
    await triggerParse(captureResult.id);
    sendResponse({ type: "CAPTURE_RESULT", ok: true, captureId: captureResult.id, storedId: captureId });
    logger.log("Capture stored and processed:", { storedId: captureId, captureId: captureResult.id });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logger.error("Capture processing failed:", error);
    sendResponse({ type: "CAPTURE_RESULT", ok: false, error: errorMessage });
  }
}
async function handleGetToggle(hostname, sendResponse) {
  try {
    const enabled = await getHostCaptureToggle(hostname);
    sendResponse({ type: "GET_TOGGLE_RESPONSE", hostname, enabled });
  } catch (error) {
    logger.error("Failed to get toggle state:", error);
    sendResponse({ type: "GET_TOGGLE_RESPONSE", hostname, enabled: true });
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
