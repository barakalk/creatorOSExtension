const express = require('express');
const fs = require('fs');
const path = require('path');
const HTMLParser = require('../services/htmlParser');
const { upload, cleanupFile } = require('../middleware/upload');
const { validate, validateFile, schemas } = require('../middleware/validation');
const logger = require('../utils/logger');

const router = express.Router();
const htmlParser = new HTMLParser();

/**
 * POST /parse-html
 * Parse HTML file and return JSON data
 */
router.post('/parse-html', 
  upload,
  validateFile,
  validate(schemas.parseHtmlRequest, 'body'),
  async (req, res) => {
    let tempFilePath = null;
    
    try {
      const file = req.file;
      tempFilePath = file.path;
      const { format = 'json', includeMetadata = true, minTokens = 1 } = req.body;
      
      logger.info(`Processing HTML file: ${file.originalname}`);
      
      // Read HTML content
      const htmlContent = fs.readFileSync(tempFilePath, 'utf-8');
      
      if (!htmlContent.trim()) {
        return res.status(400).json({
          error: 'Invalid file',
          message: 'The uploaded file is empty or contains no valid HTML content'
        });
      }

      // Parse HTML content
      const parsedData = htmlParser.parseHTML(htmlContent);
      
      if (!parsedData || parsedData.length === 0) {
        return res.status(422).json({
          error: 'No parseable content',
          message: 'No Midjourney content found in the uploaded HTML file'
        });
      }

      // Filter results based on minimum tokens if specified
      const filteredData = parsedData.filter(item => 
        item.prompt && item.prompt.tokens >= minTokens
      );

      if (filteredData.length === 0) {
        return res.status(422).json({
          error: 'No content meets criteria',
          message: `No content found with at least ${minTokens} tokens`
        });
      }

      // Remove metadata if not requested
      const responseData = includeMetadata ? filteredData : filteredData.map(item => ({
        id: item.id,
        prompt: item.prompt,
        asset: item.asset
      }));

      logger.info(`Successfully parsed ${responseData.length} items from HTML`);

      // Return response based on format
      if (format === 'file') {
        // Generate JSON file and send as download
        const jsonContent = JSON.stringify(responseData, null, 2);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `parsed-data-${timestamp}.json`;
        
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'application/json');
        res.send(jsonContent);
      } else {
        // Return JSON response
        res.json({
          success: true,
          count: responseData.length,
          data: responseData,
          metadata: {
            originalFilename: file.originalname,
            processedAt: new Date().toISOString(),
            totalItems: parsedData.length,
            filteredItems: responseData.length
          }
        });
      }

    } catch (error) {
      logger.error('Error processing HTML file:', error);
      
      if (error.message.includes('HTML parsing failed')) {
        return res.status(422).json({
          error: 'Parsing failed',
          message: error.message
        });
      }
      
      res.status(500).json({
        error: 'Internal server error',
        message: 'An error occurred while processing the file'
      });
    } finally {
      // Cleanup temporary file
      if (tempFilePath) {
        setTimeout(() => cleanupFile(tempFilePath), 1000);
      }
    }
  }
);

/**
 * GET /health
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'html-parser-backend',
    version: '1.0.0'
  });
});

/**
 * GET /info
 * Service information endpoint
 */
router.get('/info', (req, res) => {
  res.json({
    service: 'HTML to JSON Parser',
    description: 'Converts Midjourney HTML DOM to structured JSON format',
    version: '1.0.0',
    endpoints: {
      'POST /parse-html': 'Parse HTML file and return JSON data',
      'GET /health': 'Health check endpoint',
      'GET /info': 'Service information'
    },
    supportedFormats: ['HTML'],
    maxFileSize: '10MB',
    features: [
      'Midjourney DOM parsing',
      'Prompt extraction',
      'Asset URL extraction',
      'Metadata parsing',
      'Job ID extraction',
      'Token counting'
    ]
  });
});

module.exports = router;
