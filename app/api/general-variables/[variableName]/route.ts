import { NextRequest, NextResponse } from 'next/server';

export async function PUT(
  request: NextRequest,
  { params }: { params: { variableName: string } }
) {
  try {
    const dbModels = await import('../../../../db/models.js');
    const { variableName } = params;
    const body = await request.json();
    
    // Allow empty strings - only reject if value is undefined or null
    if (body.value === undefined || body.value === null) {
      return NextResponse.json({ error: 'value is required' }, { status: 400 });
    }
    
    // Treat empty string as a valid value (variable exists but is empty)
    const value = body.value === '' ? '' : String(body.value);
    await dbModels.setGeneralVariable(variableName, value);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error setting general variable:', error);
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
  { params }: { params: { variableName: string } }
) {
  try {
    const dbModels = await import('../../../../db/models.js');
    const { variableName } = params;
    await dbModels.deleteGeneralVariable(variableName);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting general variable:', error);
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
