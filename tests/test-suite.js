// tests/e2e.test.js
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const { v4: uuidv4 } = require('uuid');
const assert = require('assert').strict;

// Configuration
const API_URL = process.env.API_URL || 'http://localhost:3000/api';
const TEST_IMAGE_PATH = path.join(__dirname, '.', 'test-image.jpg');

// Track created resources for cleanup
const testResources = {
  threads: [],
  posts: []
};

// Test utilities
const utils = {
  log: (message) => {
    console.log(`[${new Date().toISOString()}] ${message}`);
  },
  
  error: (message, error) => {
    console.error(`[${new Date().toISOString()}] ERROR: ${message}`);
    if (error) {
      if (error.response) {
        console.error(`Status: ${error.response.status}`);
        console.error('Response:', error.response.data);
      } else {
        console.error(error.message);
      }
    }
  },
  
  // Create a form data object with file if provided
  createFormData: (data, filePath = null) => {
    const form = new FormData();
    
    // Add all data fields
    Object.entries(data).forEach(([key, value]) => {
      form.append(key, value);
    });
    
    // Add file if provided
    if (filePath && fs.existsSync(filePath)) {
      form.append('file', fs.createReadStream(filePath));
    }
    
    return form;
  },
  
  // Check if the response has expected properties
  validateResponse: (response, expectedProperties) => {
    expectedProperties.forEach(prop => {
      assert(response.hasOwnProperty(prop), `Response missing expected property: ${prop}`);
    });
  },
  
  // Check if the thread has expected properties
  validateThread: (thread) => {
    const expectedProps = ['id', 'subject', 'comment', 'name', 'created_at', 'bumped_at'];
    utils.validateResponse(thread, expectedProps);
    
    // If thread has a file, validate file properties
    if (thread.file_path) {
      utils.validateResponse(thread, ['file_name', 'file_size', 'file_type', 'file_path']);
      assert(thread.file_path.includes('http'), 'File path should be a URL');
      
      // If using Supabase Storage, validate storage_path
      if (thread.storage_path) {
        assert(typeof thread.storage_path === 'string', 'storage_path should be a string');
      }
    }
    
    return true;
  },
  
  // Check if the post has expected properties
  validatePost: (post) => {
    const expectedProps = ['id', 'thread_id', 'comment', 'name', 'created_at'];
    utils.validateResponse(post, expectedProps);
    
    // If post has a file, validate file properties
    if (post.file_path) {
      utils.validateResponse(post, ['file_name', 'file_size', 'file_type', 'file_path']);
      assert(post.file_path.includes('http'), 'File path should be a URL');
      
      // If using Supabase Storage, validate storage_path
      if (post.storage_path) {
        assert(typeof post.storage_path === 'string', 'storage_path should be a string');
      }
    }
    
    return true;
  },
  
  // Clean up test resources
  cleanup: async () => {
    utils.log("Running cleanup...");
    
    // Delete created threads
    for (const thread of testResources.threads) {
      try {
        await axios.delete(`${API_URL}/thread/${thread.id}`, {
          data: { password: thread.password }
        });
        utils.log(`✓ Deleted thread ${thread.id}`);
      } catch (error) {
        utils.error(`Failed to delete thread ${thread.id}`, error);
      }
    }
    
    // Delete created posts
    for (const post of testResources.posts) {
      try {
        // Only try to delete posts if their thread wasn't already deleted
        const threadDeleted = testResources.threads.some(t => t.id === post.threadId);
        if (!threadDeleted) {
          await axios.delete(`${API_URL}/post/${post.id}`, {
            data: { password: post.password }
          });
          utils.log(`✓ Deleted post ${post.id}`);
        }
      } catch (error) {
        utils.error(`Failed to delete post ${post.id}`, error);
      }
    }
  }
};

