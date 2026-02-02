import { NextRequest, NextResponse } from 'next/server';
import * as dbModels from '../../../../db/models.js';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const debugDocId = searchParams.get('debugDocId');
    const timestamp = new Date().toISOString();
    
    console.log(`🔍 [${timestamp}] GET /api/documents/inspector - Starting query${debugDocId ? ` (debugging doc: ${debugDocId})` : ''}`);
    
    const documents = await dbModels.getInspectorDocuments();
    
    // Log all documents found
    const allDocIds: string[] = [];
    for (const [inspectorId, docs] of documents.entries()) {
      allDocIds.push(...docs.map((d: any) => d.id));
    }
    console.log(`📊 [${timestamp}] Found ${allDocIds.length} total inspector documents across ${documents.size} inspectors`);
    console.log(`📋 [${timestamp}] All document IDs:`, allDocIds);
    
    // If debugging a specific document, check if it's in the results
    if (debugDocId) {
      let foundInResults = false;
      let foundInspectorId: string | null = null;
      for (const [inspectorId, docs] of documents.entries()) {
        const found = docs.find((d: any) => d.id === debugDocId);
        if (found) {
          foundInResults = true;
          foundInspectorId = inspectorId;
          console.log(`✅ [${timestamp}] Document ${debugDocId} FOUND in results for inspector ${inspectorId}:`, {
            id: found.id,
            fileName: found.fileName,
            documentType: found.documentType,
            filePath: found.filePath
          });
          break;
        }
      }
      if (!foundInResults) {
        console.error(`❌ [${timestamp}] Document ${debugDocId} NOT FOUND in query results!`);
        console.error(`📊 [${timestamp}] Inspector breakdown:`, Array.from(documents.entries()).map(([id, docs]) => ({
          inspectorId: id,
          docCount: docs.length,
          docIds: docs.map((d: any) => d.id)
        })));
      }
    }
    
    const result: Record<string, any[]> = {};
    for (const [key, value] of documents.entries()) {
      result[key] = value.map((d: any) => ({
        id: d.id,
        fileName: d.fileName,
        uploadedAt: d.uploadedAt.toISOString(),
        category: d.category,
        inspectorId: d.inspectorId,
        documentType: d.documentType,
        filePath: d.filePath
      }));
    }
    
    console.log(`✅ [${timestamp}] Returning ${Object.keys(result).length} inspectors with documents`);
    const response = NextResponse.json(result);
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
