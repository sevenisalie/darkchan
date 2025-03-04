// controllers/thread.js - Update these methods to use the new fileStorage system
const supabase = require('../config/supabase');
const { generateTripcode, verifyTripcode } = require('../utils/fileUtils');
const fileStorage = require('../utils/fileStorage');
const { v4: uuidv4 } = require('uuid');

exports.getThread = async (req, res) => {
    try {
      const threadId = req.params.id;
  
      // Get thread data
      const { data: thread, error: threadError } = await supabase
        .from('threads')
        .select('*')
        .eq('id', threadId)
        .single();
  
      if (threadError) {
        if (threadError.code === 'PGRST116') {
          return res.status(404).json({ error: 'Thread not found' });
        }
        throw threadError;
      }
  
      // Get all posts in the thread
      const { data: posts, error: postsError } = await supabase
        .from('posts')
        .select('*')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true });
  
      if (postsError) throw postsError;
  
      // Return thread with its posts
      res.json({
        thread,
        posts: posts || []
      });
    } catch (err) {
      console.error('Error fetching thread:', err);
      res.status(500).json({ error: 'Failed to fetch thread' });
    }
  };

exports.getThreads = async (req, res) => {
    try {
      // Pagination parameters
      const page = parseInt(req.query.page) || 1;
      const pageSize = parseInt(req.query.pageSize) || 15;
      const offset = (page - 1) * pageSize;
  
      // Query threads ordered by bump time
      const { data: threads, error, count } = await supabase
        .from('threads')
        .select('*', { count: 'exact' })
        .order('bumped_at', { ascending: false })
        .range(offset, offset + pageSize - 1);
  
      if (error) throw error;
  
      // Get preview posts for each thread (up to 3 most recent replies)
      const threadsWithPreviews = await Promise.all(
        threads.map(async (thread) => {
          const { data: posts } = await supabase
            .from('posts')
            .select('*')
            .eq('thread_id', thread.id)
            .order('created_at', { ascending: false })
            .limit(3);
  
          return {
            ...thread,
            preview_posts: posts || []
          };
        })
      );
  
      // Return paginated results
      res.json({
        threads: threadsWithPreviews,
        pagination: {
          total: count,
          page,
          pageSize,
          totalPages: Math.ceil(count / pageSize)
        }
      });
    } catch (err) {
      console.error('Error fetching threads:', err);
      res.status(500).json({ error: 'Failed to fetch threads' });
    }
  };

/**
 * Create a new thread
 */
exports.createThread = async (req, res) => {
  try {
    const { subject, comment, name = 'Anonymous', password, is_nsfw } = req.body;
    const fileData = req.fileData; // From our updated middleware
    const ipAddress = req.ip || req.headers['x-forwarded-for'];

    // Generate tripcode if password is provided
    let tripcode = null;
    if (password) {
      tripcode = generateTripcode(password);
    }

    // Prepare thread data
    const threadData = {
      id: uuidv4(),
      subject: subject || null,
      comment,
      name: name || 'Anonymous',
      tripcode,
      is_nsfw: is_nsfw === 'true' || is_nsfw === true,
      ip_address: ipAddress,
      created_at: new Date(),
      bumped_at: new Date(),
    };

    // Handle file upload if present
    if (fileData) {
      threadData.file_name = fileData.fileName;
      threadData.file_path = fileData.filePath;
      threadData.file_size = fileData.fileSize;
      threadData.file_type = fileData.fileType;
      threadData.thumbnail_path = fileData.thumbnailPath;
      threadData.storage_path = fileData.storagePath; // Store for later deletion
      threadData.images_count = 1;
    }

    // Insert thread into database
    const { data, error } = await supabase
      .from('threads')
      .insert([threadData])
      .select();

    if (error) throw error;

    res.status(201).json({
      message: 'Thread created successfully',
      thread: data[0]
    });
  } catch (err) {
    console.error('Error creating thread:', err);
    
    // Clean up uploaded file on error if it exists
    if (req.fileData && req.fileData.storagePath) {
      await fileStorage.deleteFile(
        req.fileData.storagePath, 
        req.fileData.thumbnailPath
      );
    }
    
    res.status(500).json({ error: 'Failed to create thread' });
  }
};

/**
 * Reply to a thread
 */
