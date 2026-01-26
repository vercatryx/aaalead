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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
