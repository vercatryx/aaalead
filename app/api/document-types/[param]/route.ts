import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { param: string } }
) {
  try {
    // Dynamic import to ensure it's only loaded on the server
    const dbModels = await import('../../../../db/models.js');
    const { param } = params;
    // Treat param as category for GET requests
    const types = await dbModels.getDocumentTypes(param);
    return NextResponse.json(types);
  } catch (error: any) {
    console.error('Error getting document types:', error);
    console.error('Error stack:', error.stack);
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: { param: string } }
) {
  try {
    // Dynamic import to ensure it's only loaded on the server
    const dbModels = await import('../../../../db/models.js');
    const { param } = params;
    // Treat param as type for DELETE requests
    await dbModels.deleteDocumentType(param);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting document type:', error);
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
