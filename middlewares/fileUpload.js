const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');

// Configure upload directory
const uploadDir = process.env.UPLOAD_DIRECTORY || './uploads';
const thumbnailDir = path.join(uploadDir, 'thumbnails');

// Ensure directories exist
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
if (!fs.existsSync(thumbnailDir)) {
  fs.mkdirSync(thumbnailDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate a unique filename while preserving extension
    const fileExt = path.extname(file.originalname);
    const fileName = `${uuidv4()}${fileExt}`;
    cb(null, fileName);
  }
});

// Helper function to validate file types
const fileFilter = (req, file, cb) => {
  // Get allowed file types from env, default to common image types
  const allowedTypes = (process.env.ALLOWED_FILE_TYPES || 'image/jpeg,image/png,image/gif,image/webp')
    .split(',');
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed. Allowed types: ${allowedTypes.join(', ')}`), false);
  }
};

// Configure upload middleware
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024 // 5MB default
  }
});

// Middleware to process uploads and create thumbnails
const processUpload = (req, res, next) => {
  if (!req.file) {
    return next();
  }

  // Generate thumbnail for images
  const isImage = req.file.mimetype.startsWith('image/');
  
  if (isImage) {
    const thumbnailPath = path.join(thumbnailDir, `thumb_${path.basename(req.file.path)}`);
    
    // Create a 200px wide thumbnail
    sharp(req.file.path)
      .resize(200)
      .toFile(thumbnailPath)
      .then(() => {
        // Add thumbnail path to the file object
        req.file.thumbnailPath = thumbnailPath;
        next();
      })
      .catch(err => {
        console.error('Error creating thumbnail:', err);
        req.file.thumbnailPath = null;
        next();
      });
  } else {
    // No thumbnail for non-image files
    req.file.thumbnailPath = null;
    next();
  }
};

// Create middleware that combines multer and thumbnail creation
const fileUploadMiddleware = {
  single: (fieldName) => {
    return [
      upload.single(fieldName),
      processUpload
    ];
  },
  // Add other methods (array, fields, etc.) if needed
};

module.exports = fileUploadMiddleware;