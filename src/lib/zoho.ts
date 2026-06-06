import getDb from './db';

// ─── Zoho Region Config ─────────────────────────────────────────────────────

const ZOHO_REGIONS: Record<string, { accounts: string; invoices: string }> = {
  com:     { accounts: 'https://accounts.zoho.com',   invoices: 'https://invoice.zoho.com' },
  eu:      { accounts: 'https://accounts.zoho.eu',    invoices: 'https://invoice.zoho.eu' },
  in:      { accounts: 'https://accounts.zoho.in',    invoices: 'https://invoice.zoho.in' },
  'com.au': { accounts: 'https://accounts.zoho.com.au', invoices: 'https://invoice.zoho.com.au' },
  jp:      { accounts: 'https://accounts.zoho.jp',    invoices: 'https://invoice.zoho.jp' },
  ca:      { accounts: 'https://accounts.zoho.ca',    invoices: 'https://invoice.zoho.ca' },
};

const SCOPE = 'ZohoInvoice.invoices.ALL,ZohoInvoice.contacts.ALL,ZohoInvoice.settings.READ';

// ─── Settings ────────────────────────────────────────────────────────────────

export interface ZohoSettings {
  client_id: string;
  client_secret: string;
  refresh_token: string;
  organization_id: string;
  region: string;
}

export async function getZohoSettings(): Promise<ZohoSettings | null> {
  try {
    const db = await getDb();
    interface ZohoSettingsRow {
      client_id: string;
      client_secret: string;
      refresh_token: string;
      organization_id: string;
      region: string;
    }
    const row = await db.prepare('SELECT * FROM zoho_settings WHERE id = 1').get() as ZohoSettingsRow | null;
    if (!row || !row.client_id) return null;
    return {
      client_id: row.client_id || '',
      client_secret: row.client_secret || '',
      refresh_token: row.refresh_token || '',
      organization_id: row.organization_id || '',
      region: row.region || 'com',
    };
  } catch {
    return null;
  }
}

export async function saveZohoSettings(s: ZohoSettings): Promise<void> {
  const db = await getDb();
  await db.prepare(`
    INSERT OR REPLACE INTO zoho_settings (id, client_id, client_secret, refresh_token, organization_id, region, updated_at)
    VALUES (1, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).run(s.client_id, s.client_secret, s.refresh_token, s.organization_id, s.region || 'com');
}

// ─── OAuth URLs ──────────────────────────────────────────────────────────────

export function getAuthUrl(clientId: string, region: string, redirectUri: string): string {
  const r = ZOHO_REGIONS[region] || ZOHO_REGIONS.com;
  const params = new URLSearchParams({
    scope: SCOPE,
    client_id: clientId,
    response_type: 'code',
    access_type: 'offline',
    redirect_uri: redirectUri,
    prompt: 'consent',
  });
  return `${r.accounts}/oauth/v2/auth?${params.toString()}`;
}

// ─── Token Exchange ──────────────────────────────────────────────────────────

export async function exchangeCodeForTokens(
  code: string,
  clientId: string,
  clientSecret: string,
  region: string,
  redirectUri: string
): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const r = ZOHO_REGIONS[region] || ZOHO_REGIONS.com;

  const params = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  const res = await fetch(`${r.accounts}/oauth/v2/token?${params.toString()}`, {
    method: 'POST',
  });

  const data = await res.json();

  if (data.error) {
    throw new Error(data.error_description || data.error || 'Token exchange failed');
  }

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in || 3600,
  };
}

// ─── Access Token Refresh ────────────────────────────────────────────────────

async function getAccessToken(settings: ZohoSettings): Promise<string> {
  const r = ZOHO_REGIONS[settings.region] || ZOHO_REGIONS.com;

  const params = new URLSearchParams({
    refresh_token: settings.refresh_token,
    client_id: settings.client_id,
    client_secret: settings.client_secret,
    grant_type: 'refresh_token',
  });

  const res = await fetch(`${r.accounts}/oauth/v2/token?${params.toString()}`, {
    method: 'POST',
  });

  const data = await res.json();

  if (data.error) {
    throw new Error(`Token refresh failed: ${data.error} - ${data.error_description || ''}`);
  }

  return data.access_token;
}

// ─── Zoho Invoice API ────────────────────────────────────────────────────────

export interface ZohoInvoice {
  zoho_id: string;
  invoice_number: string;
  date: string;
  due_date: string;
  customer_name: string;
  total: number;
  balance: number;
  status: string;
}

function mapStatus(s: string): string {
  const m: Record<string, string> = {
    draft: 'pending', open: 'pending', unpaid: 'pending',
    overdue: 'overdue', paid: 'paid', partial: 'partial',
    void: 'cancelled',
  };
  return m[s?.toLowerCase()] || 'pending';
}

async function apiRequest(
  settings: ZohoSettings,
  method: string,
  path: string
): Promise<unknown> {
  const r = ZOHO_REGIONS[settings.region] || ZOHO_REGIONS.com;
  const token = await getAccessToken(settings);

  const url = new URL(`${r.invoices}/api/v3${path}`);
  if (settings.organization_id) {
    url.searchParams.set('organization_id', settings.organization_id);
  }

  const res = await fetch(url.toString(), {
    method,
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (res.status === 401) {
    // Token expired, retry once
    const token2 = await getAccessToken(settings);
    const res2 = await fetch(url.toString(), {
      method,
      headers: {
        Authorization: `Zoho-oauthtoken ${token2}`,
        'Content-Type': 'application/json',
      },
    });
    if (!res2.ok) throw new Error(`Zoho API error ${res2.status}`);
    return res2.json();
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Zoho API error ${res.status}: ${body}`);
  }

  return res.json();
}

