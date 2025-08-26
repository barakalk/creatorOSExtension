import { CaptureDomPayload } from './types/global';

export type Msg =
  | { type: 'CAPTURE_REQUEST'; url: string }
  | { type: 'CAPTURE_DOM'; payload: CaptureDomPayload }
  | { type: 'CAPTURE_RESULT'; ok: boolean; captureId?: string; error?: string }
  | { type: 'TOGGLE_CAPTURE'; hostname: string; enabled: boolean }
  | { type: 'GET_TOGGLE'; hostname: string }
  | { type: 'GET_TOGGLE_RESPONSE'; hostname: string; enabled: boolean };

// Helper functions for message handling
export function sendMessage<T extends Msg>(message: T): Promise<any> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

export function sendMessageToTab<T extends Msg>(tabId: number, message: T): Promise<any> {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}