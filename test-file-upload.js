const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// Configuration
const API_URL = 'http://localhost:3000/api';
const TEST_IMAGE_PATH = path.join(__dirname, 'test-image.jpg');

// Create a thread with an image
async function createThreadWithImage() {
  try {
    // Check if test image exists
    if (!fs.existsSync(TEST_IMAGE_PATH)) {
      console.error(`Test image not found at: ${TEST_IMAGE_PATH}`);
      return;
    }
    
    console.log(`Test image exists at: ${TEST_IMAGE_PATH}, size: ${fs.statSync(TEST_IMAGE_PATH).size} bytes`);
    
    // Create form data
    const form = new FormData();
    form.append('comment', 'This is a test thread with an image.');
    form.append('name', 'Tester');
    
    // Read file as buffer and append it
    const fileBuffer = fs.readFileSync(TEST_IMAGE_PATH);
    console.log(`Read file buffer of length: ${fileBuffer.length} bytes`);
    
    // Use the actual file object with filename
    form.append('file', fileBuffer, {
      filename: 'test-image.jpg',
      contentType: 'image/jpeg',
      knownLength: fileBuffer.length
    });
    
    console.log('Form data created, sending request...');
    
    // Use the form directly without extracting headers
    const response = await axios({
      method: 'post',
      url: `${API_URL}/thread`,
      data: form,
      headers: {
        ...form.getHeaders()
      }
    });
    
    console.log('Response:', response.data);
  } catch (error) {
    console.error('Error details:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    } else if (error.request) {
      console.error('No response received');
    }
    console.error('Full error:', error);
  }
}

// Run the test
createThreadWithImage();