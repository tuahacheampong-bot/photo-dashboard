import { NextRequest, NextResponse } from 'next/server';
import { getZohoSettings, saveZohoSettings, testConnection } from '@/lib/zoho';
import { requireAuth, requireOwner } from '@/lib/api-auth';

export async function GET() {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;

  const s = getZohoSettings();
  if (!s) return NextResponse.json({ configured: false });
  return NextResponse.json({
    configured: true,
    client_id: s.client_id,
    client_secret: s.client_secret ? '***' : '',
    refresh_token: s.refresh_token ? '***' : '',
    organization_id: s.organization_id,
    region: s.region || 'com',
  });
}

export async function POST(req: NextRequest) {
  const authResult = await requireOwner();
  if (authResult.error) return authResult.error;

  const body = await req.json();
  const existing = getZohoSettings();

  const settings = {
    client_id: body.client_id || existing?.client_id || '',
    client_secret: (body.client_secret && body.client_secret !== '***')
      ? body.client_secret : existing?.client_secret || '',
    refresh_token: (body.refresh_token && body.refresh_token !== '***')
      ? body.refresh_token : existing?.refresh_token || '',
    organization_id: body.organization_id || existing?.organization_id || '',
    region: body.region || existing?.region || 'com',
  };

  saveZohoSettings(settings);
  return NextResponse.json({ ok: true });
}

export async function PUT() {
  const authResult = await requireOwner();
  if (authResult.error) return authResult.error;

  const s = getZohoSettings();
  if (!s) return NextResponse.json({ ok: false, message: 'Not configured' });

  const result = await testConnection(s);
  return NextResponse.json(result);
}
