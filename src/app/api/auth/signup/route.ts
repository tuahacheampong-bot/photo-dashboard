import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const { name, email, password } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Name, email, and password are required' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const db = getDb();

    // Check if user already exists
    let existing;
    try {
      existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    } catch (dbError) {
      console.error('Database error checking existing user:', dbError);
      return NextResponse.json({ error: 'Database connection failed. Please configure Turso database.' }, { status: 500 });
    }
    
    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 400 });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user (default role: worker)
    let result;
    try {
      result = db.prepare(
        'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)'
      ).run(name, email, hashedPassword, 'worker');
    } catch (dbError) {
      console.error('Database error creating user:', dbError);
      return NextResponse.json({ error: 'Failed to create user in database' }, { status: 500 });
    }

    return NextResponse.json({ 
      message: 'Account created successfully',
      user: { id: result.lastInsertRowid, name, email, role: 'worker' }
    });
  } catch (e) {
    console.error('Signup error:', e);
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
  }
}