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
  }

  private getElements(): PopupElements {
    const get = (id: string) => document.getElementById(id);
    
    return {
      hostname: get('hostname')!,
      captureToggle: get('capture-toggle') as HTMLInputElement,
      toggleStatus: get('toggle-status')!,
      captureNowButton: get('capture-now') as HTMLButtonElement,
      captureNowText: get('capture-now-text')!,
      status: get('status')!,
    };
  }

  private setupEventListeners(): void {
    this.elements.captureToggle.addEventListener('change', () => {
      this.handleToggleChange();
    });

    this.elements.captureNowButton.addEventListener('click', () => {
      this.handleCaptureNow();
    });
  }

  private async initialize(): Promise<void> {
    try {
      // Get current active tab
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentTab = tabs[0];
      
      if (!currentTab || !currentTab.url) {
        this.showError('No active tab found');
        return;
      }

      this.currentTabId = currentTab.id;
      const url = new URL(currentTab.url);
      this.currentHostname = url.hostname;

      // Update hostname display
      this.elements.hostname.textContent = this.currentHostname;

      // Get current toggle state
      await this.updateToggleState();
    } catch (error) {
      logger.error('Failed to initialize popup:', error);
      this.showError('Failed to initialize popup');
    }
  }

  private async updateToggleState(): Promise<void> {
    try {
      const response = await sendMessage({
        type: 'GET_TOGGLE',
        hostname: this.currentHostname,
      });

      const enabled = response?.enabled ?? true;
      this.elements.captureToggle.checked = enabled;
      this.elements.toggleStatus.textContent = enabled ? 'On' : 'Off';
    } catch (error) {
      logger.error('Failed to get toggle state:', error);
      // Default to enabled
      this.elements.captureToggle.checked = true;
      this.elements.toggleStatus.textContent = 'On';
    }
  }

  private async handleToggleChange(): Promise<void> {
    const enabled = this.elements.captureToggle.checked;
    
    try {
      await sendMessage({
        type: 'TOGGLE_CAPTURE',
        hostname: this.currentHostname,
        enabled,
      });

      this.elements.toggleStatus.textContent = enabled ? 'On' : 'Off';
      
      this.showSuccess(
        `Capture ${enabled ? 'enabled' : 'disabled'} for ${this.currentHostname}`
      );
    } catch (error) {
      logger.error('Failed to toggle capture:', error);
      
      // Revert toggle state
      this.elements.captureToggle.checked = !enabled;
      this.elements.toggleStatus.textContent = !enabled ? 'On' : 'Off';
      
      this.showError('Failed to update capture setting');
    }
  }

  private async handleCaptureNow(): Promise<void> {
    if (!this.currentTabId) {
      this.showError('No active tab');
      return;
    }

    try {
      this.setCapturing(true);
      
      let response;
      try {
        response = await sendMessageToTab(this.currentTabId, {
          type: 'CAPTURE_REQUEST',
          url: '', // Content script will use current URL
        });
      } catch (err: any) {
        const msg = String(err?.message || '');
        if (msg.includes('Receiving end does not exist') || msg.includes('Could not establish connection')) {
          // Inject the module content script via dynamic import and retry once
          await chrome.scripting.executeScript({
            target: { tabId: this.currentTabId },
            func: (url: string) => {
              // import() executes the module which runs the content script
              return import(url);
            },
            args: [chrome.runtime.getURL('content.js')],
            world: 'ISOLATED',
          } as any);
          response = await sendMessageToTab(this.currentTabId, {
            type: 'CAPTURE_REQUEST',
            url: '',
          });
        } else {
          throw err;
        }
      }

      if (response?.success) {
        this.showSuccess('Capture initiated successfully');
      } else {
        this.showError(response?.error || 'Capture failed');
      }
    } catch (error) {
      logger.error('Manual capture failed:', error);
      this.showError('Failed to initiate capture');
    } finally {
      this.setCapturing(false);
    }
  }

  private setCapturing(capturing: boolean): void {
    this.elements.captureNowButton.disabled = capturing;
    
    if (capturing) {
      this.elements.captureNowText.textContent = 'Capturing';
      this.elements.captureNowText.classList.add('loading-dots');
      this.showStatus('Capturing page content...', 'loading');
    } else {
      this.elements.captureNowText.textContent = 'Capture Now';
      this.elements.captureNowText.classList.remove('loading-dots');
    }
  }

  private showStatus(message: string, type: 'success' | 'error' | 'loading'): void {
    this.elements.status.className = `status status-${type}`;
    this.elements.status.textContent = message;
    this.elements.status.classList.remove('hidden');

    if (type !== 'loading') {
      // Auto-hide after 3 seconds
      setTimeout(() => {
        this.elements.status.classList.add('hidden');
      }, 3000);
    }
  }

  private showSuccess(message: string): void {
    this.showStatus(message, 'success');
  }

  private showError(message: string): void {
    this.showStatus(message, 'error');
  }
}

// Initialize popup when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new PopupController());
} else {
  new PopupController();
}