import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireOwner, validateRequired, validateLength } from '@/lib/api-auth';

// POST /api/expenses/categories - Create a new category
export async function POST(request: NextRequest) {
  const authResult = await requireOwner();
  if (authResult.error) return authResult.error;

  try {
    const db = await getDb();
    const body = await request.json();
    const { name } = body;

    const err = validateRequired(body, ['name']) || validateLength(name, 'name', { min: 1, max: 100 });
    if (err) {
      return NextResponse.json({ error: err }, { status: 400 });
    }

    const result = db.prepare(
      'INSERT INTO expense_categories (name, is_default) VALUES (?, 0)'
    ).run(name);

    return NextResponse.json({ id: result.lastInsertRowid, message: 'Category created successfully' });
  } catch (error) {
    const err = error as Error;
    if (err.message?.includes('UNIQUE constraint')) {
      return NextResponse.json({ error: 'Category already exists' }, { status: 400 });
    }
    console.error('Error creating category:', error);
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 });
  }
}

// DELETE /api/expenses/categories?id=X
export async function DELETE(request: NextRequest) {
  const authResult = await requireOwner();
  if (authResult.error) return authResult.error;

  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Category ID is required' }, { status: 400 });
    }

    await db.prepare('DELETE FROM expense_categories WHERE id = ? AND is_default = 0').run(id);
    return NextResponse.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Error deleting category:', error);
    return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 });
  }
}
