import { NextResponse } from 'next/server';

/**
 * Creates a standardized error response with detailed database error information
 * for client-side logging
 */
export function createErrorResponse(error: any, status: number = 500) {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // Extract database error details
  const dbError = error.dbError || {
    message: error.message,
    code: error.code,
    errno: error.errno,
    syscall: error.syscall,
    hostname: error.hostname,
  };

  return NextResponse.json({
    error: error.message || 'Unknown error',
    dbError: dbError,
    details: error.toString(),
    stack: isDevelopment ? error.stack : undefined,
    timestamp: new Date().toISOString(),
  }, { status });
}
