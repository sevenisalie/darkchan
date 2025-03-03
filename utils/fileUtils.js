const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

/**
 * Generate a tripcode from a password
 * 
 * @param {string} password - User-provided password
 * @returns {string} Generated tripcode
 */
exports.generateTripcode = (password) => {
  if (!password) return null;
  
  // Get salt from env or use a default
  const salt = process.env.TRIPCODE_SALT || 'defaultsalt';
  
  // Create a hash of the password with the salt
  const hash = crypto
    .createHash('sha256')
    .update(password + salt)
    .digest('base64')
    .substring(0, 10) // Use first 10 chars for tripcode
    .replace(/\+/g, '.')  // Replace problematic chars
    .replace(/\//g, ',')
    .replace(/=/g, '-');
  
  return hash;
};

/**
 * Verify if a password matches a tripcode
 * 
 * @param {string} password - User-provided password to check
 * @param {string} tripcode - Stored tripcode to verify against
 * @returns {boolean} Whether password matches tripcode
 */
exports.verifyTripcode = (password, tripcode) => {
  const generatedTripcode = exports.generateTripcode(password);
  return generatedTripcode === tripcode;
};

/**
 * Clean up old files that are no longer in the database
 * This can be run as a scheduled task
 */
exports.cleanupOrphanedFiles = async (supabase) => {
  const uploadDir = process.env.UPLOAD_DIRECTORY || './uploads';
  const thumbnailDir = path.join(uploadDir, 'thumbnails');
  
  try {
    // Get all files in the uploads directory
    const files = fs.readdirSync(uploadDir)
      .filter(file => !fs.statSync(path.join(uploadDir, file)).isDirectory())
      .map(file => path.join(uploadDir, file));
    
    // Get all thumbnails
    const thumbnails = fs.existsSync(thumbnailDir) ? 
      fs.readdirSync(thumbnailDir)
        .map(file => path.join(thumbnailDir, file)) : 
      [];
    
    // Get all file paths from the database
    const { data: threadFiles } = await supabase
      .from('threads')
      .select('file_path, thumbnail_path')
      .not('file_path', 'is', null);
    
    const { data: postFiles } = await supabase
      .from('posts')
      .select('file_path, thumbnail_path')
      .not('file_path', 'is', null);
    
    // Create a set of all valid file paths
    const validFilePaths = new Set();
    const validThumbnailPaths = new Set();
    
    // Add thread files
    threadFiles.forEach(record => {
      if (record.file_path) validFilePaths.add(path.join(__dirname, '..', record.file_path));
      if (record.thumbnail_path) validThumbnailPaths.add(path.join(__dirname, '..', record.thumbnail_path));
    });
    
    // Add post files
    postFiles.forEach(record => {
      if (record.file_path) validFilePaths.add(path.join(__dirname, '..', record.file_path));
      if (record.thumbnail_path) validThumbnailPaths.add(path.join(__dirname, '..', record.thumbnail_path));
    });
    
    // Delete orphaned files
    files.forEach(file => {
      if (!validFilePaths.has(file)) {
        try {
          fs.unlinkSync(file);
          console.log(`Deleted orphaned file: ${file}`);
        } catch (err) {
          console.error(`Error deleting file ${file}:`, err);
        }
      }
    });
    
    // Delete orphaned thumbnails
    thumbnails.forEach(thumb => {
      if (!validThumbnailPaths.has(thumb)) {
        try {
          fs.unlinkSync(thumb);
          console.log(`Deleted orphaned thumbnail: ${thumb}`);
        } catch (err) {
          console.error(`Error deleting thumbnail ${thumb}:`, err);
        }
      }
    });
    
    console.log('File cleanup completed');
  } catch (err) {
    console.error('Error during file cleanup:', err);
  }
};