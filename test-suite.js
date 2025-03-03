const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { FormData } = require('formdata-node');
const { fileFromPath } = require('formdata-node/file-from-path');
const assert = require('assert').strict;

// Configuration
const API_URL = 'http://localhost:3000/api';
const TEST_IMAGE_PATH = path.join(__dirname, 'test-image.jpg');

// Global test state
const testState = {
  createdThreads: [],
  createdPosts: []
};

/**
 * Test utilities
 */
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
  
  assertSuccess: (response, message) => {
    assert(response.status >= 200 && response.status < 300, 
      `Expected success status code, got ${response.status}`);
    utils.log(`✓ ${message}`);
  },
  
  cleanup: async () => {
    utils.log("Running cleanup...");
    
    // Track deleted thread IDs
    const deletedThreadIds = new Set();
    
    // Delete created threads
    for (const thread of testState.createdThreads) {
      if (thread.id && thread.password) {
        try {
          await axios.delete(`${API_URL}/thread/${thread.id}`, {
            data: { password: thread.password }
          });
          utils.log(`✓ Deleted thread ${thread.id}`);
          deletedThreadIds.add(thread.id);
        } catch (error) {
          utils.error(`Failed to delete thread ${thread.id}`, error);
        }
      }
    }
    
    // Delete created posts - but only if their thread wasn't already deleted
    for (const post of testState.createdPosts) {
      if (post.id && post.password && post.threadId && !deletedThreadIds.has(post.threadId)) {
        try {
          await axios.delete(`${API_URL}/post/${post.id}`, {
            data: { password: post.password }
          });
          utils.log(`✓ Deleted post ${post.id}`);
        } catch (error) {
          utils.error(`Failed to delete post ${post.id}`, error);
        }
      }
    }
  }
};

/**
 * Test cases
 */
