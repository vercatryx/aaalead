import { NextRequest, NextResponse } from 'next/server';
import * as dbModels from '../../../../db/models.js';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const inspector = await dbModels.getInspectorById(id);
    if (!inspector) {
      return NextResponse.json({ error: 'Inspector not found' }, { status: 404 });
    }
    return NextResponse.json({
      id: inspector.id,
      name: inspector.name,
      variableValues: inspector.variableValues ? Array.from(inspector.variableValues.entries()) : undefined
    });
  } catch (error: any) {
    console.error('Error getting inspector:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const { name } = await request.json();
    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }
    const inspector = await dbModels.updateInspector(id, name);
    if (!inspector) {
      return NextResponse.json({ error: 'Inspector not found' }, { status: 404 });
    }
    return NextResponse.json({
      id: inspector.id,
      name: inspector.name,
      variableValues: inspector.variableValues ? Array.from(inspector.variableValues.entries()) : undefined
    });
  } catch (error: any) {
    console.error('Error updating inspector:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    await dbModels.deleteInspector(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting inspector:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
