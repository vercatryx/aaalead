import { NextRequest, NextResponse } from 'next/server';
import * as dbModels from '../../../../db/models.js';

export async function PUT(
  request: NextRequest,
  { params }: { params: { variableName: string } }
) {
  try {
    const { variableName } = params;
    const { value } = await request.json();
    if (!value) {
      return NextResponse.json({ error: 'value is required' }, { status: 400 });
    }
    dbModels.setGeneralVariable(variableName, value);
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
    dbModels.deleteGeneralVariable(variableName);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting general variable:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
