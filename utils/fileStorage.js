// utils/fileStorage.js
const sharp = require('sharp');
const supabase = require('../config/supabase');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

// Configure storage buckets
const IMAGES_BUCKET = 'board-images';
const THUMBNAILS_BUCKET = 'board-thumbnails';

const initStorage = async () => {
    try {
      console.log('Checking storage buckets...');
      
      // Just verify buckets exist instead of trying to create them
      const { data: buckets, error } = await supabase.storage.listBuckets();
      
      if (error) {
        console.error('Error listing buckets:', error);
        return false;
      }
      
      // Check if required buckets exist
      const hasImagesBucket = buckets && buckets.some(b => b.name === IMAGES_BUCKET);
      const hasThumbnailsBucket = buckets && buckets.some(b => b.name === THUMBNAILS_BUCKET);
      
      if (!hasImagesBucket) {
        console.error(`Required bucket '${IMAGES_BUCKET}' not found! Please create it manually in Supabase dashboard.`);
        return false;
      }
      
      if (!hasThumbnailsBucket) {
        console.error(`Required bucket '${THUMBNAILS_BUCKET}' not found! Please create it manually in Supabase dashboard.`);
        return false;
      }
      
      console.log('Storage buckets verified - ready to use');
      return true;
    } catch (err) {
      console.error('Error initializing storage:', err);
      return false;
    }
  };
  
  /**
   * Upload a file to storage
   * 
   * @param {object} file - The file object from multer
   * @param {boolean} isNsfw - Whether the file is NSFW
   * @returns {object} An object with file metadata or null if upload failed
   */
  const uploadFile = async (file, isNsfw = false) => {
    if (!file) {
      console.error('No file provided');
      return null;
    }
    
    try {
      // Generate a unique filename
      const fileExt = path.extname(file.originalname || 'unknown.jpg');
      const fileName = `${uuidv4()}${fileExt}`;
      const storagePath = `${isNsfw ? 'nsfw/' : ''}${fileName}`;
      
      // Get file buffer (handles both memory and disk storage)
      const fileBuffer = file.buffer || fs.readFileSync(file.path);
      
      console.log(`Uploading file: ${file.originalname} (${fileBuffer.length} bytes) to ${storagePath}`);
      
      // Upload original file
      const { error: uploadError } = await supabase.storage
        .from(IMAGES_BUCKET)
        .upload(storagePath, fileBuffer, {
          contentType: file.mimetype,
          cacheControl: '3600',
          upsert: false
        });
        
      if (uploadError) {
        console.error('Error uploading file:', uploadError);
        throw uploadError;
      }
      
      // Get public URL
      const { data: urlData } = supabase.storage
        .from(IMAGES_BUCKET)
        .getPublicUrl(storagePath);
      
      console.log('File upload successful, URL:', urlData.publicUrl);
      
      // Generate thumbnail for images
      let thumbnailUrl = null;
      const isImage = file.mimetype.startsWith('image/');
      
      if (isImage) {
        try {
          // Create a thumbnail buffer
          const thumbnailBuffer = await sharp(fileBuffer)
            .resize(200) // 200px wide thumbnail
            .toBuffer();
          
          // Upload thumbnail
          const thumbnailPath = `${isNsfw ? 'nsfw/' : ''}${fileName}`;
          const { error: thumbError } = await supabase.storage
            .from(THUMBNAILS_BUCKET)
            .upload(thumbnailPath, thumbnailBuffer, {
              contentType: 'image/jpeg',
              cacheControl: '3600',
              upsert: false
            });
            
          if (thumbError) {
            console.error('Error creating thumbnail:', thumbError);
          } else {
            // Get thumbnail URL
            const { data: thumbUrlData } = supabase.storage
              .from(THUMBNAILS_BUCKET)
              .getPublicUrl(thumbnailPath);
              
            thumbnailUrl = thumbUrlData.publicUrl;
            console.log('Thumbnail created:', thumbnailUrl);
          }
        } catch (thumbErr) {
          console.error('Error processing thumbnail:', thumbErr);
        }
      }
      
      // Return file metadata
      return {
        fileName: file.originalname,
        fileSize: file.size,
        fileType: file.mimetype,
        filePath: urlData.publicUrl,
        thumbnailPath: thumbnailUrl,
        storagePath
      };
    } catch (err) {
      console.error('Error in uploadFile:', err);
      return null;
    }
  };
/**
 * Initialize storage buckets
 * Should be called when the app starts
 */

