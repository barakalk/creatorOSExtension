import { MAX_DOM_BYTES } from './config';
import { logger } from './utils/logger';

const UNSAFE_TAGS = ['script', 'style', 'noscript', 'iframe'] as const;
const UNSAFE_LINK_RELS = ['preload', 'prefetch'] as const;

export function serializeSanitizedDom(doc: Document): string {
  const startTime = performance.now();
  
  try {
    // Clone the document to avoid modifying the original
    const clonedDoc = doc.cloneNode(true) as Document;
    
    // Remove unsafe tags
    UNSAFE_TAGS.forEach(tagName => {
      const elements = clonedDoc.getElementsByTagName(tagName);
      // Convert to array to avoid live collection issues during removal
      Array.from(elements).forEach(element => element.remove());
    });
    
    // Remove unsafe link elements
    const links = clonedDoc.getElementsByTagName('link');
    Array.from(links).forEach(link => {
      const rel = link.getAttribute('rel');
      if (rel && UNSAFE_LINK_RELS.includes(rel as any)) {
        link.remove();
      }
    });
    
    // Remove all on* attributes and clear form values
    const allElements = clonedDoc.getElementsByTagName('*');
    Array.from(allElements).forEach(element => {
      // Remove event handler attributes
      Array.from(element.attributes).forEach(attr => {
        if (attr.name.startsWith('on')) {
          element.removeAttribute(attr.name);
        }
      });
      
      // Clear form values
      if (element instanceof HTMLInputElement) {
        element.value = '';
        element.removeAttribute('value');
      } else if (element instanceof HTMLTextAreaElement) {
        element.value = '';
        element.textContent = '';
      } else if (element instanceof HTMLSelectElement) {
        element.selectedIndex = -1;
        Array.from(element.options).forEach(option => {
          option.selected = false;
          option.removeAttribute('selected');
        });
      }
      
      // Convert relative image URLs to absolute
      if (element instanceof HTMLImageElement && element.src) {
        try {
          const absoluteUrl = new URL(element.src, doc.baseURI).href;
          element.src = absoluteUrl;
        } catch (e) {
          logger.warn('Failed to convert image URL to absolute:', element.src, e);
        }
      }
    });
    
    // Serialize the cleaned document
    const serializer = new XMLSerializer();
    let htmlString = '<!doctype html>\n' + serializer.serializeToString(clonedDoc.documentElement);
    
    // Cap the size and add truncation marker if needed
    if (htmlString.length > MAX_DOM_BYTES) {
      htmlString = htmlString.substring(0, MAX_DOM_BYTES - '<!--TRUNCATED-->'.length) + '<!--TRUNCATED-->';
    }
    
    const duration = performance.now() - startTime;
    logger.log(`DOM serialization completed in ${duration.toFixed(2)}ms, size: ${htmlString.length} bytes`);
    
    return htmlString;
  } catch (error) {
    logger.error('Error during DOM serialization:', error);
    throw new Error(`Failed to serialize DOM: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}