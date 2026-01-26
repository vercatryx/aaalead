import { NextRequest, NextResponse } from 'next/server';
import * as dbModels from '../../../db/models.js';

export async function GET() {
  try {
    const names = dbModels.getAllInspectorVariableNames();
    return NextResponse.json(names);
  } catch (error: any) {
    console.error('Error getting inspector variable names:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { variableName } = await request.json();
    if (!variableName) {
      return NextResponse.json({ error: 'variableName is required' }, { status: 400 });
    }
    dbModels.addInspectorVariableName(variableName);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error adding inspector variable name:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
