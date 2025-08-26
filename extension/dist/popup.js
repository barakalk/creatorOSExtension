var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { s as sendMessage, a as sendMessageToTab } from "./messages.js";
import { l as logger } from "./logger.js";
(function polyfill() {
  const relList = document.createElement("link").relList;
  if (relList && relList.supports && relList.supports("modulepreload")) {
    return;
  }
  for (const link of document.querySelectorAll('link[rel="modulepreload"]')) {
    processPreload(link);
  }
  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type !== "childList") {
        continue;
      }
      for (const node of mutation.addedNodes) {
        if (node.tagName === "LINK" && node.rel === "modulepreload")
          processPreload(node);
      }
    }
  }).observe(document, { childList: true, subtree: true });
  function getFetchOpts(link) {
    const fetchOpts = {};
    if (link.integrity) fetchOpts.integrity = link.integrity;
    if (link.referrerPolicy) fetchOpts.referrerPolicy = link.referrerPolicy;
    if (link.crossOrigin === "use-credentials")
      fetchOpts.credentials = "include";
    else if (link.crossOrigin === "anonymous") fetchOpts.credentials = "omit";
    else fetchOpts.credentials = "same-origin";
    return fetchOpts;
  }
  function processPreload(link) {
    if (link.ep)
      return;
    link.ep = true;
    const fetchOpts = getFetchOpts(link);
    fetch(link.href, fetchOpts);
  }
})();
class PopupController {
  constructor() {
    __publicField(this, "elements");
    __publicField(this, "currentHostname", "");
    __publicField(this, "currentTabId");
    this.elements = this.getElements();
    this.setupEventListeners();
    this.initialize();
  }
  getElements() {
    const get = (id) => document.getElementById(id);
    return {
      hostname: get("hostname"),
      captureToggle: get("capture-toggle"),
      toggleStatus: get("toggle-status"),
      captureNowButton: get("capture-now"),
      captureNowText: get("capture-now-text"),
      status: get("status")
    };
  }
  setupEventListeners() {
    this.elements.captureToggle.addEventListener("change", () => {
      this.handleToggleChange();
    });
    this.elements.captureNowButton.addEventListener("click", () => {
      this.handleCaptureNow();
    });
  }
  async initialize() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentTab = tabs[0];
      if (!currentTab || !currentTab.url) {
        this.showError("No active tab found");
        return;
      }
      this.currentTabId = currentTab.id;
      const url = new URL(currentTab.url);
      this.currentHostname = url.hostname;
      this.elements.hostname.textContent = this.currentHostname;
      await this.updateToggleState();
    } catch (error) {
      logger.error("Failed to initialize popup:", error);
      this.showError("Failed to initialize popup");
    }
  }
  async updateToggleState() {
    try {
      const response = await sendMessage({
        type: "GET_TOGGLE",
        hostname: this.currentHostname
      });
      const enabled = (response == null ? void 0 : response.enabled) ?? true;
      this.elements.captureToggle.checked = enabled;
      this.elements.toggleStatus.textContent = enabled ? "On" : "Off";
    } catch (error) {
      logger.error("Failed to get toggle state:", error);
      this.elements.captureToggle.checked = true;
      this.elements.toggleStatus.textContent = "On";
    }
  }
  async handleToggleChange() {
    const enabled = this.elements.captureToggle.checked;
    try {
      await sendMessage({
        type: "TOGGLE_CAPTURE",
        hostname: this.currentHostname,
        enabled
      });
      this.elements.toggleStatus.textContent = enabled ? "On" : "Off";
      this.showSuccess(
        `Capture ${enabled ? "enabled" : "disabled"} for ${this.currentHostname}`
      );
    } catch (error) {
      logger.error("Failed to toggle capture:", error);
      this.elements.captureToggle.checked = !enabled;
      this.elements.toggleStatus.textContent = !enabled ? "On" : "Off";
      this.showError("Failed to update capture setting");
    }
  }
  async handleCaptureNow() {
    if (!this.currentTabId) {
      this.showError("No active tab");
      return;
    }
    try {
      this.setCapturing(true);
      let response;
      try {
        response = await sendMessageToTab(this.currentTabId, {
          type: "CAPTURE_REQUEST",
          url: ""
          // Content script will use current URL
        });
      } catch (err) {
        const msg = String((err == null ? void 0 : err.message) || "");
        if (msg.includes("Receiving end does not exist") || msg.includes("Could not establish connection")) {
          await chrome.scripting.executeScript({
            target: { tabId: this.currentTabId },
            func: (url) => {
              return import(url);
            },
            args: [chrome.runtime.getURL("content.js")],
            world: "ISOLATED"
          });
          response = await sendMessageToTab(this.currentTabId, {
            type: "CAPTURE_REQUEST",
            url: ""
          });
        } else {
          throw err;
        }
      }
      if (response == null ? void 0 : response.success) {
        this.showSuccess("Capture initiated successfully");
      } else {
        this.showError((response == null ? void 0 : response.error) || "Capture failed");
      }
    } catch (error) {
      logger.error("Manual capture failed:", error);
      this.showError("Failed to initiate capture");
    } finally {
      this.setCapturing(false);
    }
  }
  setCapturing(capturing) {
    this.elements.captureNowButton.disabled = capturing;
    if (capturing) {
      this.elements.captureNowText.textContent = "Capturing";
      this.elements.captureNowText.classList.add("loading-dots");
      this.showStatus("Capturing page content...", "loading");
    } else {
      this.elements.captureNowText.textContent = "Capture Now";
      this.elements.captureNowText.classList.remove("loading-dots");
    }
  }
  showStatus(message, type) {
    this.elements.status.className = `status status-${type}`;
    this.elements.status.textContent = message;
    this.elements.status.classList.remove("hidden");
    if (type !== "loading") {
      setTimeout(() => {
        this.elements.status.classList.add("hidden");
      }, 3e3);
    }
  }
  showSuccess(message) {
    this.showStatus(message, "success");
  }
  showError(message) {
    this.showStatus(message, "error");
  }
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => new PopupController());
} else {
  new PopupController();
}
//# sourceMappingURL=popup.js.map
