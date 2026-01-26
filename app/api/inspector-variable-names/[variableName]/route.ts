import { NextRequest, NextResponse } from 'next/server';
import * as dbModels from '../../../../db/models.js';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { variableName: string } }
) {
  try {
    const { variableName } = params;
    await dbModels.deleteInspectorVariableName(variableName);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting inspector variable name:', error);
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
