import { NextRequest, NextResponse } from 'next/server';
import * as dbModels from '../../../../../../db/models.js';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; variableName: string } }
) {
  try {
    const { id, variableName } = params;
    const { value } = await request.json();
    if (value) {
      dbModels.setInspectorVariable(id, variableName, value);
    } else {
      dbModels.deleteInspectorVariable(id, variableName);
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error setting inspector variable:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; variableName: string } }
) {
  try {
    const { id, variableName } = params;
    dbModels.deleteInspectorVariable(id, variableName);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting inspector variable:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
