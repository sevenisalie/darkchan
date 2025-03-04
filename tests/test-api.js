const axios = require('axios');
const fs = require('fs');
const path = require('path');
// Use native Node.js form data implementation
const { FormData } = require('formdata-node');
const { fileFromPath } = require('formdata-node/file-from-path');

// Configuration
const API_URL = 'http://localhost:3000/api';
const TEST_IMAGE_PATH = path.join(__dirname, 'test-image.jpg');

async function testAPI() {
  try {
    // 1. Create a thread with image
    console.log('Creating thread with image...');
    
    const threadForm = new FormData();
    threadForm.set('subject', 'Test Thread');
    threadForm.set('comment', 'This is a test thread with an image.');
    threadForm.set('name', 'Tester');
    threadForm.set('password', 'test123');
    
    // Add file using fileFromPath
    const file = await fileFromPath(TEST_IMAGE_PATH, {
      type: 'image/jpeg',
      filename: 'test-image.jpg'
    });
    threadForm.set('file', file);
    
    const threadResponse = await axios.post(`${API_URL}/thread`, threadForm, {
      headers: {
        ...threadForm.headers
      }
    });
    
    console.log('Thread created!', threadResponse.data.thread.id);
    const threadId = threadResponse.data.thread.id;
    
    // 2. Add a reply to the thread
    console.log('\nAdding reply...');
    
    const replyForm = new FormData();
    replyForm.set('comment', 'This is a test reply.');
    replyForm.set('name', 'Replier');
    
    await axios.post(`${API_URL}/thread/${threadId}/reply`, replyForm, {
      headers: {
        ...replyForm.headers
      }
    });
    
    console.log('Reply added!');
    
    // 3. Get thread with replies
    console.log('\nFetching thread with replies...');
    
    const getResponse = await axios.get(`${API_URL}/thread/${threadId}`);
    const thread = getResponse.data.thread;
    const posts = getResponse.data.posts;
    
    console.log(`Thread: ${thread.subject || 'No subject'} by ${thread.name}`);
    console.log(`Content: ${thread.comment}`);
    console.log(`File: ${thread.file_name || 'None'}`);
    console.log(`Replies: ${posts.length}`);
    
    posts.forEach((post, i) => {
      console.log(`\nReply #${i+1} by ${post.name}:`);
      console.log(post.comment);
    });
    
    console.log('\nTest completed successfully!');
  } catch (error) {
    console.error('Test failed:');
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error('Data:', error.response.data);
    } else {
      console.error(error.message);
    }
  }
}

testAPI();