// Test cases
const tests = {
  // Board stats test
  getBoardStats: async () => {
    utils.log("Test: GET /stats - Get board statistics");
    try {
      const response = await axios.get(`${API_URL}/stats`);
      assert.equal(response.status, 200, "Status should be 200");
      
      const { data } = response;
      assert(typeof data.total_threads === 'number', "total_threads should be a number");
      assert(typeof data.total_posts === 'number', "total_posts should be a number");
      assert(typeof data.total_images === 'number', "total_images should be a number");
      
      utils.log("✓ Board stats test passed");
      return true;
    } catch (error) {
      utils.error("Board stats test failed", error);
      return false;
    }
  },
  
  // Thread creation without image
  createThreadWithoutImage: async () => {
    utils.log("Test: POST /thread - Create thread without image");
    try {
      const threadData = {
        subject: `Test Thread ${uuidv4().substring(0, 8)}`,
        comment: 'This is a test thread without an image.',
        name: 'Tester',
        password: 'testpass123'
      };
      
      const form = utils.createFormData(threadData);
      const response = await axios.post(`${API_URL}/thread`, form, {
        headers: form.getHeaders()
      });
      
      assert.equal(response.status, 201, "Status should be 201");
      const { thread } = response.data;
      utils.validateThread(thread);
      
      // Save thread for cleanup
      testResources.threads.push({
        id: thread.id,
        password: threadData.password
      });
      
      utils.log(`✓ Created thread without image: ${thread.id}`);
      return thread.id;
    } catch (error) {
      utils.error("Create thread without image test failed", error);
      return null;
    }
  },
  
  // Thread creation with image
  createThreadWithImage: async () => {
    utils.log("Test: POST /thread - Create thread with image");
    try {
      // Check if test image exists
      if (!fs.existsSync(TEST_IMAGE_PATH)) {
        utils.error(`Test image not found: ${TEST_IMAGE_PATH}`);
        return null;
      }
      
      const threadData = {
        subject: `Test Thread with Image ${uuidv4().substring(0, 8)}`,
        comment: 'This is a test thread with an image attachment.',
        name: 'ImagePoster',
        password: 'imagepass456',
        is_nsfw: 'false'
      };
      
      const form = utils.createFormData(threadData, TEST_IMAGE_PATH);
      const response = await axios.post(`${API_URL}/thread`, form, {
        headers: form.getHeaders()
      });
      
      assert.equal(response.status, 201, "Status should be 201");
      const { thread } = response.data;
      utils.validateThread(thread);
      
      // Verify image properties
      assert(thread.file_path, "Thread should have file_path");
      assert(thread.file_name, "Thread should have file_name");
      assert(thread.file_size > 0, "Thread should have file_size > 0");
      assert(thread.file_type.startsWith('image/'), "Thread should have image file_type");
      
      // If using the new storage system, verify storage_path
      if (thread.storage_path) {
        assert(typeof thread.storage_path === 'string', "Thread should have storage_path string");
      }
      
      // Save thread for cleanup
      testResources.threads.push({
        id: thread.id,
        password: threadData.password
      });
      
      utils.log(`✓ Created thread with image: ${thread.id}`);
      return thread.id;
    } catch (error) {
      utils.error("Create thread with image test failed", error);
      return null;
    }
  },
  
  // Get threads list
  getThreads: async () => {
    utils.log("Test: GET /threads - Get threads list");
    try {
      const response = await axios.get(`${API_URL}/threads`);
      assert.equal(response.status, 200, "Status should be 200");
      
      const { threads, pagination } = response.data;
      assert(Array.isArray(threads), "threads should be an array");
      assert(threads.length > 0, "threads array should not be empty");
      assert(pagination, "response should include pagination");
      assert(typeof pagination.total === 'number', "pagination should include total count");
      
      // Validate first thread
      utils.validateThread(threads[0]);
      
      utils.log("✓ Get threads test passed");
      return true;
    } catch (error) {
      utils.error("Get threads test failed", error);
      return false;
    }
  },
  
  // Get specific thread
  getThread: async (threadId) => {
    utils.log(`Test: GET /thread/${threadId} - Get specific thread`);
    try {
      const response = await axios.get(`${API_URL}/thread/${threadId}`);
      assert.equal(response.status, 200, "Status should be 200");
      
      const { thread, posts } = response.data;
      utils.validateThread(thread);
      assert.equal(thread.id, threadId, "Thread ID should match");
      assert(Array.isArray(posts), "posts should be an array");
      
      utils.log(`✓ Get thread test passed: ${threadId}`);
      return true;
    } catch (error) {
      utils.error(`Get thread test failed: ${threadId}`, error);
      return false;
    }
  },
  
  // Reply to thread without image
  replyToThread: async (threadId) => {
    utils.log(`Test: POST /thread/${threadId}/reply - Reply without image`);
    try {
      const replyData = {
        comment: `Test reply ${uuidv4().substring(0, 8)}`,
        name: 'Replier',
        password: 'replypass123'
      };
      
      const form = utils.createFormData(replyData);
      const response = await axios.post(`${API_URL}/thread/${threadId}/reply`, form, {
        headers: form.getHeaders()
      });
      
      assert.equal(response.status, 201, "Status should be 201");
      const { post } = response.data;
      utils.validatePost(post);
      assert.equal(post.thread_id, threadId, "Post should reference correct thread");
      
      // Save post for cleanup
      testResources.posts.push({
        id: post.id,
        threadId: threadId,
        password: replyData.password
      });
      
      utils.log(`✓ Reply to thread test passed: ${post.id}`);
      return post.id;
    } catch (error) {
      utils.error(`Reply to thread test failed: ${threadId}`, error);
      return null;
    }
  },
  
  // Reply to thread with image
  replyWithImage: async (threadId) => {
    utils.log(`Test: POST /thread/${threadId}/reply - Reply with image`);
    try {
      const replyData = {
        comment: `Test reply with image ${uuidv4().substring(0, 8)}`,
        name: 'ImageReplier',
        password: 'replyimgpass456'
      };
      
      const form = utils.createFormData(replyData, TEST_IMAGE_PATH);
      const response = await axios.post(`${API_URL}/thread/${threadId}/reply`, form, {
        headers: form.getHeaders()
      });
      
      assert.equal(response.status, 201, "Status should be 201");
      const { post } = response.data;
      utils.validatePost(post);
      
      // Verify image properties
      assert(post.file_path, "Post should have file_path");
      assert(post.file_name, "Post should have file_name");
      assert(post.file_size > 0, "Post should have file_size > 0");
      assert(post.file_type.startsWith('image/'), "Post should have image file_type");
      
      // If using the new storage system, verify storage_path
      if (post.storage_path) {
        assert(typeof post.storage_path === 'string', "Post should have storage_path string");
      }
      
      // Save post for cleanup
      testResources.posts.push({
        id: post.id,
        threadId: threadId,
        password: replyData.password
      });
      
      utils.log(`✓ Reply with image test passed: ${post.id}`);
      return post.id;
    } catch (error) {
      utils.error(`Reply with image test failed: ${threadId}`, error);
      return null;
    }
  },
  
  // Test invalid requests
  testInvalidRequests: async () => {
    utils.log("Test: Invalid requests");
    let passed = true;
    
    // Test non-existent thread
    try {
      const fakeId = uuidv4();
      await axios.get(`${API_URL}/thread/${fakeId}`);
      utils.error("Should have failed with 404 for non-existent thread");
      passed = false;
    } catch (error) {
      if (error.response && error.response.status === 404) {
        utils.log("✓ Correctly received 404 for non-existent thread");
      } else {
        utils.error("Unexpected error for non-existent thread", error);
        passed = false;
      }
    }
    
    // Test reply to non-existent thread
    try {
      const fakeId = uuidv4();
      const form = utils.createFormData({ comment: "This shouldn't work" });
      await axios.post(`${API_URL}/thread/${fakeId}/reply`, form, {
        headers: form.getHeaders()
      });
      utils.error("Should have failed with 404 for reply to non-existent thread");
      passed = false;
    } catch (error) {
      if (error.response && error.response.status === 404) {
        utils.log("✓ Correctly received 404 for reply to non-existent thread");
      } else {
        utils.error("Unexpected error for reply to non-existent thread", error);
        passed = false;
      }
    }
    
    // Test empty comment submission
    try {
      const form = utils.createFormData({ comment: "" });
      await axios.post(`${API_URL}/thread`, form, {
        headers: form.getHeaders()
      });
      utils.error("Should have failed with 400 for empty comment");
      passed = false;
    } catch (error) {
      if (error.response && error.response.status === 400) {
        utils.log("✓ Correctly received 400 for empty comment");
      } else {
        utils.error("Unexpected error for empty comment", error);
        passed = false;
      }
    }
    
    return passed;
  },
  
  // Test authentication (wrong password)
  testAuthentication: async (threadId, postId) => {
    utils.log("Test: Authentication (wrong password)");
    let passed = true;
    
    // Test wrong password for thread deletion
    if (threadId) {
      try {
        await axios.delete(`${API_URL}/thread/${threadId}`, {
          data: { password: 'wrongpassword' }
        });
        utils.error("Should have failed with 403 for wrong thread password");
        passed = false;
      } catch (error) {
        if (error.response && error.response.status === 403) {
          utils.log("✓ Correctly received 403 for wrong thread password");
        } else {
          utils.error("Unexpected error for wrong thread password", error);
          passed = false;
        }
      }
    }
    
    // Test wrong password for post deletion
    if (postId) {
      try {
        await axios.delete(`${API_URL}/post/${postId}`, {
          data: { password: 'wrongpassword' }
        });
        utils.error("Should have failed with 403 for wrong post password");
        passed = false;
      } catch (error) {
        if (error.response && error.response.status === 403) {
          utils.log("✓ Correctly received 403 for wrong post password");
        } else {
          utils.error("Unexpected error for wrong post password", error);
          passed = false;
        }
      }
    }
    
    return passed;
  },
  
  // Test deletion
  testDeletion: async () => {
    utils.log("Test: Deletion");
    let passed = true;
    
    // Create a thread specifically for deletion testing
    let threadId = null;
    try {
      const threadData = {
        subject: `Deletion Test Thread ${uuidv4().substring(0, 8)}`,
        comment: 'This thread will be deleted.',
        name: 'Tester',
        password: 'deletepass'
      };
      
      const form = utils.createFormData(threadData);
      const response = await axios.post(`${API_URL}/thread`, form, {
        headers: form.getHeaders()
      });
      
      threadId = response.data.thread.id;
      utils.log(`Created thread for deletion test: ${threadId}`);
    } catch (error) {
      utils.error("Failed to create thread for deletion test", error);
      return false;
    }
    
    // Create a post specifically for deletion testing
    let postId = null;
    if (threadId) {
      try {
        const postData = {
          comment: 'This post will be deleted.',
          name: 'Tester',
          password: 'deletepostpass'
        };
        
        const form = utils.createFormData(postData);
        const response = await axios.post(`${API_URL}/thread/${threadId}/reply`, form, {
          headers: form.getHeaders()
        });
        
        postId = response.data.post.id;
        utils.log(`Created post for deletion test: ${postId}`);
      } catch (error) {
        utils.error("Failed to create post for deletion test", error);
        passed = false;
      }
    }
    
    // Test post deletion
    if (postId) {
      try {
        const response = await axios.delete(`${API_URL}/post/${postId}`, {
          data: { password: 'deletepostpass' }
        });
        
        assert.equal(response.status, 200, "Status should be 200");
        utils.log(`✓ Successfully deleted post: ${postId}`);
      } catch (error) {
        utils.error(`Failed to delete post: ${postId}`, error);
        passed = false;
      }
    }
    
    // Test thread deletion
    if (threadId) {
      try {
        const response = await axios.delete(`${API_URL}/thread/${threadId}`, {
          data: { password: 'deletepass' }
        });
        
        assert.equal(response.status, 200, "Status should be 200");
        utils.log(`✓ Successfully deleted thread: ${threadId}`);
      } catch (error) {
        utils.error(`Failed to delete thread: ${threadId}`, error);
        passed = false;
      }
    }
    
    return passed;
  }
};

