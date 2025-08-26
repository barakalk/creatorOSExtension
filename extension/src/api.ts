import { API_BASE, REQUEST_TIMEOUT, DEMO_MODE } from './config';
import { CaptureDomPayload, CaptureResponse } from './types/global';
import { logger } from './utils/logger';

function simpleHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}

export async function postCaptureDom(payload: CaptureDomPayload): Promise<CaptureResponse> {
  if (DEMO_MODE) {
    const mock: CaptureResponse = {
      id: `demo-${Date.now()}`,
      domHash: simpleHash(`${payload.url}|${payload.domHtml.length}`),
    } as any;
    logger.log('[DEMO] Pretending to post DOM capture:', { url: payload.url, size: payload.domHtml.length });
    return Promise.resolve(mock);
  }

  const url = `${API_BASE}/api/capture/dom`;
  
  logger.log('Posting DOM capture:', {
    url: payload.url,
    domSize: payload.domHtml.length,
    meta: payload.meta,
  });
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    const result: CaptureResponse = await response.json();
    
    if (!result.id || !result.domHash) {
      throw new Error('Invalid response: missing id or domHash');
    }
    
    logger.log('DOM capture successful:', result);
    return result;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timed out');
    }
    
    logger.error('Failed to post DOM capture:', error);
    throw error;
  }
}

export async function triggerParse(captureId: string): Promise<void> {
  if (DEMO_MODE) {
    logger.log('[DEMO] Pretending to trigger parse for capture:', captureId);
    return Promise.resolve();
  }

  const url = `${API_BASE}/api/parse/${captureId}`;
  
  logger.log('Triggering parse for capture:', captureId);
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    logger.log('Parse trigger successful for capture:', captureId);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timed out');
    }
    
    logger.error('Failed to trigger parse:', error);
    throw error;
  }
}