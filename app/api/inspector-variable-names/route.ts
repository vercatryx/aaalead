import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    const dbModels = await import('../../../db/models.js');
    const names = await dbModels.getAllInspectorVariableNames();
    return NextResponse.json(names);
  } catch (error: any) {
    console.error('Error getting inspector variable names:', error);
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

export async function POST(request: NextRequest) {
  try {
    const dbModels = await import('../../../db/models.js');
    const { variableName } = await request.json();
    if (!variableName) {
      return NextResponse.json({ error: 'variableName is required' }, { status: 400 });
    }
    await dbModels.addInspectorVariableName(variableName);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error adding inspector variable name:', error);
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
