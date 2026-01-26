import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    // Dynamic import to ensure it's only loaded on the server
    const dbModels = await import('../../../db/models.js');
    const inspectors = await dbModels.getAllInspectors();
    return NextResponse.json(inspectors.map((i: any) => ({
      id: i.id,
      name: i.name,
      variableValues: i.variableValues ? Array.from(i.variableValues.entries()) : undefined
    })));
  } catch (error: any) {
    console.error('Error getting inspectors:', error);
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
    // Dynamic import to ensure it's only loaded on the server
    const dbModels = await import('../../../db/models.js');
    const { id, name } = await request.json();
    if (!id || !name) {
      return NextResponse.json({ error: 'id and name are required' }, { status: 400 });
    }
    const inspector = await dbModels.createInspector(id, name);
    if (!inspector) {
      return NextResponse.json({ error: 'Failed to create inspector' }, { status: 500 });
    }
    return NextResponse.json({
      id: inspector.id,
      name: inspector.name,
      variableValues: inspector.variableValues ? Array.from(inspector.variableValues.entries()) : undefined
    });
  } catch (error: any) {
    console.error('Error creating inspector:', error);
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
