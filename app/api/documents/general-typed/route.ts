import { NextResponse } from 'next/server';
import * as dbModels from '../../../../db/models.js';

export async function GET() {
  try {
    const documents = await dbModels.getGeneralTypedDocuments();
    const result: Record<string, any> = {};
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
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error getting general typed documents:', error);
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