const tests = {
  getBoardStats: async () => {
    utils.log("Testing GET /stats");
    try {
      const response = await axios.get(`${API_URL}/stats`);
      utils.assertSuccess(response, "Got board stats");
      
      // Verify structure
      const { data } = response;
      assert(typeof data.total_threads === 'number', "total_threads should be a number");
      assert(typeof data.total_posts === 'number', "total_posts should be a number");
      assert(typeof data.total_images === 'number', "total_images should be a number");
      
      return true;
    } catch (error) {
      utils.error("getBoardStats failed", error);
      return false;
    }
  },
  
  createThreadWithoutImage: async () => {
    utils.log("Testing POST /thread (no image)");
    try {
      // Create form data
      const form = new FormData();
      form.set('subject', 'Test Thread No Image');
      form.set('comment', 'This is a test thread without an image.');
      form.set('name', 'Tester');
      form.set('password', 'testpass123');
      
      const response = await axios.post(`${API_URL}/thread`, form, {
        headers: { ...form.headers }
      });
      
      utils.assertSuccess(response, "Created thread without image");
      
      // Verify structure
      const { thread } = response.data;
      assert(thread.id, "Thread should have ID");
      assert.equal(thread.name, 'Tester', "Thread should have correct name");
      assert.equal(thread.subject, 'Test Thread No Image', "Thread should have correct subject");
      assert.equal(thread.file_path, null, "Thread should not have file");
      
      // Save thread for cleanup
      testState.createdThreads.push({
        id: thread.id,
        password: 'testpass123'
      });
      
      return thread.id;
    } catch (error) {
      utils.error("createThreadWithoutImage failed", error);
      return null;
    }
  },
  
  createThreadWithImage: async () => {
    utils.log("Testing POST /thread (with image)");
    try {
      // Check if test image exists
      if (!fs.existsSync(TEST_IMAGE_PATH)) {
        utils.error(`Test image not found at: ${TEST_IMAGE_PATH}`);
        return null;
      }
      
      // Create form data
      const form = new FormData();
      form.set('subject', 'Test Thread With Image');
      form.set('comment', 'This is a test thread with an image.');
      form.set('name', 'Tester');
      form.set('password', 'testpass456');
      form.set('is_nsfw', 'true');
      
      // Add file
      const file = await fileFromPath(TEST_IMAGE_PATH, {
        type: 'image/jpeg',
        filename: 'test-image.jpg'
      });
      form.set('file', file);
      
      const response = await axios.post(`${API_URL}/thread`, form, {
        headers: { ...form.headers }
      });
      
      utils.assertSuccess(response, "Created thread with image");
      
      // Verify structure
      const { thread } = response.data;
      assert(thread.id, "Thread should have ID");
      assert.equal(thread.name, 'Tester', "Thread should have correct name");
      assert.equal(thread.subject, 'Test Thread With Image', "Thread should have correct subject");
      assert(thread.file_path, "Thread should have file path");
      assert(thread.thumbnail_path, "Thread should have thumbnail path");
      assert.equal(thread.is_nsfw, true, "Thread should be marked NSFW");
      
      // Save thread for cleanup
      testState.createdThreads.push({
        id: thread.id,
        password: 'testpass456'
      });
      
      return thread.id;
    } catch (error) {
      utils.error("createThreadWithImage failed", error);
      return null;
    }
  },
  
  getThreads: async () => {
    utils.log("Testing GET /threads");
    try {
      const response = await axios.get(`${API_URL}/threads`);
      utils.assertSuccess(response, "Got threads list");
      
      // Verify structure
      const { threads, pagination } = response.data;
      assert(Array.isArray(threads), "threads should be an array");
      assert(pagination, "response should include pagination");
      assert(typeof pagination.total === 'number', "pagination should include total count");
      
      // Check thread structure
      if (threads.length > 0) {
        const thread = threads[0];
        assert(thread.id, "Thread should have ID");
        assert(thread.comment, "Thread should have comment");
        assert('preview_posts' in thread, "Thread should have preview_posts property");
      }
      
      return true;
    } catch (error) {
      utils.error("getThreads failed", error);
      return false;
    }
  },
  
  getThread: async (threadId) => {
    utils.log(`Testing GET /thread/${threadId}`);
    try {
      const response = await axios.get(`${API_URL}/thread/${threadId}`);
      utils.assertSuccess(response, "Got thread details");
      
      // Verify structure
      const { thread, posts } = response.data;
      assert(thread.id, "Thread should have ID");
      assert.equal(thread.id, threadId, "Thread ID should match");
      assert(Array.isArray(posts), "posts should be an array");
      
      return true;
    } catch (error) {
      utils.error("getThread failed", error);
      return false;
    }
  },
  
  getNonExistentThread: async () => {
    utils.log("Testing GET /thread/non-existent");
    try {
      // Generate a random UUID that shouldn't exist
      const fakeId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
      
      await axios.get(`${API_URL}/thread/${fakeId}`);
      utils.error("Expected 404 error but got success");
      return false;
    } catch (error) {
      if (error.response && error.response.status === 404) {
        utils.log("✓ Got expected 404 for non-existent thread");
        return true;
      } else {
        utils.error("getNonExistentThread failed with unexpected error", error);
        return false;
      }
    }
  },
  
  replyToThread: async (threadId) => {
    utils.log(`Testing POST /thread/${threadId}/reply`);
    try {
      // Create form data
      const form = new FormData();
      form.set('comment', 'This is a test reply.');
      form.set('name', 'Replier');
      form.set('password', 'replypass123');
      
      const response = await axios.post(`${API_URL}/thread/${threadId}/reply`, form, {
        headers: { ...form.headers }
      });
      
      utils.assertSuccess(response, "Posted reply to thread");
      
      // Verify structure
      const { post } = response.data;
      assert(post.id, "Post should have ID");
      assert.equal(post.thread_id, threadId, "Post should reference correct thread");
      assert.equal(post.name, 'Replier', "Post should have correct name");
      
      // Save post for cleanup
      testState.createdPosts.push({
        id: post.id,
        threadId: threadId,
        password: 'replypass123'
      });
      
      return post.id;
    } catch (error) {
      utils.error("replyToThread failed", error);
      return null;
    }
  },
  
  replyWithImage: async (threadId) => {
    utils.log(`Testing POST /thread/${threadId}/reply (with image)`);
    try {
      // Create form data
      const form = new FormData();
      form.set('comment', 'This is a test reply with image.');
      form.set('name', 'Replier');
      form.set('password', 'replypass456');
      
      // Add file
      const file = await fileFromPath(TEST_IMAGE_PATH, {
        type: 'image/jpeg',
        filename: 'reply-image.jpg'
      });
      form.set('file', file);
      
      const response = await axios.post(`${API_URL}/thread/${threadId}/reply`, form, {
        headers: { ...form.headers }
      });
      
      utils.assertSuccess(response, "Posted reply with image");
      
      // Verify structure
      const { post } = response.data;
      assert(post.id, "Post should have ID");
      assert.equal(post.thread_id, threadId, "Post should reference correct thread");
      assert(post.file_path, "Post should have file path");
      
      // Save post for cleanup
      testState.createdPosts.push({
        id: post.id,
        threadId: threadId,
        password: 'replypass456'
      });
      
      return post.id;
    } catch (error) {
      utils.error("replyWithImage failed", error);
      return null;
    }
  },
  
  replyToNonExistentThread: async () => {
    utils.log("Testing POST /thread/non-existent/reply");
    try {
      // Generate a random UUID that shouldn't exist
      const fakeId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
      
      const form = new FormData();
      form.set('comment', 'This is a test reply to a non-existent thread.');
      
      await axios.post(`${API_URL}/thread/${fakeId}/reply`, form, {
        headers: { ...form.headers }
      });
      
      utils.error("Expected 404 error but got success");
      return false;
    } catch (error) {
      if (error.response && error.response.status === 404) {
        utils.log("✓ Got expected 404 for reply to non-existent thread");
        return true;
      } else {
        utils.error("replyToNonExistentThread failed with unexpected error", error);
        return false;
      }
    }
  },
  
  deletePost: async (postId, password) => {
    utils.log(`Testing DELETE /post/${postId}`);
    try {
      const response = await axios.delete(`${API_URL}/post/${postId}`, {
        data: { password }
      });
      
      utils.assertSuccess(response, "Deleted post");
      return true;
    } catch (error) {
      utils.error("deletePost failed", error);
      return false;
    }
  },
  
  deletePostWithWrongPassword: async (postId) => {
    utils.log(`Testing DELETE /post/${postId} (wrong password)`);
    try {
      await axios.delete(`${API_URL}/post/${postId}`, {
        data: { password: 'wrongpassword' }
      });
      
      utils.error("Expected authentication error but got success");
      return false;
    } catch (error) {
      if (error.response && error.response.status === 403) {
        utils.log("✓ Got expected 403 for wrong password");
        return true;
      } else {
        utils.error("deletePostWithWrongPassword failed with unexpected error", error);
        return false;
      }
    }
  },
  
  deleteThread: async (threadId, password) => {
    utils.log(`Testing DELETE /thread/${threadId}`);
    try {
      const response = await axios.delete(`${API_URL}/thread/${threadId}`, {
        data: { password }
      });
      
      utils.assertSuccess(response, "Deleted thread");
      return true;
    } catch (error) {
      utils.error("deleteThread failed", error);
      return false;
    }
  },
  
  deleteThreadWithWrongPassword: async (threadId) => {
    utils.log(`Testing DELETE /thread/${threadId} (wrong password)`);
    try {
      await axios.delete(`${API_URL}/thread/${threadId}`, {
        data: { password: 'wrongpassword' }
      });
      
      utils.error("Expected authentication error but got success");
      return false;
    } catch (error) {
      if (error.response && error.response.status === 403) {
        utils.log("✓ Got expected 403 for wrong password");
        return true;
      } else {
        utils.error("deleteThreadWithWrongPassword failed with unexpected error", error);
        return false;
      }
    }
  }
};

