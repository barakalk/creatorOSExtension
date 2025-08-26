import { sendMessage, sendMessageToTab } from '../messages';
import { logger } from '../utils/logger';

interface PopupElements {
  hostname: HTMLElement;
  captureToggle: HTMLInputElement;
  toggleStatus: HTMLElement;
  captureNowButton: HTMLButtonElement;
  captureNowText: HTMLElement;
  status: HTMLElement;
}

class PopupController {
  private elements: PopupElements;
  private currentHostname: string = '';
  private currentTabId: number | undefined;

  constructor() {
    this.elements = this.getElements();
    this.setupEventListeners();
    this.initialize();
    this.refreshSavedList();
  }

  private getElements(): PopupElements {
    const get = (id: string) => document.getElementById(id)!;
    return {
      hostname: get('hostname'),
      captureToggle: get('capture-toggle') as HTMLInputElement,
      toggleStatus: get('toggle-status'),
      captureNowButton: get('capture-now') as HTMLButtonElement,
      captureNowText: get('capture-now-text') as HTMLElement,
      status: get('status'),
    };
  }

  private setupEventListeners(): void {
    this.elements.captureToggle.addEventListener('change', () => this.handleToggleChange());
    this.elements.captureNowButton.addEventListener('click', () => this.handleCaptureNow());
    document.getElementById('refresh-list')!.addEventListener('click', () => this.refreshSavedList());
  }

  private async initialize(): Promise<void> {
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
      logger.error('Failed to initialize popup:', error);
    }
  }

  private async refreshSavedList(): Promise<void> {
    try {
      const res = await sendMessage({ type: 'LIST_CAPTURES' } as any);
      const list: Array<{ id: string; url: string; timestamp: number; sizeBytes: number; title?: string }> = res?.items ?? [];
      const container = document.getElementById('captures')!;
      container.innerHTML = '';
      list.forEach((item) => {
        const row = document.createElement('div');
        row.className = 'item';
        const left = document.createElement('div');
        left.innerHTML = `<div>${item.title || item.url}</div><div class="muted">${new Date(item.timestamp).toLocaleString()} · ${(item.sizeBytes/1024).toFixed(1)} KB</div>`;
        const right = document.createElement('div');
        const openBtn = document.createElement('button');
        openBtn.className = 'button button-link';
        openBtn.textContent = 'Open';
        openBtn.onclick = async () => {
          const r = await sendMessage({ type: 'GET_CAPTURE_HTML', id: item.id } as any);
          if (r?.ok && r.html) {
            const blob = new Blob([r.html], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            chrome.tabs.create({ url });
          }
        };
        const delBtn = document.createElement('button');
        delBtn.className = 'button button-link';
        delBtn.textContent = 'Delete';
        delBtn.onclick = async () => {
          await sendMessage({ type: 'DELETE_CAPTURE', id: item.id } as any);
          this.refreshSavedList();
        };
        right.append(openBtn, delBtn);
        row.append(left, right);
        container.appendChild(row);
      });
    } catch (e) {
      logger.error('Failed to list captures', e);
    }
  }

  private async updateToggleState(): Promise<void> {
    try {
      const response = await sendMessage({ type: 'GET_TOGGLE', hostname: this.currentHostname } as any);
      const enabled = response?.enabled ?? true;
      this.elements.captureToggle.checked = enabled;
      this.elements.toggleStatus.textContent = enabled ? 'On' : 'Off';
    } catch {
      this.elements.captureToggle.checked = true;
      this.elements.toggleStatus.textContent = 'On';
    }
  }

  private async handleToggleChange(): Promise<void> {
    const enabled = this.elements.captureToggle.checked;
    try {
      await sendMessage({ type: 'TOGGLE_CAPTURE', hostname: this.currentHostname, enabled } as any);
      this.elements.toggleStatus.textContent = enabled ? 'On' : 'Off';
    } catch {
      this.elements.captureToggle.checked = !enabled;
      this.elements.toggleStatus.textContent = !enabled ? 'On' : 'Off';
    }
  }

  private async handleCaptureNow(): Promise<void> {
    if (!this.currentTabId) return;
    try {
      this.setCapturing(true);
      let response;
      try {
        response = await sendMessageToTab(this.currentTabId, { type: 'CAPTURE_REQUEST', url: '' } as any);
      } catch (err: any) {
        const msg = String(err?.message || '');
        if (msg.includes('Receiving end does not exist') || msg.includes('Could not establish connection')) {
          await chrome.scripting.executeScript({ target: { tabId: this.currentTabId }, files: ['content.js'] });
          response = await sendMessageToTab(this.currentTabId, { type: 'CAPTURE_REQUEST', url: '' } as any);
        } else throw err;
      }
      if (response?.success) this.showStatus('Capture initiated successfully');
      else this.showStatus(response?.error || 'Capture failed');
    } catch (error) {
      logger.error('Manual capture failed:', error);
      this.showStatus('Failed to initiate capture');
    } finally {
      this.setCapturing(false);
      this.refreshSavedList();
    }
  }

  private setCapturing(capturing: boolean): void {
    this.elements.captureNowButton.disabled = capturing;
    this.elements.captureNowText.textContent = capturing ? 'Capturing' : 'Capture Now';
  }

  private showStatus(message: string): void {
    this.elements.status.textContent = message;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new PopupController());
} else {
  new PopupController();
}