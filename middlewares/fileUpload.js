// middlewares/fileUpload.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const fileStorage = require('../utils/fileStorage');

// Create uploads directory for temporary storage
const uploadDir = process.env.UPLOAD_DIRECTORY || './uploads';
const thumbnailDir = path.join(uploadDir, 'thumbnails');

// Ensure directories exist
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
if (!fs.existsSync(thumbnailDir)) {
  fs.mkdirSync(thumbnailDir, { recursive: true });
}

// Configure disk storage for multer (temporary storage before upload to Supabase)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate a unique filename while preserving extension
    const fileExt = path.extname(file.originalname);
    const fileName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${fileExt}`;
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

// Middleware to process uploads and upload to Supabase Storage
const processUpload = async (req, res, next) => {
  if (!req.file) {
    return next();
  }

  try {
    console.log('Processing file upload:', req.file.originalname);
    
    // Extract NSFW flag from request
    const isNsfw = req.body.is_nsfw === 'true' || req.body.is_nsfw === true;
    
    // Upload file to Supabase Storage
    const fileData = await fileStorage.uploadFile(req.file, isNsfw);
    
    if (!fileData) {
      console.error('File upload to Supabase failed');
      return res.status(500).json({ error: 'Failed to upload file' });
    }
    
    // Add file data to request
    req.fileData = fileData;
    
    // Clean up temporary file
    try {
      if (req.file.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
        console.log('Temporary file deleted:', req.file.path);
      }
    } catch (cleanupError) {
      console.error('Error cleaning up temporary file:', cleanupError);
      // Don't fail the request if cleanup fails
    }
    
    next();
  } catch (error) {
    console.error('Error processing file upload:', error);
    
    // Clean up temporary file on error
    try {
      if (req.file.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
    } catch (cleanupError) {
      console.error('Error cleaning up temporary file:', cleanupError);
    }
    
    return res.status(500).json({ error: 'File upload processing failed' });
  }
};

// Create middleware that combines multer and storage upload
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