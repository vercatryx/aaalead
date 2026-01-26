import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    const dbModels = await import('../../../db/models.js');
    const variables = await dbModels.getAllGeneralVariables();
    return NextResponse.json(Array.from(variables.entries()));
  } catch (error: any) {
    console.error('Error getting general variables:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
