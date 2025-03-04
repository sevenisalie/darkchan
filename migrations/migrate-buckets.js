// scripts/migrateFiles.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const supabase = require('../config/supabase');
const fileStorage = require('../utils/fileStorage');

/**
 * Migrate existing files from local storage to Supabase Storage
 */
async function migrateFiles() {
  try {
    console.log('Starting file migration...');
    
    // Initialize storage buckets
    await fileStorage.initStorage();
    
    // Get all threads and posts with file paths
    const { data: threads, error: threadError } = await supabase
      .from('threads')
      .select('id, file_path, thumbnail_path, is_nsfw')
      .not('file_path', 'is', null);
      
    if (threadError) throw threadError;
    
    const { data: posts, error: postError } = await supabase
      .from('posts')
      .select('id, file_path, thumbnail_path, is_nsfw')
      .not('file_path', 'is', null);
      
    if (postError) throw postError;
    
    console.log(`Found ${threads.length} threads and ${posts.length} posts with files to migrate`);
    
    // Migrate thread files
    let migratedCount = 0;
    for (const thread of threads) {
      try {
        const filePath = thread.file_path;
        const thumbnailPath = thread.thumbnail_path;
        
        // Skip if already migrated
        if (filePath.includes(process.env.SUPABASE_URL)) {
          continue;
        }
        
        // Read local file
        const localPath = path.join(__dirname, '..', filePath);
        if (!fs.existsSync(localPath)) {
          console.log(`File not found: ${localPath}`);
          continue;
        }
        
        const fileBuffer = fs.readFileSync(localPath);
        const fileName = path.basename(filePath);
        const fileType = getFileType(fileName);
        
        // Upload to Supabase
        const fileDest = `${thread.is_nsfw ? 'nsfw/' : ''}${fileName}`;
        await supabase.storage
          .from(fileStorage.IMAGES_BUCKET)
          .upload(fileDest, fileBuffer, {
            contentType: fileType,
            upsert: true
          });
          
        // Get new URL
        const { data: urlData } = supabase.storage
          .from(fileStorage.IMAGES_BUCKET)
          .getPublicUrl(fileDest);
          
        // Update thread record with new URL and storage path
        await supabase
          .from('threads')
          .update({
            file_path: urlData.publicUrl,
            storage_path: fileDest
          })
          .eq('id', thread.id);
        
        // If there's a thumbnail, migrate it too
        if (thumbnailPath && fs.existsSync(path.join(__dirname, '..', thumbnailPath))) {
          const thumbBuffer = fs.readFileSync(path.join(__dirname, '..', thumbnailPath));
          const thumbName = path.basename(thumbnailPath);
          const thumbDest = `${thread.is_nsfw ? 'nsfw/' : ''}${thumbName}`;
          
          await supabase.storage
            .from(fileStorage.THUMBNAILS_BUCKET)
            .upload(thumbDest, thumbBuffer, {
              contentType: 'image/jpeg',
              upsert: true
            });
            
          const { data: thumbUrlData } = supabase.storage
            .from(fileStorage.THUMBNAILS_BUCKET)
            .getPublicUrl(thumbDest);
            
          await supabase
            .from('threads')
            .update({ 
              thumbnail_path: thumbUrlData.publicUrl 
            })
            .eq('id', thread.id);
        }
        
        migratedCount++;
        console.log(`Migrated thread file: ${fileName}`);
      } catch (err) {
        console.error(`Error migrating thread ${thread.id}:`, err);
      }
    }
    
    // Migrate post files
    for (const post of posts) {
      try {
        const filePath = post.file_path;
        const thumbnailPath = post.thumbnail_path;
        
        // Skip if already migrated
        if (filePath.includes(process.env.SUPABASE_URL)) {
          continue;
        }
        
        // Read local file
        const localPath = path.join(__dirname, '..', filePath);
        if (!fs.existsSync(localPath)) {
          console.log(`File not found: ${localPath}`);
          continue;
        }
        
        const fileBuffer = fs.readFileSync(localPath);
        const fileName = path.basename(filePath);
        const fileType = getFileType(fileName);
        
        // Upload to Supabase
        const fileDest = `${post.is_nsfw ? 'nsfw/' : ''}${fileName}`;
        await supabase.storage
          .from(fileStorage.IMAGES_BUCKET)
          .upload(fileDest, fileBuffer, {
            contentType: fileType,
            upsert: true
          });
          
        // Get new URL
        const { data: urlData } = supabase.storage
          .from(fileStorage.IMAGES_BUCKET)
          .getPublicUrl(fileDest);
          
        // Update post record with new URL and storage path
        await supabase
          .from('posts')
          .update({
            file_path: urlData.publicUrl,
            storage_path: fileDest
          })
          .eq('id', post.id);
        
        // If there's a thumbnail, migrate it too
        if (thumbnailPath && fs.existsSync(path.join(__dirname, '..', thumbnailPath))) {
          const thumbBuffer = fs.readFileSync(path.join(__dirname, '..', thumbnailPath));
          const thumbName = path.basename(thumbnailPath);
          const thumbDest = `${post.is_nsfw ? 'nsfw/' : ''}${thumbName}`;
          
          await supabase.storage
            .from(fileStorage.THUMBNAILS_BUCKET)
            .upload(thumbDest, thumbBuffer, {
              contentType: 'image/jpeg',
              upsert: true
            });
            
          const { data: thumbUrlData } = supabase.storage
            .from(fileStorage.THUMBNAILS_BUCKET)
            .getPublicUrl(thumbDest);
            
          await supabase
            .from('posts')
            .update({ 
              thumbnail_path: thumbUrlData.publicUrl 
            })
            .eq('id', post.id);
        }
        
        migratedCount++;
        console.log(`Migrated post file: ${fileName}`);
      } catch (err) {
        console.error(`Error migrating post ${post.id}:`, err);
      }
    }
    
    console.log(`Migration complete. ${migratedCount} files migrated.`);
  } catch (err) {
    console.error('Migration failed:', err);
  }
}

/**
 * Helper to get MIME type from filename
 */
function getFileType(filename) {
  const ext = path.extname(filename).toLowerCase();
  
  const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp'
  };
  
  return mimeTypes[ext] || 'application/octet-stream';
}

// Run migration if called directly
if (require.main === module) {
  migrateFiles()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
} else {
  module.exports = { migrateFiles };
}