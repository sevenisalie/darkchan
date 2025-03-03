require('dotenv').config();
const app = require('./app');
const fs = require('fs');
const path = require('path');

// Create uploads directory if it doesn't exist
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

// Start server
app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  console.log('/b/ is up and running!');
});