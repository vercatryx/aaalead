import { NextRequest, NextResponse } from 'next/server';
import * as dbModels from '../../../../db/models.js';

export async function PUT(
  request: NextRequest,
  { params }: { params: { variableName: string } }
) {
  try {
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { variableName: string } }
) {
  try {
    const { variableName } = params;
    await dbModels.deleteGeneralVariable(variableName);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting general variable:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
