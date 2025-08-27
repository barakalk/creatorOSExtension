# Creator OS Capture Extension - Phase 0

A Chrome extension that captures and stores DOM content from AI services for analysis and processing.

## Features

### 🎯 **Smart Domain Capture**
- **Whitelist-based**: Only captures from approved domains (currently Midjourney)
- **Automatic detection**: Runs on document idle for seamless capture
- **Manual trigger**: Click "Capture Now" for on-demand capture
- **Per-site toggle**: Enable/disable capture for specific domains

### 💾 **Hybrid Storage System**
- **IndexedDB storage**: Saves DOM content locally for offline access
- **Backup downloads**: Optional HTML file downloads to your Downloads folder
- **Metadata tracking**: Stores URL, timestamp, file size, and page title
- **Offline access**: View captured content without internet connection

### 🔧 **Management Interface**
- **Popup UI**: Clean interface to manage captures and settings
- **Capture list**: View all stored captures with metadata
- **Quick actions**: Open captures in new tabs or delete them
- **Real-time updates**: Refresh capture list on demand

### ⚙️ **Developer Features**
- **Demo mode**: Test capture flow without backend server
- **Service worker logs**: Debug capture and storage operations
- **TypeScript**: Full type safety and IntelliSense support
- **Modular architecture**: Clean separation of concerns

## Installation

### From Source
1. **Clone and build**:
   ```bash
   cd extension
   npm install
   npm run build
   ```

2. **Load in Chrome**:
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the `dist/` folder
   - Grant site access permissions when prompted

3. **Verify installation**:
   - Extension icon should appear in Chrome toolbar
   - No errors should show in the extension card

## Usage

### Basic Capture Workflow
1. **Visit supported site**: Navigate to `https://www.midjourney.com/imagine`
2. **Check status**: Extension icon shows capture is enabled
3. **Capture content**:
   - **Automatic**: Content captures on page load (if enabled)
   - **Manual**: Click extension icon → "Capture Now"
4. **View results**: Open popup to see stored captures

### Managing Stored Captures
1. **View captures**: Click extension icon to open popup
2. **Browse list**: Scroll through "Saved Captures" section
3. **Open capture**: Click "Open" to view DOM in new tab
4. **Delete capture**: Click "Delete" to remove from storage
5. **Refresh list**: Click "Refresh" to update the display

### Configuration
- **Toggle capture**: Use the switch in popup to enable/disable per site
- **Demo mode**: Edit `src/config.ts` → set `DEMO_MODE = true/false`
- **API endpoint**: Edit `src/config.ts` → set `API_BASE` for your server
- **Whitelist domains**: Edit `src/whitelist.ts` → modify pattern array

## Architecture

### File Structure
```
src/
├── background.ts          # Service worker (capture processing, storage)
├── content.ts            # Content script (DOM extraction, sanitization)
├── popup/
│   ├── popup.html        # Extension popup UI
│   └── popup.ts          # Popup logic and storage management
├── utils/
│   ├── storage.ts        # IndexedDB utilities
│   └── logger.ts         # Debug logging
├── types/
│   └── global.d.ts       # TypeScript type definitions
├── config.ts             # Configuration settings
├── messages.ts           # Inter-script communication
├── whitelist.ts          # Domain whitelist management
└── manifest.json         # Extension manifest
```

### Data Flow
1. **Content script** extracts and sanitizes DOM from whitelisted pages
2. **Background worker** receives DOM data via messaging
3. **Storage utility** saves to IndexedDB with metadata
4. **Popup interface** lists and manages stored captures
5. **Optional backend** processes captures for analysis (demo mode available)

### Storage Schema
```typescript
// IndexedDB stores
captures: {
  id: string;           // cap_<timestamp>
  domHtml: string;      // Full DOM content
}

metadata: {
  id: string;           // cap_<timestamp>
  url: string;          // Source page URL
  timestamp: number;    // Capture time
  sizeBytes: number;    // DOM size
  title?: string;       // Page title
}
```

## Development

### Build Commands
```bash
npm run build          # Full build (TypeScript + Vite + esbuild)
npm run build:content  # Content script only (esbuild IIFE)
npm run dev:content    # Watch content script changes
npm run zip            # Create extension package
npm run test           # Run test suite
npm run lint           # Code linting
```

### Key Technologies
- **Manifest V3**: Modern Chrome extension architecture
- **TypeScript**: Type-safe development
- **Vite**: Fast build system for background/popup
- **esbuild**: Single-file bundling for content script
- **IndexedDB**: Client-side storage for large DOM content

### Testing Locally
1. **Enable demo mode**: Set `DEMO_MODE = true` in `src/config.ts`
2. **Build and reload**: `npm run build` → reload extension
3. **Test capture**: Visit Midjourney → click "Capture Now"
4. **Verify storage**: Check popup for saved captures
5. **Debug logs**: Open service worker DevTools for detailed logs

## Configuration Options

### Environment Settings (`src/config.ts`)
```typescript
export const API_BASE = 'http://localhost:3000';  // Backend server
export const DEMO_MODE = true;                    // Skip backend calls
export const MAX_DOM_BYTES = 1_500_000;          // ~1.5MB limit
export const DEBUG = true;                        // Enable logging
```

### Domain Whitelist (`src/whitelist.ts`)
```typescript
const patterns: WhitelistPattern[] = [
  { pattern: 'https://www.midjourney.com/imagine*' },
  { pattern: 'https://*.midjourney.com/*' },
  // Add more patterns as needed
];
```

## Troubleshooting

### Common Issues

**Extension won't load**:
- Check for TypeScript errors: `npm run build`
- Verify all files exist in `dist/` folder
- Ensure manifest.json is valid

**Content script not running**:
- Grant site access: Extension Details → "On all sites"
- Hard refresh target page (Cmd+Shift+R)
- Check console for "Content script initialized"

**Storage not working**:
- Check IndexedDB quota in DevTools → Application → Storage
- Verify service worker logs for storage errors
- Clear extension data if corrupted

**Capture failing**:
- Enable demo mode to bypass backend issues
- Check network requests in service worker DevTools
- Verify domain is in whitelist patterns

### Debug Information
- **Service worker logs**: Extension card → "service worker" link
- **Content script logs**: Target page → DevTools → Console
- **Storage inspection**: DevTools → Application → IndexedDB → creator_os_captures
- **Extension errors**: Extension card → "Errors" button

## API Integration

### Backend Requirements
When `DEMO_MODE = false`, the extension expects:

```typescript
POST /api/capture/dom
Body: { url: string, domHtml: string, meta?: CaptureMetadata }
Response: { id: string, domHash: string }

POST /api/parse/:captureId
Response: 200 OK
```

### Custom Processing
To add custom DOM processing:
1. Modify `src/content.ts` → `serializeSanitizedDom()`
2. Update `src/background.ts` → `handleCaptureDom()`
3. Extend storage schema in `src/utils/storage.ts`

## License

Private - Creator OS Phase 0

## Changelog

### v0.1.0 (Current)
- ✅ Domain-based capture (Midjourney support)
- ✅ IndexedDB storage with metadata
- ✅ Popup management interface
- ✅ Hybrid storage (IndexedDB + backup downloads)
- ✅ Service worker architecture (Manifest V3)
- ✅ TypeScript support with full type safety
- ✅ Demo mode for testing without backend
- ✅ Per-site capture toggles
- ✅ Automatic and manual capture modes