export async function fetchAllInvoices(settings: ZohoSettings): Promise<ZohoInvoice[]> {
  interface ZohoInvoicesResponse {
    invoices: Array<{
      invoice_id: string;
      invoice_number: string;
      date: string;
      due_date: string;
      customer_name: string;
      contact?: { contact_name: string };
      total: string;
      balance: string;
      status: string;
    }>;
    page_context: { page: number; total_pages: number } | null;
  }

  const allInvoices: ZohoInvoice[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const data = await apiRequest(settings, 'GET', `/invoices?page=${page}&per_page=200`) as ZohoInvoicesResponse;
    const invoices = data.invoices || [];

    for (const inv of invoices) {
      allInvoices.push({
        zoho_id: inv.invoice_id,
        invoice_number: inv.invoice_number || '',
        date: inv.date || '',
        due_date: inv.due_date || '',
        customer_name: inv.customer_name || inv.contact?.contact_name || 'Unknown',
        total: parseFloat(inv.total || '0'),
        balance: parseFloat(inv.balance || '0'),
        status: mapStatus(inv.status),
      });
    }

    const ctx = data.page_context;
    hasMore = !!ctx && ctx.page < ctx.total_pages;
    page++;
  }

  return allInvoices;
}

interface ZohoOrganizationsResponse {
  organizations: Array<{ organization_name: string }> | null;
}

export async function testConnection(settings: ZohoSettings): Promise<{ ok: boolean; message: string }> {
  try {
    const data = await apiRequest(settings, 'GET', '/organizations') as ZohoOrganizationsResponse;
    const name = data.organizations?.[0]?.organization_name || 'Connected';
    return { ok: true, message: `Connected to ${name}` };
  } catch (e) {
    const err = e as Error;
    return { ok: false, message: err.message };
  }
}

// ─── Create Invoice on Zoho ─────────────────────────────────────────────────

export async function createZohoInvoice(
  settings: ZohoSettings,
  invoice: {
    customer_name: string;
    customer_email?: string;
    invoice_number: string;
    date: string;
    due_date?: string;
    total: number;
    description?: string;
  }
): Promise<{ invoice_id: string; invoice_number: string } | null> {
  try {
    const r = ZOHO_REGIONS[settings.region] || ZOHO_REGIONS.com;
    const token = await getAccessToken(settings);

    // Step 1: Get or create customer
    let customerId = '';

    if (invoice.customer_email) {
      const contactUrl = new URL(`${r.invoices}/api/v3/contacts`);
      contactUrl.searchParams.set('organization_id', settings.organization_id);
      contactUrl.searchParams.set('email', invoice.customer_email);

      const contactRes = await fetch(contactUrl.toString(), {
        headers: { Authorization: `Zoho-oauthtoken ${token}`, 'Content-Type': 'application/json' },
      });
      const contactData = await contactRes.json();
      const contacts = contactData.contacts || [];
      if (contacts.length > 0) {
        customerId = contacts[0].contact_id;
      }
    }

    if (!customerId) {
      const createContactUrl = new URL(`${r.invoices}/api/v3/contacts`);
      createContactUrl.searchParams.set('organization_id', settings.organization_id);

      const newContactRes = await fetch(createContactUrl.toString(), {
        method: 'POST',
        headers: { Authorization: `Zoho-oauthtoken ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_name: invoice.customer_name,
          email: invoice.customer_email || '',
        }),
      });
      const newContactData = await newContactRes.json();
      customerId = newContactData.contact?.contact_id;
    }

    if (!customerId) {
      console.error('Failed to get/create Zoho contact');
      return null;
    }

    // Step 2: Create invoice
    const createInvoiceUrl = new URL(`${r.invoices}/api/v3/invoices`);
    createInvoiceUrl.searchParams.set('organization_id', settings.organization_id);

    const zohoInvoiceRes = await fetch(createInvoiceUrl.toString(), {
      method: 'POST',
      headers: { Authorization: `Zoho-oauthtoken ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_id: customerId,
        date: invoice.date,
        due_date: invoice.due_date || invoice.date,
        invoice_number: invoice.invoice_number,
        line_items: [{
          name: invoice.description || `Photography Services - ${invoice.customer_name}`,
          rate: invoice.total,
          quantity: 1,
        }],
        notes: `Invoice for ${invoice.customer_name}`,
      }),
    });

    const zohoInvoiceData = await zohoInvoiceRes.json();

    if (zohoInvoiceData.code && zohoInvoiceData.code !== 0) {
      console.error('Zoho invoice creation error:', zohoInvoiceData.message);
      return null;
    }

    return {
      invoice_id: zohoInvoiceData.invoice?.invoice_id || '',
      invoice_number: zohoInvoiceData.invoice?.invoice_number || invoice.invoice_number,
    };
  } catch (e) {
    const err = e as Error;
    console.error('Failed to create Zoho invoice:', err.message);
    return null;
  }
}
