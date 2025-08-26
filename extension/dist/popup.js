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
    this.refreshSavedList();
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
    this.elements.captureToggle.addEventListener("change", () => this.handleToggleChange());
    this.elements.captureNowButton.addEventListener("click", () => this.handleCaptureNow());
    document.getElementById("refresh-list").addEventListener("click", () => this.refreshSavedList());
  }
  async initialize() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentTab = tabs[0];
      if (!currentTab || !currentTab.url) return;
      this.currentTabId = currentTab.id;
      const url = new URL(currentTab.url);
      this.currentHostname = url.hostname;
      this.elements.hostname.textContent = this.currentHostname;
      await this.updateToggleState();
    } catch (error) {
      logger.error("Failed to initialize popup:", error);
    }
  }
  async refreshSavedList() {
    try {
      const res = await sendMessage({ type: "LIST_CAPTURES" });
      const list = (res == null ? void 0 : res.items) ?? [];
      const container = document.getElementById("captures");
      container.innerHTML = "";
      list.forEach((item) => {
        const row = document.createElement("div");
        row.className = "item";
        const left = document.createElement("div");
        left.innerHTML = `<div>${item.title || item.url}</div><div class="muted">${new Date(item.timestamp).toLocaleString()} · ${(item.sizeBytes / 1024).toFixed(1)} KB</div>`;
        const right = document.createElement("div");
        const openBtn = document.createElement("button");
        openBtn.className = "button button-link";
        openBtn.textContent = "Open";
        openBtn.onclick = async () => {
          const r = await sendMessage({ type: "GET_CAPTURE_HTML", id: item.id });
          if ((r == null ? void 0 : r.ok) && r.html) {
            const blob = new Blob([r.html], { type: "text/html" });
            const url = URL.createObjectURL(blob);
            chrome.tabs.create({ url });
          }
        };
        const delBtn = document.createElement("button");
        delBtn.className = "button button-link";
        delBtn.textContent = "Delete";
        delBtn.onclick = async () => {
          await sendMessage({ type: "DELETE_CAPTURE", id: item.id });
          this.refreshSavedList();
        };
        right.append(openBtn, delBtn);
        row.append(left, right);
        container.appendChild(row);
      });
    } catch (e) {
      logger.error("Failed to list captures", e);
    }
  }
  async updateToggleState() {
    try {
      const response = await sendMessage({ type: "GET_TOGGLE", hostname: this.currentHostname });
      const enabled = (response == null ? void 0 : response.enabled) ?? true;
      this.elements.captureToggle.checked = enabled;
      this.elements.toggleStatus.textContent = enabled ? "On" : "Off";
    } catch {
      this.elements.captureToggle.checked = true;
      this.elements.toggleStatus.textContent = "On";
    }
  }
  async handleToggleChange() {
    const enabled = this.elements.captureToggle.checked;
    try {
      await sendMessage({ type: "TOGGLE_CAPTURE", hostname: this.currentHostname, enabled });
      this.elements.toggleStatus.textContent = enabled ? "On" : "Off";
    } catch {
      this.elements.captureToggle.checked = !enabled;
      this.elements.toggleStatus.textContent = !enabled ? "On" : "Off";
    }
  }
  async handleCaptureNow() {
    if (!this.currentTabId) return;
    try {
      this.setCapturing(true);
      let response;
      try {
        response = await sendMessageToTab(this.currentTabId, { type: "CAPTURE_REQUEST", url: "" });
      } catch (err) {
        const msg = String((err == null ? void 0 : err.message) || "");
        if (msg.includes("Receiving end does not exist") || msg.includes("Could not establish connection")) {
          await chrome.scripting.executeScript({ target: { tabId: this.currentTabId }, files: ["content.js"] });
          response = await sendMessageToTab(this.currentTabId, { type: "CAPTURE_REQUEST", url: "" });
        } else throw err;
      }
      if (response == null ? void 0 : response.success) this.showStatus("Capture initiated successfully");
      else this.showStatus((response == null ? void 0 : response.error) || "Capture failed");
    } catch (error) {
      logger.error("Manual capture failed:", error);
      this.showStatus("Failed to initiate capture");
    } finally {
      this.setCapturing(false);
      this.refreshSavedList();
    }
  }
  setCapturing(capturing) {
    this.elements.captureNowButton.disabled = capturing;
    this.elements.captureNowText.textContent = capturing ? "Capturing" : "Capture Now";
  }
  showStatus(message) {
    this.elements.status.textContent = message;
  }
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => new PopupController());
} else {
  new PopupController();
}
//# sourceMappingURL=popup.js.map
