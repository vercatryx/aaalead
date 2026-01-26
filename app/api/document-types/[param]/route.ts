import { NextRequest, NextResponse } from 'next/server';
import * as dbModels from '../../../../db/models.js';

export async function GET(
  request: NextRequest,
  { params }: { params: { param: string } }
) {
  try {
    const { param } = params;
    // Treat param as category for GET requests
    const types = dbModels.getDocumentTypes(param);
    return NextResponse.json(types);
  } catch (error: any) {
    console.error('Error getting document types:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { param: string } }
) {
  try {
    const { param } = params;
    // Treat param as type for DELETE requests
    dbModels.deleteDocumentType(param);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting document type:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
