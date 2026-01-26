import { NextResponse } from 'next/server';
import * as dbModels from '../../../db/models.js';

export async function GET() {
  try {
    const data = dbModels.getAllData();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error getting all data:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