/**
 * Run the end-to-end test suite
 */
async function runE2ETests() {
  utils.log("Starting E2E test suite for /b/ chan API");
  const results = {
    total: 0,
    passed: 0,
    failed: 0
  };
  
  try {
    // Check if test image exists
    if (!fs.existsSync(TEST_IMAGE_PATH)) {
      utils.log("Creating test image...");
      try {
        // Create a simple test image if it doesn't exist
        require('../create-test-image');
        utils.log("Test image created successfully");
      } catch (error) {
        utils.error("Failed to create test image", error);
        return;
      }
    }
    
    // Board statistics test
    results.total++;
    results.passed += await tests.getBoardStats() ? 1 : 0;
    
    // Thread creation tests
    results.total++;
    const threadId1 = await tests.createThreadWithoutImage();
    results.passed += threadId1 ? 1 : 0;
    
    results.total++;
    const threadId2 = await tests.createThreadWithImage();
    results.passed += threadId2 ? 1 : 0;
    
    // Get threads test
    results.total++;
    results.passed += await tests.getThreads() ? 1 : 0;
    
    // Get specific thread test
    if (threadId1) {
      results.total++;
      results.passed += await tests.getThread(threadId1) ? 1 : 0;
    }
    
    // Reply tests
    let postId1 = null;
    let postId2 = null;
    
    if (threadId1) {
      results.total++;
      postId1 = await tests.replyToThread(threadId1);
      results.passed += postId1 ? 1 : 0;
    }
    
    if (threadId2) {
      results.total++;
      postId2 = await tests.replyWithImage(threadId2);
      results.passed += postId2 ? 1 : 0;
    }
    
    // Authentication tests
    results.total++;
    results.passed += await tests.testAuthentication(threadId1, postId1) ? 1 : 0;
    
    // Invalid request tests
    results.total++;
    results.passed += await tests.testInvalidRequests() ? 1 : 0;
    
    // Deletion tests
    results.total++;
    results.passed += await tests.testDeletion() ? 1 : 0;
    
    // Calculate results
    results.failed = results.total - results.passed;
    
  } catch (error) {
    utils.error("Unexpected error during test execution", error);
  } finally {
    // Display results
    utils.log("\n----- TEST RESULTS -----");
    utils.log(`Total tests: ${results.total}`);
    utils.log(`Passed: ${results.passed}`);
    utils.log(`Failed: ${results.failed}`);
    utils.log(`Success rate: ${Math.round((results.passed / results.total) * 100)}%`);
    
    // Run cleanup
    await utils.cleanup();
    
    utils.log("Test suite completed");
    
    // Return non-zero exit code if any tests failed
    if (results.failed > 0) {
      process.exit(1);
    }
  }
}

// Run tests if called directly
if (require.main === module) {
  runE2ETests();
} else {
  module.exports = {
    runE2ETests,
    tests
  };
}