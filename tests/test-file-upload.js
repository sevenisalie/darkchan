// scripts/testFileUpload.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const supabase = require('../config/supabase');

const TEST_IMAGE_PATH = path.join(__dirname, '..', 'test-image.jpg');
const BUCKET_NAME = 'board-images';

async function testFileUpload() {
  console.log('===== File Upload Test =====');
  
  // Check if test image exists
  if (!fs.existsSync(TEST_IMAGE_PATH)) {
    console.error(`Test image not found at: ${TEST_IMAGE_PATH}`);
    return false;
  }
  
  console.log(`Test image found: ${TEST_IMAGE_PATH}`);
  
  // Check bucket access
  console.log(`Checking bucket: ${BUCKET_NAME}`);
  try {
    const { data: bucketFiles, error: listError } = await supabase.storage
      .from(BUCKET_NAME)
      .list();
      
    if (listError) {
      console.error('Error listing bucket files:', listError);
      return false;
    }
    
    console.log(`Successfully listed bucket contents (${bucketFiles.length} files)`);
  } catch (error) {
    console.error('Error accessing bucket:', error);
    return false;
  }
  
  // Test file upload
  console.log('Attempting to upload test file...');
  try {
    const fileContent = fs.readFileSync(TEST_IMAGE_PATH);
    const fileName = `test-upload-${Date.now()}.jpg`;
    
    console.log(`File size: ${fileContent.length} bytes`);
    console.log(`Upload destination: ${BUCKET_NAME}/${fileName}`);
    
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, fileContent, {
        contentType: 'image/jpeg',
        cacheControl: '3600'
      });
      
    if (error) {
      console.error('Upload failed:', error);
      
      // Check detailed error information
      console.log('Error details:');
      console.log('- Status:', error.status);
      console.log('- Message:', error.message);
      console.log('- Error:', error.error);
      console.log('- Stack:', error.stack);
      
      return false;
    }
    
    console.log('Upload successful:', data);
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(fileName);
      
    console.log('Public URL:', urlData.publicUrl);
    
    // Try to download the file to verify access
    console.log('Attempting to download file to verify...');
    const { data: downloadData, error: downloadError } = await supabase.storage
      .from(BUCKET_NAME)
      .download(fileName);
      
    if (downloadError) {
      console.error('Download verification failed:', downloadError);
      return false;
    }
    
    console.log('Download successful, file size:', downloadData.size);
    
    // Clean up test file
    console.log('Cleaning up test file...');
    const { error: deleteError } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([fileName]);
      
    if (deleteError) {
      console.error('Error deleting test file:', deleteError);
    } else {
      console.log('Test file deleted successfully');
    }
    
    return true;
  } catch (error) {
    console.error('Unexpected error during upload test:', error);
    return false;
  }
}

// Run the test
testFileUpload()
  .then(success => {
    console.log('\n===== Test Result =====');
    console.log(success ? '✓ File upload test PASSED' : '× File upload test FAILED');
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Test failed with exception:', error);
    process.exit(1);
  });