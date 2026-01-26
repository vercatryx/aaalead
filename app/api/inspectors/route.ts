import { NextRequest, NextResponse } from 'next/server';
import * as dbModels from '../../../db/models.js';

export async function GET() {
  try {
    const inspectors = await dbModels.getAllInspectors();
    return NextResponse.json(inspectors.map((i: any) => ({
      id: i.id,
      name: i.name,
      variableValues: i.variableValues ? Array.from(i.variableValues.entries()) : undefined
    })));
  } catch (error: any) {
    console.error('Error getting inspectors:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { id, name } = await request.json();
    if (!id || !name) {
      return NextResponse.json({ error: 'id and name are required' }, { status: 400 });
    }
    const inspector = await dbModels.createInspector(id, name);
    if (!inspector) {
      return NextResponse.json({ error: 'Failed to create inspector' }, { status: 500 });
    }
    return NextResponse.json({
      id: inspector.id,
      name: inspector.name,
      variableValues: inspector.variableValues ? Array.from(inspector.variableValues.entries()) : undefined
    });
  } catch (error: any) {
    console.error('Error creating inspector:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
