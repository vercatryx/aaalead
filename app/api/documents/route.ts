import { NextRequest, NextResponse } from 'next/server';
import * as dbModels from '../../../db/models.js';

export async function POST(request: NextRequest) {
  try {
    const { id, fileName, filePath, category, documentType, inspectorId } = await request.json();
    
    if (!id || !fileName || !filePath || !category) {
      return NextResponse.json({ error: 'id, fileName, filePath, and category are required' }, { status: 400 });
    }
    
    // Ensure document type exists
    if (documentType && documentType.trim()) {
      const categoryForDocType = category === 'general-typed' ? 'general' : category;
      const trimmedDocumentType = documentType.trim();
      
      if (!(await dbModels.documentTypeExists(trimmedDocumentType))) {
        await dbModels.addDocumentType(trimmedDocumentType, categoryForDocType);
      }
    }
    
    const finalDocumentType = documentType && documentType.trim() ? documentType.trim() : null;
    const finalInspectorId = inspectorId && inspectorId.trim() ? inspectorId.trim() : null;
    
    // Verify inspector exists if provided
    if (finalInspectorId) {
      const inspector = await dbModels.getInspectorById(finalInspectorId);
      if (!inspector) {
        const allInspectors = await dbModels.getAllInspectors();
        return NextResponse.json({ 
          error: `Inspector with id "${finalInspectorId}" does not exist. Please create the inspector first.`,
          hint: 'Make sure the inspector is created before uploading documents for that inspector.',
          availableInspectors: allInspectors.map((i: any) => ({ id: i.id, name: i.name }))
        }, { status: 400 });
      }
    } else if (category === 'inspector') {
      return NextResponse.json({ 
        error: 'Inspector ID is required for inspector documents',
        hint: 'Make sure inspectorId is provided when creating inspector documents.',
      }, { status: 400 });
    }
    
    // Delete old documents for general-typed
    if (category === 'general-typed' && finalDocumentType) {
      try {
        await dbModels.deleteDocumentByType(finalDocumentType, category);
      } catch (deleteError) {
        console.warn('Warning: Could not delete old documents:', deleteError);
      }
    }
    
    // Check if document exists and delete if needed
    let finalId = id;
    const existingDocById = await dbModels.getDocumentById(id);
    if (existingDocById) {
      try {
        await dbModels.deleteDocument(id);
      } catch (deleteError) {
        finalId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
      }
    }
    
    // Delete duplicates for inspector documents
    if (category === 'inspector' && finalInspectorId && finalDocumentType) {
      try {
        const existingDocs = await dbModels.getDocumentsByCategory('inspector', finalDocumentType, finalInspectorId);
        const otherDocs = existingDocs.filter((doc: any) => doc.id !== finalId);
        for (const doc of otherDocs) {
          try {
            await dbModels.deleteDocument(doc.id);
          } catch (err) {
            console.warn(`Could not delete duplicate ${doc.id}:`, err);
          }
        }
      } catch (deleteError) {
        console.warn('Warning: Could not check/delete old documents:', deleteError);
      }
    }
    
    // Create document
    let document;
    try {
      document = await dbModels.createDocument(finalId, fileName, filePath, category, finalDocumentType, finalInspectorId);
    } catch (error: any) {
      if (error.message && (error.message.includes('UNIQUE constraint') || error.message.includes('UNIQUE') || error.code === '23505')) {
        try {
          await dbModels.deleteDocument(finalId);
          document = await dbModels.createDocument(finalId, fileName, filePath, category, finalDocumentType, finalInspectorId);
        } catch (retryError) {
          throw retryError;
        }
      } else {
        throw error;
      }
    }
    
    if (!document) {
      document = await dbModels.getDocumentById(finalId);
      if (!document) {
        throw new Error(`Failed to create or retrieve document with id ${finalId}`);
      }
    }
    
    return NextResponse.json({
      id: document.id,
      fileName: document.file_name,
      uploadedAt: new Date(document.uploaded_at).toISOString(),
      category: document.category,
      documentType: document.document_type,
      inspectorId: document.inspector_id,
      filePath: document.file_path
    });
  } catch (error: any) {
    console.error('Error creating document:', error);
    let hint = 'Unknown error occurred';
    
    const errorMessage = error.message || error.toString();
    if (errorMessage.includes('FOREIGN KEY') || errorMessage.includes('foreign key')) {
      if (errorMessage.includes('document_type') || errorMessage.includes('document_types')) {
        hint = 'Foreign key constraint failed on document_type. The document type may not exist in the document_types table.';
      } else if (errorMessage.includes('inspector_id') || errorMessage.includes('inspectors')) {
        hint = 'Foreign key constraint failed on inspector_id. The inspector may not exist in the inspectors table.';
      } else {
        hint = 'Foreign key constraint failed. Check that all referenced records exist.';
      }
    }
    
    const isDevelopment = process.env.NODE_ENV === 'development';
    return NextResponse.json({ 
      error: error.message || 'Unknown error',
      dbError: error.dbError || {
        message: error.message,
        code: error.code,
        errno: error.errno,
        syscall: error.syscall,
        hostname: error.hostname,
      },
      details: error.toString(),
      hint: hint,
      stack: isDevelopment ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
