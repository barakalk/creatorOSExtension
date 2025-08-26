import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { serializeSanitizedDom } from '../sanitize';

describe('serializeSanitizedDom', () => {
  let dom: JSDOM;
  let document: Document;

  beforeEach(() => {
    dom = new JSDOM();
    document = dom.window.document;
    
    // Mock performance.now for tests
    global.performance = {
      now: () => Date.now(),
    } as any;
  });

  it('should remove unsafe tags (script, style, noscript, iframe)', () => {
    document.body.innerHTML = `
      <div>Safe content</div>
      <script>alert('dangerous')</script>
      <style>.danger { color: red; }</style>
      <noscript>No script content</noscript>
      <iframe src="http://evil.com"></iframe>
      <p>More safe content</p>
    `;

    const result = serializeSanitizedDom(document);

    expect(result).toContain('Safe content');
    expect(result).toContain('More safe content');
    expect(result).not.toContain('alert');
    expect(result).not.toContain('danger { color: red; }');
    expect(result).not.toContain('No script content');
    expect(result).not.toContain('evil.com');
  });

  it('should remove unsafe link elements (preload, prefetch)', () => {
    document.head.innerHTML = `
      <link rel="stylesheet" href="styles.css">
      <link rel="preload" href="evil.js">
      <link rel="prefetch" href="tracker.js">
    `;

    const result = serializeSanitizedDom(document);

    expect(result).toContain('stylesheet');
    expect(result).not.toContain('preload');
    expect(result).not.toContain('prefetch');
  });

  it('should strip all on* attributes', () => {
    document.body.innerHTML = `
      <button onclick="alert('click')" onmouseover="track()">Click me</button>
      <div onload="evil()" class="safe-class">Content</div>
    `;

    const result = serializeSanitizedDom(document);

    expect(result).toContain('Click me');
    expect(result).toContain('safe-class');
    expect(result).not.toContain('onclick');
    expect(result).not.toContain('onmouseover');
    expect(result).not.toContain('onload');
    expect(result).not.toContain('alert');
    expect(result).not.toContain('track');
    expect(result).not.toContain('evil');
  });

  it('should clear form values', () => {
    document.body.innerHTML = `
      <form>
        <input type="text" value="secret data">
        <textarea>private info</textarea>
        <select>
          <option value="1" selected>Option 1</option>
          <option value="2">Option 2</option>
        </select>
      </form>
    `;

    // Set runtime values that might differ from HTML
    const input = document.querySelector('input') as HTMLInputElement;
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    const select = document.querySelector('select') as HTMLSelectElement;
    
    if (input) input.value = 'runtime secret';
    if (textarea) textarea.value = 'runtime private';
    if (select) select.selectedIndex = 0;

    const result = serializeSanitizedDom(document);

    expect(result).not.toContain('secret data');
    expect(result).not.toContain('private info');
    expect(result).not.toContain('runtime secret');
    expect(result).not.toContain('runtime private');
    expect(result).not.toContain('selected');
  });

  it('should prepend doctype declaration', () => {
    document.body.innerHTML = '<p>Test content</p>';
    
    const result = serializeSanitizedDom(document);
    
    expect(result).toMatch(/^<!doctype html>\n/i);
  });

  it('should truncate oversized HTML and add truncation marker', () => {
    // Create a large document that exceeds MAX_DOM_BYTES
    const largeContent = 'x'.repeat(2_000_000); // 2MB of content
    document.body.innerHTML = `<div>${largeContent}</div>`;

    const result = serializeSanitizedDom(document);

    expect(result.length).toBeLessThan(1_500_000 + 100); // Some buffer for structure
    expect(result).toContain('<!--TRUNCATED-->');
    expect(result.endsWith('<!--TRUNCATED-->')).toBe(true);
  });
});