import express from 'express';
import multer from 'multer';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, readdirSync } from 'fs';
import * as dbModels from './db/models.js';

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
app.use(express.urlencoded({ extended: true }));

// ==================== DATABASE API ENDPOINTS ====================

// Get all data
app.get('/api/data', async (req, res) => {
  try {
    const data = dbModels.getAllData();
    res.json(data);
  } catch (error) {
    console.error('Error getting all data:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== INSPECTORS ====================

app.get('/api/inspectors', (req, res) => {
  try {
    const inspectors = dbModels.getAllInspectors();
    res.json(inspectors.map(i => ({
      id: i.id,
      name: i.name,
      variableValues: i.variableValues ? Array.from(i.variableValues.entries()) : undefined
    })));
  } catch (error) {
    console.error('Error getting inspectors:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/inspectors/:id', (req, res) => {
  try {
    const { id } = req.params;
    const inspector = dbModels.getInspectorById(id);
    if (!inspector) {
      return res.status(404).json({ error: 'Inspector not found' });
    }
    res.json({
      id: inspector.id,
      name: inspector.name,
      variableValues: inspector.variableValues ? Array.from(inspector.variableValues.entries()) : undefined
    });
  } catch (error) {
    console.error('Error getting inspector:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/inspectors', (req, res) => {
  try {
    const { id, name } = req.body;
    if (!id || !name) {
      return res.status(400).json({ error: 'id and name are required' });
    }
    const inspector = dbModels.createInspector(id, name);
    res.json({
      id: inspector.id,
      name: inspector.name,
      variableValues: inspector.variableValues ? Array.from(inspector.variableValues.entries()) : undefined
    });
  } catch (error) {
    console.error('Error creating inspector:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/inspectors/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }
    const inspector = dbModels.updateInspector(id, name);
    if (!inspector) {
      return res.status(404).json({ error: 'Inspector not found' });
    }
    res.json({
      id: inspector.id,
      name: inspector.name,
      variableValues: inspector.variableValues ? Array.from(inspector.variableValues.entries()) : undefined
    });
  } catch (error) {
    console.error('Error updating inspector:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/inspectors/:id', (req, res) => {
  try {
    const { id } = req.params;
    dbModels.deleteInspector(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting inspector:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== INSPECTOR VARIABLES ====================

app.put('/api/inspectors/:id/variables/:variableName', (req, res) => {
  try {
    const { id, variableName } = req.params;
    const { value } = req.body;
    if (value) {
      dbModels.setInspectorVariable(id, variableName, value);
    } else {
      dbModels.deleteInspectorVariable(id, variableName);
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error setting inspector variable:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/inspectors/:id/variables/:variableName', (req, res) => {
  try {
    const { id, variableName } = req.params;
    dbModels.deleteInspectorVariable(id, variableName);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting inspector variable:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== INSPECTOR VARIABLE NAMES (Global) ====================

app.get('/api/inspector-variable-names', (req, res) => {
  try {
    const names = dbModels.getAllInspectorVariableNames();
    res.json(names);
  } catch (error) {
    console.error('Error getting inspector variable names:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/inspector-variable-names', (req, res) => {
  try {
    const { variableName } = req.body;
    if (!variableName) {
      return res.status(400).json({ error: 'variableName is required' });
    }
    dbModels.addInspectorVariableName(variableName);
    res.json({ success: true });
  } catch (error) {
    console.error('Error adding inspector variable name:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/inspector-variable-names/:variableName', (req, res) => {
  try {
    const { variableName } = req.params;
    dbModels.deleteInspectorVariableName(variableName);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting inspector variable name:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== DOCUMENT TYPES ====================

app.get('/api/document-types/:category', (req, res) => {
  try {
    const { category } = req.params;
    const types = dbModels.getDocumentTypes(category);
    res.json(types);
  } catch (error) {
    console.error('Error getting document types:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/document-types', (req, res) => {
  try {
    const { type, category } = req.body;
    if (!type || !category) {
      return res.status(400).json({ error: 'type and category are required' });
    }
    dbModels.addDocumentType(type, category);
    res.json({ success: true });
  } catch (error) {
    console.error('Error adding document type:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/document-types/:type', (req, res) => {
  try {
    const { type } = req.params;
    dbModels.deleteDocumentType(type);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting document type:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== GENERAL VARIABLES ====================

app.get('/api/general-variables', (req, res) => {
  try {
    const variables = dbModels.getAllGeneralVariables();
    res.json(Array.from(variables.entries()));
  } catch (error) {
    console.error('Error getting general variables:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/general-variables/:variableName', (req, res) => {
  try {
    const { variableName } = req.params;
    const { value } = req.body;
    if (!value) {
      return res.status(400).json({ error: 'value is required' });
    }
    dbModels.setGeneralVariable(variableName, value);
    res.json({ success: true });
  } catch (error) {
    console.error('Error setting general variable:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/general-variables/:variableName', (req, res) => {
  try {
    const { variableName } = req.params;
    dbModels.deleteGeneralVariable(variableName);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting general variable:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== DOCUMENTS ====================

app.get('/api/documents/general-typed', async (req, res) => {
  try {
    const documents = dbModels.getGeneralTypedDocuments();
    // Convert to array format for API
    const result = {};
    for (const [key, value] of documents.entries()) {
      result[key] = {
        id: value.id,
        fileName: value.fileName,
        uploadedAt: value.uploadedAt.toISOString(),
        category: value.category,
        documentType: value.documentType,
        filePath: value.filePath
      };
    }
    res.json(result);
  } catch (error) {
    console.error('Error getting general typed documents:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/documents/inspector', async (req, res) => {
  try {
    const documents = dbModels.getInspectorDocuments();
    // Convert to object format for API
    const result = {};
    for (const [key, value] of documents.entries()) {
      result[key] = value.map(d => ({
        id: d.id,
        fileName: d.fileName,
        uploadedAt: d.uploadedAt.toISOString(),
        category: d.category,
        inspectorId: d.inspectorId,
        documentType: d.documentType,
        filePath: d.filePath
      }));
    }
    res.json(result);
  } catch (error) {
    console.error('Error getting inspector documents:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/documents/:id', (req, res) => {
  try {
    const { id } = req.params;
    const document = dbModels.getDocumentById(id);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    res.json({
      id: document.id,
      fileName: document.file_name,
      uploadedAt: new Date(document.uploaded_at).toISOString(),
      category: document.category,
      documentType: document.document_type,
      inspectorId: document.inspector_id,
      filePath: document.file_path
    });
  } catch (error) {
    console.error('Error getting document:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/documents', (req, res) => {
  try {
    const { id, fileName, filePath, category, documentType, inspectorId } = req.body;
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📝 POST /api/documents - Creating document');
    console.log('Request body:', JSON.stringify({ id, fileName, category, documentType, inspectorId }, null, 2));
    
    if (!id || !fileName || !filePath || !category) {
      return res.status(400).json({ error: 'id, fileName, filePath, and category are required' });
    }
    
    // CRITICAL: Ensure document type exists in document_types table before creating document
    // This is required by the foreign key constraint: FOREIGN KEY (document_type) REFERENCES document_types(type)
    // Note: type is UNIQUE across all categories, so we check globally
    if (documentType && documentType.trim()) {
      const categoryForDocType = category === 'general-typed' ? 'general' : category;
      const trimmedDocumentType = documentType.trim();
      console.log(`🔍 Checking if document type "${trimmedDocumentType}" exists (globally, since type is UNIQUE)`);
      
      // Check if document type exists globally (type is UNIQUE, not (type, category))
      const typeExists = dbModels.documentTypeExists(trimmedDocumentType);
      console.log(`Document type "${trimmedDocumentType}" exists: ${typeExists}`);
      
      if (!typeExists) {
        console.log(`➕ Adding document type "${trimmedDocumentType}" to category "${categoryForDocType}"`);
        try {
          const added = dbModels.addDocumentType(trimmedDocumentType, categoryForDocType);
          if (added) {
            console.log(`✅ Successfully added document type "${trimmedDocumentType}" to category "${categoryForDocType}"`);
          } else {
            console.log(`⚠️ Document type "${trimmedDocumentType}" was not added (may have been created concurrently)`);
          }
          
          // Verify it was actually added
          const verifyExists = dbModels.documentTypeExists(trimmedDocumentType);
          if (!verifyExists) {
            console.error(`❌ CRITICAL: Document type "${trimmedDocumentType}" was not added to database!`);
            return res.status(500).json({ 
              error: `Failed to create document type "${trimmedDocumentType}" in database`,
              hint: 'The document type could not be added. This is required before creating documents.'
            });
          }
          console.log(`✅ Verified document type "${trimmedDocumentType}" now exists in database`);
        } catch (error) {
          console.error(`❌ Failed to add document type "${trimmedDocumentType}":`, error);
          return res.status(500).json({ 
            error: `Failed to create document type "${trimmedDocumentType}": ${error.message}`,
            details: error.toString()
          });
        }
      } else {
        console.log(`✅ Document type "${trimmedDocumentType}" already exists in document_types table`);
      }
    } else if (category === 'inspector' || category === 'general-typed') {
      // Document type is required for these categories
      console.error(`❌ Document type is required for ${category} documents but was not provided or is empty`);
      return res.status(400).json({ 
        error: `Document type is required for ${category} documents`,
        hint: 'Make sure documentType is provided when creating documents.',
        receivedDocumentType: documentType
      });
    }
    
    // Prepare final values (null instead of empty strings for foreign keys)
    const finalDocumentType = documentType && documentType.trim() ? documentType.trim() : null;
    const finalInspectorId = inspectorId && inspectorId.trim() ? inspectorId.trim() : null;
    
    // CRITICAL: Ensure inspector exists if inspectorId is provided
    // This is required by the foreign key constraint: FOREIGN KEY (inspector_id) REFERENCES inspectors(id)
    if (finalInspectorId) {
      console.log(`🔍 Verifying inspector "${finalInspectorId}" exists`);
      try {
        const inspector = dbModels.getInspectorById(finalInspectorId);
        if (!inspector) {
          console.error(`❌ Inspector "${finalInspectorId}" does not exist in database`);
          const allInspectors = dbModels.getAllInspectors();
          console.error(`Available inspectors:`, allInspectors.map(i => ({ id: i.id, name: i.name })));
          return res.status(400).json({ 
            error: `Inspector with id "${finalInspectorId}" does not exist. Please create the inspector first.`,
            hint: 'Make sure the inspector is created before uploading documents for that inspector.',
            availableInspectors: allInspectors.map(i => ({ id: i.id, name: i.name }))
          });
        }
        console.log(`✅ Inspector "${finalInspectorId}" exists: ${inspector.name}`);
      } catch (error) {
        console.error(`❌ Error verifying inspector ${finalInspectorId}:`, error);
        return res.status(500).json({ 
          error: `Failed to verify inspector: ${error.message}`,
          details: error.toString()
        });
      }
    } else if (category === 'inspector') {
      // Inspector documents MUST have an inspectorId
      console.error(`❌ Inspector ID is required for inspector documents but was not provided or is empty`);
      return res.status(400).json({ 
        error: 'Inspector ID is required for inspector documents',
        hint: 'Make sure inspectorId is provided when creating inspector documents.',
        receivedInspectorId: inspectorId
      });
    }
    
    // For general-typed documents: delete ALL old documents with same documentType
    // This prevents duplicates and UNIQUE constraint errors
    if (category === 'general-typed' && finalDocumentType) {
      try {
        dbModels.deleteDocumentByType(finalDocumentType, category);
        console.log(`🗑️ Deleted existing general-typed document(s) for type ${finalDocumentType} (replacing with ${id})`);
      } catch (deleteError) {
        console.warn(`⚠️ Warning: Could not delete old documents:`, deleteError);
        // Continue anyway - we'll try to update/insert
      }
    }
    
    // CRITICAL: If document with this ID exists, either delete it or generate a new ID
    // This prevents UNIQUE constraint errors
    console.log(`🔍 Checking if document with ID ${id} already exists...`);
    let finalId = id; // Start with the provided ID
    const existingDocById = dbModels.getDocumentById(id);
    if (existingDocById) {
      console.log(`⚠️ Document with ID ${id} already exists. Attempting to delete...`);
      console.log(`   Existing:`, {
        id: existingDocById.id,
        fileName: existingDocById.file_name,
        inspectorId: existingDocById.inspector_id,
        documentType: existingDocById.document_type
      });
      
      try {
        dbModels.deleteDocument(id);
        // Verify deletion
        const verifyDeleted = dbModels.getDocumentById(id);
        if (verifyDeleted) {
          console.log(`⚠️ Deletion failed or document still exists. Generating new ID instead...`);
          finalId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
          console.log(`✅ Using new ID: ${finalId}`);
        } else {
          console.log(`✅ Successfully deleted existing document ${id}, will reuse ID`);
        }
      } catch (deleteError) {
        console.log(`⚠️ Could not delete existing document ${id}: ${deleteError.message}`);
        console.log(`   Generating new ID instead...`);
        finalId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
        console.log(`✅ Using new ID: ${finalId}`);
      }
    } else {
      console.log(`✅ No document found with ID ${id}, will use it`);
    }
    
    // Update id to finalId for the rest of the function
    if (finalId !== id) {
      console.log(`🔄 ID changed from ${id} to ${finalId}`);
      id = finalId;
      // Also update filePath to use the new ID if it contains the old ID
      if (filePath && filePath.includes(req.body.id)) {
        filePath = filePath.replace(new RegExp(req.body.id, 'g'), finalId);
        console.log(`🔄 Updated filePath to use new ID: ${filePath}`);
      }
    }
    
    // For inspector documents: delete ALL old documents with same inspectorId and documentType
    // This prevents duplicates (but we've already deleted the one with this ID above)
    if (category === 'inspector' && finalInspectorId && finalDocumentType) {
      try {
        // Only delete if there are other documents (not the one we're about to create)
        const existingDocs = dbModels.getDocumentsByCategory('inspector', finalDocumentType, finalInspectorId);
        const otherDocs = existingDocs.filter(doc => doc.id !== id);
        if (otherDocs.length > 0) {
          console.log(`🗑️ Found ${otherDocs.length} other document(s) with same inspector/type, deleting them`);
          otherDocs.forEach(doc => {
            try {
              dbModels.deleteDocument(doc.id);
              console.log(`✅ Deleted duplicate document ${doc.id}`);
            } catch (err) {
              console.warn(`⚠️ Could not delete duplicate ${doc.id}:`, err);
            }
          });
        } else {
          console.log(`📝 No other inspector documents found for inspector ${finalInspectorId}, type ${finalDocumentType}`);
        }
      } catch (deleteError) {
        console.warn(`⚠️ Warning: Could not check/delete old documents:`, deleteError);
        // Continue anyway - we'll try to insert
      }
    }
    
    
    // Create or update the document (createDocument uses INSERT OR REPLACE)
    // finalDocumentType and finalInspectorId are already set above
    console.log(`💾 Creating/updating document with id ${id}`, {
      documentType: finalDocumentType,
      inspectorId: finalInspectorId,
      category,
      originalInspectorId: inspectorId,
      originalDocumentType: documentType
    });
    
    let document;
    try {
      console.log(`💾 Attempting to create/update document with:`, {
        id,
        fileName,
        filePath,
        category,
        documentType: finalDocumentType,
        inspectorId: finalInspectorId
      });
      document = dbModels.createDocument(id, fileName, filePath, category, finalDocumentType, finalInspectorId);
      console.log(`✅ Successfully created/updated document ${document.id}`);
    } catch (error) {
      console.error(`❌ Error creating document:`, {
        error: error.message,
        errorDetails: error.toString(),
        stack: error.stack
      });
      
      // If INSERT OR REPLACE fails, try deleting and re-inserting
      if (error.message && (error.message.includes('UNIQUE constraint') || error.message.includes('UNIQUE'))) {
        console.log(`⚠️ UNIQUE constraint error detected, trying to delete and re-insert document ${id}`);
        try {
          // First, check what exists
          const checkDoc = dbModels.getDocumentById(id);
          if (checkDoc) {
            console.log(`Found existing document with ID ${id}:`, {
              id: checkDoc.id,
              fileName: checkDoc.file_name,
              inspectorId: checkDoc.inspector_id,
              documentType: checkDoc.document_type
            });
          }
          
          // Delete it
          dbModels.deleteDocument(id);
          console.log(`✅ Deleted document ${id}`);
          
          // Try to create again
          document = dbModels.createDocument(id, fileName, filePath, category, finalDocumentType, finalInspectorId);
          console.log(`✅ Successfully created document ${document.id} after delete/re-insert`);
        } catch (retryError) {
          console.error(`❌ Failed to create document after retry:`, {
            error: retryError.message,
            errorDetails: retryError.toString(),
            stack: retryError.stack
          });
          throw retryError;
        }
      } else {
        throw error;
      }
    }
    
    if (!document) {
      document = dbModels.getDocumentById(id);
      if (!document) {
        throw new Error(`Failed to create or retrieve document with id ${id}`);
      }
    }
    
    res.json({
      id: document.id,
      fileName: document.file_name,
      uploadedAt: new Date(document.uploaded_at).toISOString(),
      category: document.category,
      documentType: document.document_type,
      inspectorId: document.inspector_id,
      filePath: document.file_path
    });
  } catch (error) {
    console.error('❌ Error creating document:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    // Check if it's a foreign key constraint error
    const errorMessage = error.message || error.toString();
    let hint = 'Unknown error occurred';
    
    if (errorMessage.includes('FOREIGN KEY') || errorMessage.includes('foreign key')) {
      if (errorMessage.includes('document_type') || errorMessage.includes('document_types')) {
        hint = 'Foreign key constraint failed on document_type. The document type may not exist in the document_types table.';
      } else if (errorMessage.includes('inspector_id') || errorMessage.includes('inspectors')) {
        hint = 'Foreign key constraint failed on inspector_id. The inspector may not exist in the inspectors table.';
      } else {
        hint = 'Foreign key constraint failed. Check that all referenced records exist.';
      }
    }
    
    res.status(500).json({ 
      error: error.message || 'Unknown error',
      details: error.toString(),
      hint: hint,
      requestBody: req.body
    });
  }
});

app.delete('/api/documents/:id', (req, res) => {
  try {
    const { id } = req.params;
    dbModels.deleteDocument(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== END DATABASE API ENDPOINTS ====================

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

// Get presigned URL endpoint - returns a presigned URL that can be used directly (no CORS issues)
app.get('/api/files/presigned/:key(*)', async (req, res) => {
  try {
    const key = req.params.key;
    if (!key) {
      return res.status(400).json({ error: 'No key provided' });
    }

    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
    const expiresIn = parseInt(req.query.expiresIn) || 3600; // Default 1 hour

    console.log('🔗 Generating presigned URL for:', { key, expiresIn });

    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    });

    const url = await getSignedUrl(r2Client, command, { expiresIn });
    
    console.log('✅ Presigned URL generated:', key);
    res.json({ url });
  } catch (error) {
    console.error('❌ Presigned URL error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate presigned URL' });
  }
});

// Download endpoint - serves files from R2 to avoid CORS issues (fallback)
app.get('/api/files/:key(*)', async (req, res) => {
  try {
    const key = req.params.key;
    if (!key) {
      return res.status(400).json({ error: 'No key provided' });
    }

    console.log('📥 Downloading from R2:', { key, bucket: R2_BUCKET_NAME });

    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    });

    const response = await r2Client.send(command);
    
    if (!response.Body) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Set appropriate headers
    const contentType = response.ContentType || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    if (response.ContentLength) {
      res.setHeader('Content-Length', response.ContentLength);
    }

    // Convert stream to buffer and send
    const arrayBuffer = await response.Body.transformToByteArray();
    const buffer = Buffer.from(arrayBuffer);
    
    res.send(buffer);
    console.log('✅ Download successful:', key);
  } catch (error) {
    console.error('❌ Download error:', error);
    res.status(500).json({ error: error.message || 'Failed to download file' });
  }
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

// Add global error handlers to prevent server crashes
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  console.error('Stack:', error.stack);
  // Don't exit - let the server continue running
  // The database connection will be recreated on next request
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise);
  console.error('Reason:', reason);
  // Don't exit - let the server continue running
});

// Add error handler for database connection issues
process.on('SIGINT', async () => {
  console.log('\n⚠️ Received SIGINT, closing database connection...');
  try {
    const { getDatabase } = await import('./db/database.js');
    const db = getDatabase();
    if (db && typeof db.close === 'function') {
      db.close();
      console.log('✅ Database connection closed');
    }
  } catch (err) {
    console.error('Error closing database:', err);
  }
  process.exit(0);
});

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
  console.log('✅ Server started successfully');
}).on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use.`);
    console.error('   Please stop the other process or use a different port.');
    console.error('   To find what\'s using the port: lsof -ti:3001');
  } else {
    console.error('❌ Server error:', error);
  }
  process.exit(1);
});
