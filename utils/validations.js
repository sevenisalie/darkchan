const Joi = require('joi');

/**
 * Validate thread creation request
 */
exports.validateThread = (req, res, next) => {
  // Define validation schema
  const schema = Joi.object({
    subject: Joi.string().max(100).allow('', null),
    comment: Joi.string().required().min(1).max(10000),
    name: Joi.string().max(50).default('Anonymous'),
    password: Joi.string().allow('', null),
    is_nsfw: Joi.boolean().default(false)
  });

  // Validate request body
  const { error, value } = schema.validate(req.body);
  
  if (error) {
    return res.status(400).json({ 
      error: 'Validation error', 
      details: error.details.map(d => d.message) 
    });
  }

  // Check if either a file or comment is provided
  if (!req.file && (!req.body.comment || req.body.comment.trim() === '')) {
    return res.status(400).json({ 
      error: 'Either an image or comment is required' 
    });
  }

  // Validation passed
  req.body = value;
  next();
};

/**
 * Validate post/reply creation request
 */
exports.validatePost = (req, res, next) => {
  // Define validation schema
  const schema = Joi.object({
    comment: Joi.string().required().min(1).max(10000),
    name: Joi.string().max(50).default('Anonymous'),
    password: Joi.string().allow('', null),
    is_nsfw: Joi.boolean().default(false),
    reply_to: Joi.string().uuid().allow(null)
  });

  // Validate request body
  const { error, value } = schema.validate(req.body);
  
  if (error) {
    return res.status(400).json({ 
      error: 'Validation error', 
      details: error.details.map(d => d.message) 
    });
  }

  // Check if either a file or comment is provided
  if (!req.file && (!req.body.comment || req.body.comment.trim() === '')) {
    return res.status(400).json({ 
      error: 'Either an image or comment is required' 
    });
  }

  // Validation passed
  req.body = value;
  next();
};

/**
 * Validate delete request
 */
exports.validateDelete = (req, res, next) => {
  // Define validation schema
  const schema = Joi.object({
    password: Joi.string().required()
  });

  // Validate request body
  const { error, value } = schema.validate(req.body);
  
  if (error) {
    return res.status(400).json({ 
      error: 'Validation error', 
      details: error.details.map(d => d.message) 
    });
  }

  // Validation passed
  req.body = value;
  next();
};