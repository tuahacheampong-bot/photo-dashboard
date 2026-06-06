import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens, getZohoSettings } from '@/lib/zoho';
import { requireOwner, validateRequired } from '@/lib/api-auth';

const REDIRECT_URI = 'http://localhost:3000/token';

export async function POST(req: NextRequest) {
  const authResult = await requireOwner();
  if (authResult.error) return authResult.error;

  try {
    const { code, client_id, client_secret } = await req.json();

    const err = validateRequired({ code, client_id, client_secret }, ['code', 'client_id', 'client_secret']);
    if (err) {
      return NextResponse.json({ error: err }, { status: 400 });
    }

    // Get region from saved settings or default to com
    const settings = getZohoSettings();
    const region = settings?.region || 'com';

    const tokens = await exchangeCodeForTokens(code, client_id, client_secret, region, REDIRECT_URI);
    return NextResponse.json(tokens);
  } catch (e) {
    const err = e as Error;
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}