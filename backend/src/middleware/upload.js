const multer = require('multer');
const path = require('path');
const fs = require('fs');
const config = require('../config');
const logger = require('../utils/logger');

// Ensure upload directory exists
const uploadDir = path.resolve(config.uploadDir);
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname) || '.html';
    cb(null, `upload-${uniqueSuffix}${extension}`);
  }
});

// File filter to validate file types
const fileFilter = (req, file, cb) => {
  logger.info(`Received file: ${file.originalname}, mimetype: ${file.mimetype}`);
  
  // Check file extension
  const allowedExtensions = ['.html', '.htm'];
  const fileExtension = path.extname(file.originalname).toLowerCase();
  
  if (allowedExtensions.includes(fileExtension)) {
    cb(null, true);
  } else if (config.allowedFileTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only HTML files are allowed'), false);
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: config.maxFileSize,
    files: 1
  },
  fileFilter: fileFilter
});

// Cleanup function to remove temporary files
const cleanupFile = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      logger.info(`Cleaned up temporary file: ${filePath}`);
    }
  } catch (error) {
    logger.error(`Failed to cleanup file ${filePath}:`, error);
  }
};

module.exports = {
  upload: upload.single('htmlFile'),
  cleanupFile
};
