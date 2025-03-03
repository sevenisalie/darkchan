const express = require('express');
const router = express.Router();
const threadController = require('../controllers/thread');
const fileUpload = require('../middlewares/fileUpload');
const { validateThread, validatePost } = require('../utils/validations');

/**
 * Thread routes
 */

// Get all threads (paginated)
router.get('/threads', threadController.getThreads);

// Get a specific thread with its replies
router.get('/thread/:id', threadController.getThread);

// Create a new thread
router.post('/thread', 
  fileUpload.single('file'),
  validateThread, 
  threadController.createThread
);

// Reply to a thread
router.post('/thread/:id/reply', 
  fileUpload.single('file'),
  validatePost, 
  threadController.replyToThread
);

// Delete a thread (with tripcode verification)
router.delete('/thread/:id', threadController.deleteThread);

/**
 * Post routes
 */

// Delete a post (with tripcode verification)
router.delete('/post/:id', threadController.deletePost);

/**
 * Board stats
 */

// Get board statistics
router.get('/stats', threadController.getBoardStats);

module.exports = router;