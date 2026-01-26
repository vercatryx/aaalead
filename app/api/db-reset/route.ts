import { NextResponse } from 'next/server';
import { resetDatabaseConnection } from '../../../db/database.js';

export async function POST() {
  try {
    await resetDatabaseConnection();
    return NextResponse.json({
      success: true,
      message: 'Database connection reset successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}
