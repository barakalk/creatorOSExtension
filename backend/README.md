# HTML to JSON Parser Backend

A Node.js backend service that converts Midjourney HTML DOM structures to structured JSON format.

## Features

- 🔍 **HTML Parsing**: Extracts Midjourney content from HTML files using Cheerio
- 🎯 **Smart Extraction**: Automatically identifies prompts, assets, metadata, and job IDs
- 📊 **Structured Output**: Converts to standardized JSON format
- 🚀 **RESTful API**: Clean API endpoints with proper error handling
- 🛡️ **Security**: Rate limiting, CORS, file validation, and security headers
- 📝 **Logging**: Comprehensive logging with Winston
- ⚡ **Performance**: Efficient parsing with cleanup of temporary files

## Quick Start

### Installation

```bash
cd backend
npm install
```

### Environment Variables

Create a `.env` file in the backend directory:

```env
PORT=3001
NODE_ENV=development
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
CORS_ORIGIN=*
LOG_LEVEL=info
```

### Running the Service

```bash
# Development mode with auto-restart
npm run dev

# Production mode
npm start
```

The service will start on `http://localhost:3001`

## API Endpoints

### POST /parse-html

Parse an HTML file and convert to JSON format.

**Request:**
- Method: `POST`
- Content-Type: `multipart/form-data`
- Body: HTML file upload (field name: `htmlFile`)
- Optional query parameters:
  - `format`: `json` (default) or `file` (download JSON file)
  - `includeMetadata`: `true` (default) or `false`
  - `minTokens`: minimum token count filter (default: 1)

**Response (format=json):**
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "id": 1,
      "prompt": {
        "text": "a baby sleeping with headphones...",
        "type": "generate",
        "category": "image",
        "tokens": 33
      },
      "asset": {
        "url": "https://cdn.midjourney.com/05045c9b.../0_0_640_N.webp",
        "type": "image",
        "jobId": "05045c9b-7c33-41a0-8e64-a58eae9b0480",
        "resolution": "upscaled",
        "isUpscaled": true,
        "isVariation": false
      },
      "metadata": {
        "username": "barakalkalay",
        "version": "7",
        "aspectRatio": "4:3",
        "duration": null,
        "estimatedTimestamp": null,
        "model": "v7",
        "settings": {
          "stylization": 100,
          "weirdness": 0,
          "variety": 0,
          "mode": "standard"
        }
      }
    }
  ],
  "metadata": {
    "originalFilename": "example.html",
    "processedAt": "2024-01-15T10:30:00.000Z",
    "totalItems": 2,
    "filteredItems": 2
  }
}
```

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "service": "html-parser-backend",
  "version": "1.0.0"
}
```

### GET /info

Detailed service information.

### GET /

Root endpoint with basic service information.

## Usage Examples

### Using curl

```bash
# Parse HTML file and get JSON response
curl -X POST http://localhost:3001/parse-html \
  -F "htmlFile=@example.html" \
  -F "format=json" \
  -F "includeMetadata=true"

# Download parsed data as JSON file
curl -X POST http://localhost:3001/parse-html \
  -F "htmlFile=@example.html" \
  -F "format=file" \
  -O

# Health check
curl http://localhost:3001/health
```

### Using JavaScript (fetch)

```javascript
const formData = new FormData();
formData.append('htmlFile', fileInput.files[0]);
formData.append('format', 'json');

const response = await fetch('http://localhost:3001/parse-html', {
  method: 'POST',
  body: formData
});

const result = await response.json();
console.log(result.data);
```

## Parsing Logic

The service intelligently extracts:

### Prompts
- Text content from spans and text elements
- Filters out metadata and button text
- Counts tokens (word approximation)
- Determines prompt type (generate, upscale, variation, edit)

### Assets
- Image and video URLs from `src` attributes
- Job IDs from Midjourney URLs
- Asset type detection (image/video)
- Resolution analysis (standard, medium, high, upscaled)
- Upscale and variation detection

### Metadata
- Usernames from user elements
- Version numbers from `--v` parameters
- Aspect ratios from `--ar` parameters
- Settings: stylization (`--s`), weirdness (`--w`), variety (`--c`)
- Model version mapping

## Error Handling

The service provides detailed error responses:

- `400 Bad Request`: Invalid file, missing file, validation errors
- `422 Unprocessable Entity`: No parseable content found
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server errors

## File Limits

- Maximum file size: 10MB (configurable)
- Supported formats: HTML files (.html, .htm)
- Single file upload only
- Automatic cleanup of temporary files

## Development

### Project Structure

```
backend/
├── src/
│   ├── config/           # Configuration
│   ├── middleware/       # Express middleware
│   ├── routes/          # API routes
│   ├── services/        # Business logic
│   ├── utils/           # Utilities
│   └── server.js        # Main server file
├── test/                # Test files
├── logs/                # Log files
├── uploads/             # Temporary uploads
└── package.json
```

### Testing

```bash
# Run tests
npm test

# Test with example file
curl -X POST http://localhost:3001/parse-html \
  -F "htmlFile=@test/example.html"
```

## Security Features

- **Helmet**: Security headers
- **Rate Limiting**: Prevents abuse
- **File Validation**: Type and size checks
- **CORS**: Configurable cross-origin requests
- **Input Sanitization**: Validates all inputs
- **Error Handling**: No sensitive data exposure

## Logging

Comprehensive logging with Winston:
- Request/response logging
- Error tracking with stack traces
- File operations logging
- Performance metrics

Log files:
- `logs/combined.log`: All logs
- `logs/error.log`: Error logs only
- Console output in development

## Configuration

All configuration via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3001 | Server port |
| `NODE_ENV` | development | Environment |
| `UPLOAD_DIR` | ./uploads | Upload directory |
| `MAX_FILE_SIZE` | 10485760 | Max file size (bytes) |
| `CORS_ORIGIN` | * | CORS origin |
| `LOG_LEVEL` | info | Log level |

## License

MIT License