/**
 * Run all tests
 */
async function runTests() {
  utils.log("Starting comprehensive API test suite");
  const results = {
    total: 0,
    passed: 0,
    failed: 0
  };
  
  try {
    // Ensure test image exists
    if (!fs.existsSync(TEST_IMAGE_PATH)) {
      utils.error(`Test image not found at: ${TEST_IMAGE_PATH}`);
      utils.log("Please create a test image first or run the create-test-image.js script");
      return;
    }
    
    // Test board stats
    results.total++;
    results.passed += await tests.getBoardStats() ? 1 : 0;
    
    // Test thread creation
    results.total++;
    const threadId1 = await tests.createThreadWithoutImage();
    results.passed += threadId1 ? 1 : 0;
    
    results.total++;
    const threadId2 = await tests.createThreadWithImage();
    results.passed += threadId2 ? 1 : 0;
    
    // Test getting threads
    results.total++;
    results.passed += await tests.getThreads() ? 1 : 0;
    
    if (threadId1) {
      // Test getting specific thread
      results.total++;
      results.passed += await tests.getThread(threadId1) ? 1 : 0;
      
      // Test replying to thread
      results.total++;
      const replyId1 = await tests.replyToThread(threadId1);
      results.passed += replyId1 ? 1 : 0;
      
      // Test replying with image
      results.total++;
      const replyId2 = await tests.replyWithImage(threadId1);
      results.passed += replyId2 ? 1 : 0;
      
      // Test deleting post with wrong password
      if (replyId1) {
        results.total++;
        results.passed += await tests.deletePostWithWrongPassword(replyId1) ? 1 : 0;
      }
      
      // Test deleting thread with wrong password
      results.total++;
      results.passed += await tests.deleteThreadWithWrongPassword(threadId1) ? 1 : 0;
    }
    
    // Test getting non-existent thread
    results.total++;
    results.passed += await tests.getNonExistentThread() ? 1 : 0;
    
    // Test replying to non-existent thread
    results.total++;
    results.passed += await tests.replyToNonExistentThread() ? 1 : 0;
    
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
  }
}

// Run tests
runTests();