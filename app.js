const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const bodyParser = require('body-parser');
const rateLimit = require('./middlewares/rateLimit');

// Create Express app
const app = express();

// Basic middleware setup
app.use(helmet());
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// This exists because Render uses a proxy to send requests to the API; The proxy sits at 1st child proxy position
app.set('trust proxy', 1);

// Rate limiting
app.use(rateLimit);

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, process.env.UPLOAD_DIRECTORY || 'uploads')));

// API routes
app.use('/api', require('./routes/api'));

// Simple status endpoint
app.get('/status', (req, res) => {
  res.json({ status: 'OK', boardName: '/b/', time: new Date() });
});

// Root path redirects to status
app.get('/', (req, res) => {
  res.redirect('/status');
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  
  // Handle specific error types
  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message });
  }
  
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({ error: 'Invalid or missing authentication' });
  }
  
  // Default error response
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'Something went wrong' 
      : err.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

module.exports = app;