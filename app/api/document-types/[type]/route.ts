import { NextRequest, NextResponse } from 'next/server';
import * as dbModels from '../../../../db/models.js';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { type: string } }
) {
  try {
    const { type } = params;
    dbModels.deleteDocumentType(type);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting document type:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
