import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    const dbModels = await import('../../../db/models.js');
    const variables = await dbModels.getAllGeneralVariables();
    return NextResponse.json(Array.from(variables.entries()));
  } catch (error: any) {
    console.error('Error getting general variables:', error);
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
