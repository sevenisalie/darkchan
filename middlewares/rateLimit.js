const rateLimit = require('express-rate-limit');

// Configure rate limit settings from environment variables
const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000; // 1 minute default
const maxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 10; // 10 requests default

// Create and export the rate limiter middleware
const limiter = rateLimit({
  windowMs,
  max: maxRequests,
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    error: 'Too many requests, please try again later.',
    retryAfter: Math.ceil(windowMs / 1000)
  },
  // Add IP whitelist for specific trusted clients if needed
  skip: (req) => {
    // Example: Skip rate limiting for specific IPs or admin routes
    // return req.ip === '127.0.0.1' || req.path.startsWith('/admin');
    return false;
  }
});

module.exports = limiter;