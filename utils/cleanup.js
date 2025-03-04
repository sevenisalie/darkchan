const supabase = require('../config/supabase');
const fileStorage = require('./fileStorage');

/**
 * Clean up orphaned files in Supabase Storage
 * This can be run as a scheduled task
 */
const cleanupOrphanedFiles = async () => {
  try {
    console.log('Starting file cleanup process...');
    
    // Get all files from storage
    const { data: imageFiles, error: imgError } = await supabase.storage
      .from(fileStorage.IMAGES_BUCKET)
      .list();
      
    if (imgError) throw imgError;
    
    const { data: thumbnailFiles, error: thumbError } = await supabase.storage
      .from(fileStorage.THUMBNAILS_BUCKET)
      .list();
      
    if (thumbError) throw thumbError;
    
    // Get all storage paths from the database
    const { data: threadPaths, error: threadError } = await supabase
      .from('threads')
      .select('storage_path')
      .not('storage_path', 'is', null);
      
    if (threadError) throw threadError;
    
    const { data: postPaths, error: postError } = await supabase
      .from('posts')
      .select('storage_path')
      .not('storage_path', 'is', null);
      
    if (postError) throw postError;
    
    // Create a set of all valid file paths
    const validPaths = new Set();
    
    // Add thread paths
    threadPaths.forEach(record => {
      if (record.storage_path) validPaths.add(record.storage_path);
    });
    
    // Add post paths
    postPaths.forEach(record => {
      if (record.storage_path) validPaths.add(record.storage_path);
    });
    
    // Delete orphaned files in original images bucket
    let deletedCount = 0;
    for (const file of imageFiles) {
      if (!validPaths.has(file.name)) {
        const { error } = await supabase.storage
          .from(fileStorage.IMAGES_BUCKET)
          .remove([file.name]);
          
        if (!error) {
          deletedCount++;
          console.log(`Deleted orphaned file: ${file.name}`);
        }
      }
    }
    
    // Delete orphaned thumbnails
    for (const file of thumbnailFiles) {
      const originalPath = file.name;
      if (!validPaths.has(originalPath)) {
        const { error } = await supabase.storage
          .from(fileStorage.THUMBNAILS_BUCKET)
          .remove([file.name]);
          
        if (!error) {
          deletedCount++;
          console.log(`Deleted orphaned thumbnail: ${file.name}`);
        }
      }
    }
    
    console.log(`File cleanup completed. Deleted ${deletedCount} orphaned files.`);
    return deletedCount;
  } catch (err) {
    console.error('Error during file cleanup:', err);
    return 0;
  }
};

/**
 * Schedule periodic cleanup (e.g., run every 24 hours)
 */
const scheduleCleanup = (intervalHours = 24) => {
  const intervalMs = intervalHours * 60 * 60 * 1000;
  
  console.log(`Scheduling file cleanup every ${intervalHours} hours`);
  
  // Run first cleanup after 1 hour
  setTimeout(() => {
    cleanupOrphanedFiles();
    
    // Then schedule regular interval
    setInterval(cleanupOrphanedFiles, intervalMs);
  }, 60 * 60 * 1000);
};

module.exports = {
  cleanupOrphanedFiles,
  scheduleCleanup
};