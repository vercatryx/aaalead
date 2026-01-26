import { NextResponse } from 'next/server';
import * as dbModels from '../../../../db/models.js';

export async function GET() {
  try {
    const documents = dbModels.getGeneralTypedDocuments();
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
