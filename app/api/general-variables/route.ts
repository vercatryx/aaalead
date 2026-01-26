import { NextRequest, NextResponse } from 'next/server';
import * as dbModels from '../../../db/models.js';

export async function GET() {
  try {
    const variables = dbModels.getAllGeneralVariables();
    return NextResponse.json(Array.from(variables.entries()));
  } catch (error: any) {
    console.error('Error getting general variables:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
