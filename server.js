// server.js
require('dotenv').config();
const app = require('./app');
const fs = require('fs');
const path = require('path');
const fileStorage = require('./utils/fileStorage');

// Create uploads directory if it doesn't exist (for temporary storage)
const uploadDir = process.env.UPLOAD_DIRECTORY || './uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log(`Created upload directory: ${uploadDir}`);
}

// Create thumbnails directory
const thumbnailDir = path.join(uploadDir, 'thumbnails');
if (!fs.existsSync(thumbnailDir)) {
  fs.mkdirSync(thumbnailDir, { recursive: true });
  console.log(`Created thumbnails directory: ${thumbnailDir}`);
}

// Set port
const PORT = process.env.PORT || 3000;

// Initialize application
async function initializeApp() {
  try {
    // Verify Supabase connection
    console.log('Checking Supabase connection...');
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      console.error('SUPABASE_URL and SUPABASE_ANON_KEY environment variables must be set');
      process.exit(1);
    }
    
    // Initialize storage buckets
    console.log('Initializing storage buckets...');
    await fileStorage.initStorage();
    
    // Start server
    app.listen(PORT, () => {
      console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
      console.log('/b/ is up and running!');
    });
  } catch (error) {
    console.error('Failed to initialize application:', error);
    process.exit(1);
  }
}

// Start the application
initializeApp();