import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Dynamic import to ensure it's only loaded on the server
    const dbModels = await import('../../../db/models.js');
    const data = await dbModels.getAllData();
    if (!data) {
      return NextResponse.json({ 
        error: 'Database is not available',
        message: 'This deployment does not include database support. Database features are disabled.',
        data: { inspectors: [], documents: [], variables: {} }
      }, { status: 503 });
    }
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error getting all data:', error);
    if (error.message?.includes('Database is not available')) {
      return NextResponse.json({ 
        error: 'Database is not available',
        message: 'This deployment does not include database support. Database features are disabled.',
        data: { inspectors: [], documents: [], variables: {} },
        dbError: error.dbError || null,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }, { status: 503 });
    }
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
