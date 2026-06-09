import { NextResponse } from 'next/server';
import getDb from '@/lib/db';

export async function GET() {
  try {
    const db = await getDb();
    
    // Test database connection
    const userCount = await db.prepare('SELECT COUNT(*) as count FROM users').get();
    const tables = await db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    
    return NextResponse.json({
      status: 'ok',
      database: 'connected',
      userCount: userCount?.count || 0,
      tables: tables.map((t: any) => t.name),
    });
  } catch (e) {
    const err = e as Error;
    return NextResponse.json({
      status: 'error',
      error: err.message,
      stack: err.stack,
    }, { status: 500 });
  }
}