import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    const dbModels = await import('../../../db/models.js');
    const names = await dbModels.getAllInspectorVariableNames();
    return NextResponse.json(names);
  } catch (error: any) {
    console.error('Error getting inspector variable names:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
