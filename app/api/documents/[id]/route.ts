import { NextRequest, NextResponse } from 'next/server';
import * as dbModels from '../../../../db/models.js';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const document = await dbModels.getDocumentById(id);
    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
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
    console.error('Error getting document:', error);
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
      stack: isDevelopment ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    await dbModels.deleteDocument(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting document:', error);
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
      stack: isDevelopment ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
