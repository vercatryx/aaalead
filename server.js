import express from 'express';
import multer from 'multer';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, readdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get public path - __dirname is where server.js is (project root)
const publicPath = join(__dirname, 'public');

// Load environment variables
dotenv.config({ path: '.env.local' });

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const isProduction = process.env.NODE_ENV === 'production';

// CORS configuration (only needed in development when React runs separately)
if (!isProduction) {
  app.use(cors({
    origin: process.env.REACT_APP_URL || 'http://localhost:3000',
    credentials: true
  }));
}

app.use(express.json());

// Explicitly serve template files FIRST (before static middleware)
app.get('/templates/:filename', (req, res) => {
  const filename = decodeURIComponent(req.params.filename);
  const templatesPath = join(publicPath, 'templates');
  const filePath = join(templatesPath, filename);
  
  if (!existsSync(filePath)) {
    return res.status(404).json({ error: 'Template file not found', file: filename });
  }
  
  res.sendFile(filePath);
});

app.head('/templates/:filename', (req, res) => {
  const filename = decodeURIComponent(req.params.filename);
  const templatesPath = join(publicPath, 'templates');
  const filePath = join(templatesPath, filename);
  
  if (!existsSync(filePath)) {
    return res.status(404).json({ error: 'Template file not found', file: filename });
  }
  
  const fs = require('fs');
  const stats = fs.statSync(filePath);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Length', stats.size);
  res.setHeader('Accept-Ranges', 'bytes');
  res.status(200).end();
});

// Serve static files from public folder (for other assets)
if (existsSync(publicPath)) {
  app.use(express.static(publicPath));
  console.log('📁 Serving static files from:', publicPath);
}

// Initialize R2 client
const r2Client = new S3Client({
  region: 'auto',
  endpoint: process.env.REACT_APP_R2_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.REACT_APP_R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.REACT_APP_R2_SECRET_ACCESS_KEY,
  },
});

const R2_BUCKET_NAME = process.env.REACT_APP_R2_BUCKET_NAME || 'lead-main';

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    r2Configured: !!(
      process.env.REACT_APP_R2_ENDPOINT &&
      process.env.REACT_APP_R2_ACCESS_KEY_ID &&
      process.env.REACT_APP_R2_SECRET_ACCESS_KEY &&
      R2_BUCKET_NAME
    )
  });
});

// Upload endpoint
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const { key } = req.body;
    if (!key) {
      return res.status(400).json({ error: 'No key provided' });
    }

    console.log('📤 Uploading to R2:', {
      key,
      fileName: req.file.originalname,
      size: req.file.size,
      contentType: req.file.mimetype,
      bucket: R2_BUCKET_NAME
    });

    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype || 'application/octet-stream',
    });

    await r2Client.send(command);
    
    console.log('✅ Upload successful:', key);
    res.json({ success: true, key });
  } catch (error) {
    console.error('❌ Upload error:', error);
    res.status(500).json({ 
      error: 'Upload failed',
      message: error.message,
      details: error.toString()
    });
  }
});

// Test R2 connection endpoint
app.get('/api/test-r2', async (req, res) => {
  try {
    const testKey = `test/connection-test-${Date.now()}.txt`;
    const testContent = 'R2 connection test';
    
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: testKey,
      Body: Buffer.from(testContent),
      ContentType: 'text/plain',
    });

    await r2Client.send(command);
    res.json({ 
      success: true, 
      message: 'R2 connection successful',
      testKey 
    });
  } catch (error) {
    console.error('❌ R2 test error:', error);
    res.status(500).json({ 
      error: 'R2 connection failed',
      message: error.message,
      details: error.toString(),
      config: {
        hasEndpoint: !!process.env.REACT_APP_R2_ENDPOINT,
        hasAccessKey: !!process.env.REACT_APP_R2_ACCESS_KEY_ID,
        hasSecretKey: !!process.env.REACT_APP_R2_SECRET_ACCESS_KEY,
        bucket: R2_BUCKET_NAME,
        endpoint: process.env.REACT_APP_R2_ENDPOINT
      }
    });
  }
});

// Serve React app in production
if (isProduction) {
  const buildPath = join(__dirname, 'build');
  if (existsSync(buildPath)) {
    app.use(express.static(buildPath));
    app.get('*', (req, res) => {
      res.sendFile(join(buildPath, 'index.html'));
    });
  }
}

const PORT = process.env.PORT || (isProduction ? 3000 : 3001);
app.listen(PORT, () => {
  if (isProduction) {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log('   Serving React app + API');
  } else {
    console.log(`🚀 API server running on http://localhost:${PORT}`);
    console.log('   React app should be running on http://localhost:3000');
  }
  console.log('📋 R2 Configuration:');
  console.log(`   Endpoint: ${process.env.REACT_APP_R2_ENDPOINT || 'NOT SET'}`);
  console.log(`   Bucket: ${R2_BUCKET_NAME}`);
  console.log(`   Access Key: ${process.env.REACT_APP_R2_ACCESS_KEY_ID ? 'SET' : 'NOT SET'}`);
  console.log(`   Secret Key: ${process.env.REACT_APP_R2_SECRET_ACCESS_KEY ? 'SET' : 'NOT SET'}`);
});
