import { NextRequest, NextResponse } from 'next/server';
import * as dbModels from '../../../db/models.js';

export async function POST(request: NextRequest) {
  try {
    const { type, category } = await request.json();
    if (!type || !category) {
      return NextResponse.json({ error: 'type and category are required' }, { status: 400 });
    }
    dbModels.addDocumentType(type, category);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error adding document type:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
