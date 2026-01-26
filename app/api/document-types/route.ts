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