exports.replyToThread = async (req, res) => {
  try {
    const threadId = req.params.id;
    const { comment, name = 'Anonymous', password, is_nsfw, reply_to } = req.body;
    const fileData = req.fileData; // From our updated middleware
    const ipAddress = req.ip || req.headers['x-forwarded-for'];

    // Verify thread exists
    const { data: thread, error: threadError } = await supabase
      .from('threads')
      .select('id')
      .eq('id', threadId)
      .single();

    if (threadError) {
      if (threadError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Thread not found' });
      }
      throw threadError;
    }

    // Generate tripcode if password is provided
    let tripcode = null;
    if (password) {
      tripcode = generateTripcode(password);
    }

    // Prepare post data
    const postData = {
      id: uuidv4(),
      thread_id: threadId,
      comment,
      name: name || 'Anonymous',
      tripcode,
      is_nsfw: is_nsfw === 'true' || is_nsfw === true,
      reply_to: reply_to || null,
      ip_address: ipAddress,
      created_at: new Date(),
    };

    // Handle file upload if present
    if (fileData) {
      postData.file_name = fileData.fileName;
      postData.file_path = fileData.filePath;
      postData.file_size = fileData.fileSize;
      postData.file_type = fileData.fileType;
      postData.thumbnail_path = fileData.thumbnailPath;
      postData.storage_path = fileData.storagePath; // Store for later deletion
    }

    // Insert post into database
    const { data, error } = await supabase
      .from('posts')
      .insert([postData])
      .select();

    if (error) throw error;

    // Update thread's bump time
    await supabase
      .from('threads')
      .update({ bumped_at: new Date() })
      .eq('id', threadId);

    res.status(201).json({
      message: 'Reply posted successfully',
      post: data[0]
    });
  } catch (err) {
    console.error('Error creating reply:', err);
    
    // Clean up uploaded file on error if it exists
    if (req.fileData && req.fileData.storagePath) {
      await fileStorage.deleteFile(
        req.fileData.storagePath, 
        req.fileData.thumbnailPath
      );
    }
    
    res.status(500).json({ error: 'Failed to post reply' });
  }
};

/**
 * Delete a thread
 */
exports.deleteThread = async (req, res) => {
  try {
    const threadId = req.params.id;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    // Get thread with tripcode
    const { data: thread, error: threadError } = await supabase
      .from('threads')
      .select('*')
      .eq('id', threadId)
      .single();

    if (threadError) {
      if (threadError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Thread not found' });
      }
      throw threadError;
    }

    // Verify tripcode/password
    if (!thread.tripcode || !verifyTripcode(password, thread.tripcode)) {
      return res.status(403).json({ error: 'Invalid password' });
    }

    // Delete thread
    const { error } = await supabase
      .from('threads')
      .delete()
      .eq('id', threadId);

    if (error) throw error;

    // Clean up files
    if (thread.storage_path) {
      await fileStorage.deleteFile(thread.storage_path, thread.thumbnail_path);
    }

    // Get all posts in the thread and their file paths
    const { data: posts } = await supabase
      .from('posts')
      .select('storage_path, thumbnail_path')
      .eq('thread_id', threadId);

    // Delete all post files
    if (posts && posts.length > 0) {
      for (const post of posts) {
        if (post.storage_path) {
          await fileStorage.deleteFile(post.storage_path, post.thumbnail_path);
        }
      }
    }

    // Delete all posts from the thread (cascade should handle this in DB)
    await supabase
      .from('posts')
      .delete()
      .eq('thread_id', threadId);

    res.json({ message: 'Thread deleted successfully' });
  } catch (err) {
    console.error('Error deleting thread:', err);
    res.status(500).json({ error: 'Failed to delete thread' });
  }
};

/**
 * Delete a post
 */
exports.deletePost = async (req, res) => {
  try {
    const postId = req.params.id;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    // Get post with tripcode
    const { data: post, error: postError } = await supabase
      .from('posts')
      .select('*')
      .eq('id', postId)
      .single();

    if (postError) {
      if (postError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Post not found' });
      }
      throw postError;
    }

    // Verify tripcode/password
    if (!post.tripcode || !verifyTripcode(password, post.tripcode)) {
      return res.status(403).json({ error: 'Invalid password' });
    }

    // Delete post
    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId);

    if (error) throw error;

    // Clean up files
    if (post.storage_path) {
      await fileStorage.deleteFile(post.storage_path, post.thumbnail_path);
    }

    // Update thread counts
    await supabase.rpc('update_thread_counts', { 
      thread_id: post.thread_id,
      images_adjustment: post.file_path ? -1 : 0,
      posts_adjustment: -1
    });

    res.json({ message: 'Post deleted successfully' });
  } catch (err) {
    console.error('Error deleting post:', err);
    res.status(500).json({ error: 'Failed to delete post' });
  }
};

exports.getBoardStats = async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('board_stats')
        .select('*')
        .single();
  
      if (error) throw error;
  
      res.json(data);
    } catch (err) {
      console.error('Error fetching board stats:', err);
      res.status(500).json({ error: 'Failed to fetch board statistics' });
    }
  };