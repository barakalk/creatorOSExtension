const Joi = require('joi');
const logger = require('../utils/logger');

// Validation schemas
const schemas = {
  parseHtmlRequest: Joi.object({
    format: Joi.string().valid('json', 'file').default('json'),
    includeMetadata: Joi.boolean().default(true),
    minTokens: Joi.number().integer().min(1).default(1)
  })
};

// Validation middleware factory
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      allowUnknown: true,
      stripUnknown: true
    });

    if (error) {
      logger.warn('Validation error:', error.details);
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }

    req[property] = value;
    next();
  };
};

// File validation middleware
const validateFile = (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({
      error: 'No file uploaded',
      message: 'Please upload an HTML file'
    });
  }

  const file = req.file;
  
  // Additional file validation
  if (file.size === 0) {
    return res.status(400).json({
      error: 'Empty file',
      message: 'The uploaded file is empty'
    });
  }

  if (file.size > 50 * 1024 * 1024) { // 50MB limit for safety
    return res.status(400).json({
      error: 'File too large',
      message: 'File size exceeds the maximum limit'
    });
  }

  logger.info(`File validation passed: ${file.originalname} (${file.size} bytes)`);
  next();
};

module.exports = {
  validate,
  validateFile,
  schemas
};
