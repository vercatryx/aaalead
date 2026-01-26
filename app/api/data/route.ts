import { NextResponse } from 'next/server';
import * as dbModels from '../../../db/models.js';

export async function GET() {
  try {
    const data = dbModels.getAllData();
    if (!data) {
      return NextResponse.json({ 
        error: 'Database is not available',
        message: 'This deployment does not include database support. Database features are disabled.',
        data: { inspectors: [], documents: [], variables: {} }
      }, { status: 503 });
    }
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error getting all data:', error);
    if (error.message?.includes('Database is not available')) {
      return NextResponse.json({ 
        error: 'Database is not available',
        message: 'This deployment does not include database support. Database features are disabled.',
        data: { inspectors: [], documents: [], variables: {} }
      }, { status: 503 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
