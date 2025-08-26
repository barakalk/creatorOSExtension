import { M as MAX_DOM_BYTES, i as isWhitelisted } from "./whitelist.js";
import { l as logger } from "./logger.js";
import { s as sendMessage } from "./messages.js";
const UNSAFE_TAGS = ["script", "style", "noscript", "iframe"];
const UNSAFE_LINK_RELS = ["preload", "prefetch"];
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
let captureAttempted = false;
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
    if (response == null ? void 0 : response.ok) {
      logger.log("DOM capture successful:", response.captureId);
    } else {
      logger.error("DOM capture failed:", response == null ? void 0 : response.error);
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
//# sourceMappingURL=content.js.map
