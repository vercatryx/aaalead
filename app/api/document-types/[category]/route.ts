import { NextRequest, NextResponse } from 'next/server';
import * as dbModels from '../../../../db/models.js';

export async function GET(
  request: NextRequest,
  { params }: { params: { category: string } }
) {
  try {
    const { category } = params;
    const types = dbModels.getDocumentTypes(category);
    return NextResponse.json(types);
  } catch (error: any) {
    console.error('Error getting document types:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
