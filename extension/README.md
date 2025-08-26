# Creator OS Capture Extension - Phase 0

A Chrome extension that automatically captures and sends sanitized DOM content from whitelisted websites to the Creator OS backend for analysis.

## Features

- **Whitelist-driven capture**: Only runs on domains/URL patterns from a remote whitelist
- **DOM sanitization**: Removes scripts, styles, event handlers, and form values
- **Size-capped capture**: Limits DOM size to ~1.5MB with truncation
- **Per-site toggle**: Enable/disable capture for specific hostnames
- **Manual capture**: Trigger captures on-demand via popup
- **Background processing**: Posts to `/api/capture/dom` then `/api/parse/:captureId`

## Project Structure

```
src/
├── manifest.json          # MV3 extension manifest
├── config.ts             # API endpoints and settings
├── types/global.d.ts     # TypeScript type definitions
├── messages.ts           # Runtime message types and helpers
├── utils/logger.ts       # Debug logging utilities
├── sanitize.ts           # DOM sanitization logic
├── whitelist.ts          # URL pattern matching and caching
├── api.ts               # Backend API communication
├── background.ts        # Service worker (message handler)
├── content.ts           # Content script (DOM capture)
├── popup/
│   ├── popup.html       # Popup UI markup
│   └── popup.ts         # Popup logic and event handling
├── test/
│   ├── sanitize.test.ts # DOM sanitization tests
│   ├── whitelist.test.ts # Pattern matching tests
│   └── api.test.ts      # API communication tests
└── build/
    └── zip.js           # Extension packaging script
```

## Setup

### Prerequisites

- Node.js 18+ and npm
- Chrome browser for testing

### Installation

1. **Clone and install dependencies:**
   ```bash
   cd /path/to/creator-os/extension
   npm install
   ```

2. **Configure API endpoint (optional):**
   Edit `src/config.ts` to change the backend URL:
   ```typescript
   export const API_BASE = 'http://localhost:3000'; // Change as needed
   ```

3. **Build the extension:**
   ```bash
   npm run build
   ```

### Development

- **Development mode (watch):** `npm run dev`
- **Type checking:** `npm run typecheck`  
- **Linting:** `npm run lint`
- **Testing:** `npm run test`
- **Package for distribution:** `npm run zip`

## Loading the Extension

### Load Unpacked Extension

1. Build the extension: `npm run build`
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked" and select the `dist/` folder
5. The extension should appear in your extensions list

### Test Installation

1. Visit a whitelisted site (e.g., if your backend has `https://www.runwayml.com/*`)
2. Check the browser console for capture logs (if `DEBUG = true`)
3. Click the extension icon to see the popup with hostname and toggle
4. Use "Capture Now" button to trigger manual captures

## Configuration

### API Base URL

Change the backend URL in `src/config.ts`:
```typescript
export const API_BASE = 'https://your-api-server.com';
```

### Debug Logging

Toggle debug logging in `src/config.ts`:
```typescript
export const DEBUG = false; // Set to false to disable console logs
```

### DOM Size Limit

Adjust the DOM size cap in `src/config.ts`:
```typescript
export const MAX_DOM_BYTES = 2_000_000; // 2MB instead of 1.5MB
```

## Testing

### Unit Tests

Run the test suite:
```bash
npm run test
```

Tests cover:
- DOM sanitization (script removal, attribute stripping, form clearing)
- URL pattern matching with wildcards
- API request/response handling
- Error conditions and edge cases

### Manual Testing

1. **Create a test page** (`test.html`):
   ```html
   <!DOCTYPE html>
   <html>
   <head>
     <title>Test Page</title>
     <script>console.log('This should be removed');</script>
     <style>.test { color: red; }</style>
   </head>
   <body>
     <h1>Test Content</h1>
     <button onclick="alert('dangerous')">Click Me</button>
     <form>
       <input type="text" value="secret data">
       <textarea>private info</textarea>
     </form>
   </body>
   </html>
   ```

2. **Set up local whitelist** that includes your test page URL
3. **Load the extension** and visit your test page
4. **Check console logs** for capture activity
5. **Verify sanitization** by checking the captured DOM excludes:
   - `<script>` tags and content
   - `<style>` tags and content  
   - `onclick` and other event attributes
   - Input/textarea values

### Backend Integration Testing

Ensure your backend has these endpoints:

- `GET /api/whitelist` - Returns JSON array of pattern objects:
  ```json
  [
    {"pattern": "https://www.runwayml.com/*"},
    {"pattern": "https://www.midjourney.com/*"}
  ]
  ```

- `POST /api/capture/dom` - Accepts capture payload:
  ```json
  {
    "url": "https://example.com/page",
    "domHtml": "<!doctype html>...",
    "meta": {
      "title": "Page Title",
      "userAgent": "Chrome/...",
      "viewport": {"width": 1920, "height": 1080},
      "timestamp": 1234567890
    }
  }
  ```
  Returns: `{"id": "capture-123", "domHash": "abc..."}`

- `POST /api/parse/:captureId` - Triggers parsing, returns success/error

## Troubleshooting

### Extension Not Loading

- Check for TypeScript errors: `npm run typecheck`
- Verify manifest.json is valid
- Look for errors in Chrome's extension management page

### Capture Not Working

- Check if the site is in the whitelist (console logs show this)
- Verify the per-site toggle is enabled (check popup)
- Ensure backend is running and accessible
- Check network tab for API request failures

### Tests Failing

- Run `npm run typecheck` to check for type issues
- Ensure all dependencies are installed: `npm install`
- Check that jsdom is properly mocked for DOM tests

## Browser Compatibility

- **Chrome 88+** (Manifest V3 support)
- **Edge 88+** (Chromium-based)
- **Other Chromium browsers** with MV3 support

## Security Notes

- DOM sanitization removes all executable content
- Form values are cleared before transmission
- No authentication tokens are stored or transmitted
- Debug logs can be disabled for production builds

## License

Private - Creator OS Project