const uploadFileFromPath = async (filePath, isNsfw = false) => {
  if (!filePath || !fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    return null;
  }
  
  try {
    const fileName = path.basename(filePath);
    const fileBuffer = fs.readFileSync(filePath);
    const fileStats = fs.statSync(filePath);
    const contentType = getMimeType(fileName);
    
    // Generate a unique filename
    const fileExt = path.extname(fileName);
    const uniqueFileName = `${uuidv4()}${fileExt}`;
    const storagePath = `${isNsfw ? 'nsfw/' : ''}${uniqueFileName}`;
    
    console.log(`Uploading file: ${fileName} to ${storagePath}`);
    
    // Upload original file
    const { error: uploadError } = await supabase.storage
      .from(IMAGES_BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType,
        cacheControl: '3600',
        upsert: false
      });
      
    if (uploadError) {
      console.error('Error uploading file:', uploadError);
      throw uploadError;
    }
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from(IMAGES_BUCKET)
      .getPublicUrl(storagePath);
    
    // Generate thumbnail for images
    let thumbnailUrl = null;
    const isImage = contentType.startsWith('image/');
    
    if (isImage) {
      try {
        // Create a thumbnail buffer
        const thumbnailBuffer = await sharp(fileBuffer)
          .resize(200) // 200px wide thumbnail
          .toBuffer();
        
        // Upload thumbnail
        const thumbnailPath = `${isNsfw ? 'nsfw/' : ''}${uniqueFileName}`;
        const { error: thumbError } = await supabase.storage
          .from(THUMBNAILS_BUCKET)
          .upload(thumbnailPath, thumbnailBuffer, {
            contentType: 'image/jpeg',
            cacheControl: '3600',
            upsert: false
          });
          
        if (thumbError) {
          console.error('Error creating thumbnail:', thumbError);
        } else {
          // Get thumbnail URL
          const { data: thumbUrlData } = supabase.storage
            .from(THUMBNAILS_BUCKET)
            .getPublicUrl(thumbnailPath);
            
          thumbnailUrl = thumbUrlData.publicUrl;
        }
      } catch (thumbErr) {
        console.error('Error processing thumbnail:', thumbErr);
      }
    }
    
    console.log('File upload successful');
    
    // Return file metadata
    return {
      fileName,
      fileSize: fileStats.size,
      fileType: contentType,
      filePath: urlData.publicUrl,
      thumbnailPath: thumbnailUrl,
      storagePath
    };
  } catch (err) {
    console.error('Error uploading file:', err);
    return null;
  }
};

/**
 * Delete a file from storage
 * 
 * @param {string} storagePath - The path in storage (returned from uploadFile)
 * @param {string} thumbnailPath - Optional thumbnail URL to delete
 */
const deleteFile = async (storagePath, thumbnailPath = null) => {
  try {
    if (storagePath) {
      // Extract the path from the full URL if needed
      const path = storagePath.includes('/')
        ? storagePath.split('/').pop()
        : storagePath;
      
      console.log(`Deleting file: ${storagePath}`);
      
      // Delete original file
      const { error } = await supabase.storage
        .from(IMAGES_BUCKET)
        .remove([storagePath]);
        
      if (error) {
        console.error('Error deleting file:', error);
      } else {
        console.log('File deleted successfully');
      }
    }
    
    if (thumbnailPath) {
      // Handle both URL and storage path for thumbnail
      let thumbnailStoragePath = thumbnailPath;
      
      // Extract thumbnail path from URL if it's a URL
      if (thumbnailPath.startsWith('http')) {
        const url = new URL(thumbnailPath);
        const pathParts = url.pathname.split('/');
        thumbnailStoragePath = pathParts[pathParts.length - 1];
      }
      
      console.log(`Deleting thumbnail: ${thumbnailStoragePath}`);
      
      // Delete thumbnail
      const { error } = await supabase.storage
        .from(THUMBNAILS_BUCKET)
        .remove([thumbnailStoragePath]);
        
      if (error) {
        console.error('Error deleting thumbnail:', error);
      } else {
        console.log('Thumbnail deleted successfully');
      }
    }
    
    return true;
  } catch (err) {
    console.error('Error during file deletion:', err);
    return false;
  }
};

/**
 * Helper function to get MIME type from file name
 */
function getMimeType(filename) {
  const ext = path.extname(filename).toLowerCase();
  
  const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml'
  };
  
  return mimeTypes[ext] || 'application/octet-stream';
}

module.exports = {
  initStorage,
  uploadFile,
  uploadFileFromPath,
  deleteFile,
  IMAGES_BUCKET,
  THUMBNAILS_BUCKET
};