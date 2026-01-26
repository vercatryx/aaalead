import { NextResponse } from 'next/server';
import * as dbModels from '../../../../db/models.js';

export async function GET() {
  try {
    const documents = dbModels.getInspectorDocuments();
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
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error getting inspector documents:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
