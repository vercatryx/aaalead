import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const dbModels = await import('../../../db/models.js');
    const { type, category } = await request.json();
    if (!type || !category) {
      return NextResponse.json({ error: 'type and category are required' }, { status: 400 });
    }
    await dbModels.addDocumentType(type, category);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error adding document type:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
