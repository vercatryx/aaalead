import { NextRequest, NextResponse } from 'next/server';
import * as dbModels from '../../../../../db/models.js';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const timestamp = new Date().toISOString();
    console.log(`🔍 [${timestamp}] GET /api/inspectors/${id}/documents - Querying documents for inspector`);
    
    const documents = await dbModels.getInspectorDocumentsById(id);
    
    console.log(`📊 [${timestamp}] Found ${documents.length} documents for inspector ${id}`);
    
    const response = NextResponse.json(documents.map((d: any) => ({
      id: d.id,
      fileName: d.fileName,
      uploadedAt: d.uploadedAt.toISOString(),
      category: d.category,
      inspectorId: d.inspectorId,
      documentType: d.documentType,
      filePath: d.filePath
    })));
    
    // Prevent caching to ensure fresh data
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    return response;
  } catch (error: any) {
    console.error('Error getting inspector documents:', error);
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
