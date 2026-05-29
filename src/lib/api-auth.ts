import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export interface AuthSession {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}

/**
 * Require an authenticated session. Returns 401 response if not logged in.
 */
export async function requireAuth(): Promise<
  { session: AuthSession; error?: never } | { session?: never; error: NextResponse }
> {
  const session = (await auth()) as AuthSession | null;
  if (!session?.user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  return { session };
}

/**
 * Require an authenticated session with owner role. Returns 401/403 if not met.
 */
export async function requireOwner(): Promise<
  { session: AuthSession; error?: never } | { session?: never; error: NextResponse }
> {
  const result = await requireAuth();
  if (result.error) return result;
  if (result.session.user.role !== 'owner') {
    return {
      error: NextResponse.json({ error: 'Forbidden: owner access required' }, { status: 403 }),
    };
  }
  return result;
}

// ─── Input Validation Helpers ──────────────────────────────────────────────

export function validateRequired(
  body: Record<string, unknown>,
  fields: string[]
): string | null {
  for (const field of fields) {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      return `${field} is required`;
    }
  }
  return null;
}

export function validatePositiveNumber(
  value: unknown,
  fieldName: string
): string | null {
  if (value === undefined || value === null) return null; // optional
  const num = Number(value);
  if (isNaN(num) || num < 0) {
    return `${fieldName} must be a positive number`;
  }
  return null;
}

export function validateEmail(value: unknown, fieldName = 'email'): string | null {
  if (!value) return null; // optional
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(value as string)) {
    return `${fieldName} must be a valid email`;
  }
  return null;
}

export function validateDate(value: unknown, fieldName: string): string | null {
  if (!value) return null; // optional
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(value as string)) {
    return `${fieldName} must be a valid date (YYYY-MM-DD)`;
  }
  return null;
}

export function validateEnum<T extends string>(
  value: unknown,
  allowed: T[],
  fieldName: string
): string | null {
  if (!value) return null; // optional
  if (!allowed.includes(value as T)) {
    return `${fieldName} must be one of: ${allowed.join(', ')}`;
  }
  return null;
}

export function validateLength(
  value: unknown,
  fieldName: string,
  opts: { min?: number; max?: number }
): string | null {
  if (!value) return null; // optional
  const str = String(value);
  if (opts.min !== undefined && str.length < opts.min) {
    return `${fieldName} must be at least ${opts.min} characters`;
  }
  if (opts.max !== undefined && str.length > opts.max) {
    return `${fieldName} must be at most ${opts.max} characters`;
  }
  return null;
}

/**
 * Run multiple validations and return the first error, or null if all pass.
 */
export function firstError(...errors: (string | null)[]): string | null {
  return errors.find((e) => e !== null) ?? null;
}
