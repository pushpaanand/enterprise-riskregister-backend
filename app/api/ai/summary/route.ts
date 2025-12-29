import { NextResponse } from 'next/server';
// @ts-ignore - typing not required, used only to load env in dev
import dotenv from 'dotenv';
// Ensure env is loaded when running locally
// @ts-ignore
dotenv.config({ path: '.env.local' });
// try common alternative locations if not set
if (!process.env.AZURE_OPENAI_ENDPOINT) {
  // @ts-ignore
  dotenv.config({ path: '.env' });
  // @ts-ignore
  dotenv.config({ path: '../.env.local' });
  // @ts-ignore
  dotenv.config({ path: '../.env' });
  // @ts-ignore
  dotenv.config({ path: '../../.env.local' });
  // @ts-ignore
  dotenv.config({ path: '../../.env' });
}

export const runtime = 'nodejs';

type RiskInput = {
  riskNo?: string;
  name?: string;
  description?: string;
  impact?: string;
  likelihood?: string;
  status?: string;
  department?: string;
  createdAt?: string;
  updatedAt?: string;
};

function withCORS(res: NextResponse) {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  res.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  return res;
}

export async function POST(req: Request) {
  try {
    const { department, risks, role, userName, incidents } = await req.json() as { department?: string; risks: RiskInput[]; role?: string; userName?: string; incidents?: any[] };
    if (!Array.isArray(risks) || risks.length === 0) {
      return withCORS(NextResponse.json({ error: 'No risks provided' }, { status: 400 }));
    }

    // Resolve env with graceful fallbacks
    const endpointRaw = process.env.AZURE_OPENAI_ENDPOINT || process.env.NEXT_PUBLIC_AZURE_OPENAI_ENDPOINT;
    const apiKey = process.env.AZURE_OPENAI_API_KEY || process.env.NEXT_PUBLIC_AZURE_OPENAI_API_KEY;
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION || process.env.NEXT_PUBLIC_AZURE_OPENAI_API_VERSION;
    const deployment = process.env.AZURE_OPENAI_COMPLETION_DEPLOYMENT
      || process.env.AZURE_OPENAI_CHAT_DEPLOYMENT
      || process.env.NEXT_PUBLIC_AZURE_OPENAI_COMPLETION_DEPLOYMENT
      || process.env.NEXT_PUBLIC_AZURE_OPENAI_CHAT_DEPLOYMENT;

    if (!endpointRaw || !apiKey || !apiVersion) {
      return withCORS(NextResponse.json({ error: 'Missing Azure OpenAI environment configuration' }, { status: 500 }));
    }

    // Build prompt strictly from code (ignore any env custom prompts)
    const scopeLine = (() => {
      const dept = department || 'All';
      const r = (role || '').toLowerCase();
      if (r === 'user') return `Scope: Summarize ONLY the user's visible risks in department ${dept}. User: ${userName || 'N/A'}.`;
      if (r === 'manager') return `Scope: Summarize ONLY risks for department ${dept}.`;
      if (r === 'admin') return dept === 'All' ? 'Scope: Summarize organization-wide risks across all departments.' : `Scope: Summarize ONLY risks for department ${dept}.`;
      return `Scope: Summarize risks for department ${dept}.`;
    })();

    const userPrompt =  [
      scopeLine,
      'IMPORTANT: Use ONLY the lists provided below.',
      '',
      'RISK CATEGORIZATION RULES:',
      '1. RECENT SEVERE RISKS: Risks with Impact="Severe" that were updated within the last 30 days (check updatedAt date).',
      '2. OLD RISKS: Risks that have NOT been updated in the last 90 days (regardless of severity).',
      '3. OTHER RISKS: All other risks (Severe risks updated 30+ days ago, Significant, Moderate, Minor, or Negligible).',
      '',
      'OUTPUT FORMAT (strict - follow exactly):',
      '',
      'For each risk, use this format:',
      'RiskNo: Brief description (key issues) → Risk level/impact description.',
      '',
      'Examples:',
      '- IT004: Critical HR app flaws (SQL injection, IDOR, outdated framework) → High risk of data compromise.',
      '- IT002: SmartReport POC exposed production paths (SSH/FTP/RabbitMQ) → Severe risk of PHI breach & system compromise.',
      '- IT001: KOACH has weak authentication, SQL injection & exposed credentials → Elevated risk of unauthorized access.',
      '- IT003: UAT Azure Blob public access misconfig → Test data only; risk now mitigated.',
      '',
      'SPECIAL RULES FOR OLD RISKS (not updated in 90+ days):',
      '- For old risks, ALWAYS end with: → This risk not updated very long time please take the action against that risk.',
      '- Example: IT005: Legacy system vulnerabilities (outdated encryption) → This risk not updated very long time please take the action against that risk.',
      '',
      'ORGANIZATION:',
      '- Group risks by severity and recency:',
      '  1. List Recent Severe Risks first (Severe impact, updated within 30 days)',
      '  2. Then list Old Risks (not updated in 90+ days) with the special message',
      '  3. Then list Other Risks (all remaining risks)',
      incidents && Array.isArray(incidents) && incidents.length ? '  4. Finally, add "Incident Summary" section' : '',
      '',
      'FORMATTING DETAILS:',
      '- Use format: "RiskNo: Description → Impact statement."',
      '- One risk per line, no bullets, no numbering, no headers for individual risks.',
      '- Keep descriptions concise (max 50 words for the description part).',
      '- Use arrow "→" to separate description from impact.',
      '- End each line with a period.',
      '- Calculate dates from today: recent = updated within 30 days, old = not updated in 90+ days.',
      '- If updatedAt is missing or invalid, treat as old risk.',
      incidents && Array.isArray(incidents) && incidents.length ? '- After all risks, add an empty line and "Incident Summary:" header, then list incidents grouped by risk.' : ''
    ].filter(Boolean).join('\n');

    const risksText = risks.map((r) => {
      const createdAt = r.createdAt ? new Date(r.createdAt).toISOString().split('T')[0] : '';
      const updatedAt = r.updatedAt ? new Date(r.updatedAt).toISOString().split('T')[0] : '';
      return `- riskNo=${r.riskNo || ''}; name=${r.name || ''}; impact=${r.impact || ''}; likelihood=${r.likelihood || ''}; status=${r.status || ''}; dept=${r.department || ''}; createdAt=${createdAt}; updatedAt=${updatedAt}`;
    }).join('\n');
    const incidentsText = (Array.isArray(incidents) ? incidents : [])
      .map((i: any) => `- riskNo=${i.RiskNo || i.riskNo || ''}; summary=${i.Summary || i.summary || ''}; occurred=${(i.OccurredAtUtc || i.occurredAt || '').toString().slice(0,7)}; status=${i.CurrentStatusText || i.currentStatusText || ''}`)
      .join('\n');
// (redacted) risksText available for debugging if needed

const body: any = {
      messages: [
        { role: 'system', content: 'You are a professional risk management assistant. Format each risk as: "RiskNo: Brief description (key issues) → Risk level/impact description." Group risks by: (1) Recent Severe Risks (Severe, updated within 30 days), (2) Old Risks (not updated in 90+ days - end with "→ This risk not updated very long time please take the action against that risk"), (3) Other Risks. One risk per line. No bullets, no numbering, no bold. Calculate dates from today.' },
        { role: 'user', content: `${userPrompt}\n\nRisks:\n${risksText}${(incidents && Array.isArray(incidents) && incidents.length) ? `\n\nIncidents:\n${incidentsText}` : ''}` },
      ],
      temperature: 0.3,
      max_tokens: 1200,
    };
    if (deployment) body.model = deployment; // Azure accepts model set to deployment name

    const normalizedEndpoint = String(endpointRaw || '').trim().replace(/^http:\/\//i, 'https://');
    const isFullUrl = /\/openai\/deployments\//i.test(normalizedEndpoint);
    if (!isFullUrl && !deployment) {
      return withCORS(NextResponse.json({ error: 'Missing deployment name: set AZURE_OPENAI_COMPLETION_DEPLOYMENT' }, { status: 500 }));
    }

    // First attempt: use official AzureOpenAI SDK (more robust)
    try {
      const { AzureOpenAI } = await import('openai');
      const resourceEndpoint = isFullUrl ? normalizedEndpoint.split('/openai/')[0] : normalizedEndpoint.replace(/\/$/, '');
      // @ts-ignore
      const client = new AzureOpenAI({ endpoint: resourceEndpoint, apiKey, deployment, apiVersion });
      const response = await client.chat.completions.create({
        messages: body.messages,
        max_tokens: body.max_tokens,
        temperature: body.temperature,
        // Azure SDK requires model to be set; use deployment name here
        model: (deployment as any),
      });
      const content: string = response?.choices?.[0]?.message?.content || '';
      return withCORS(NextResponse.json({ summary: content }));
    } catch (sdkErr) {
      // Fallback: if using openai.azure.com, try cognitiveservices.azure.com (some networks allow-list only one)
      try {
        if (/\.openai\.azure\.com\/?$/i.test(normalizedEndpoint)) {
          const { AzureOpenAI } = await import('openai');
          const alt = normalizedEndpoint.replace(/\.openai\.azure\.com\/?$/i, '.cognitiveservices.azure.com/').replace(/\/$/, '');
          // @ts-ignore
          const client2 = new AzureOpenAI({ endpoint: alt, apiKey, deployment, apiVersion });
          const response2 = await client2.chat.completions.create({
            messages: body.messages,
            max_tokens: body.max_tokens,
            temperature: body.temperature,
            model: (deployment as any),
          });
          const content2: string = response2?.choices?.[0]?.message?.content || '';
          return withCORS(NextResponse.json({ summary: content2 }));
        }
      } catch {
        // ignore and fall through to REST fetch
      }
    }

    let url: string;
    if (isFullUrl) {
      // Use as-is, ensure api-version present
      const hasVersion = /[?&]api-version=/.test(normalizedEndpoint);
      url = hasVersion ? normalizedEndpoint : `${normalizedEndpoint}${normalizedEndpoint.includes('?') ? '&' : '?'}api-version=${encodeURIComponent(apiVersion)}`;
    } else {
      const base = normalizedEndpoint.replace(/\/$/, '');
      url = `${base}/openai/deployments/${deployment}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`;
    }
// (redacted) url available for debugging if needed
    // Timeout to avoid hanging requests
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    let resp: Response;
    try {
      resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'api-key': apiKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err: any) {
      clearTimeout(timeout);
      return withCORS(NextResponse.json({
        error: 'Upstream Azure OpenAI fetch failed',
        message: String(err?.message || err),
        hint: 'Verify endpoint format (https://<resource>.openai.azure.com), deployment name, and API version. Ensure outbound internet and DNS are available from the server.',
        details: {
          url,
          endpoint: normalizedEndpoint,
          deployment,
          apiVersion,
          aborted: err?.name === 'AbortError' || undefined,
        }
      }, { status: 502 }));
    } finally {
      clearTimeout(timeout);
    }
    if (!resp.ok) {
      const text = await resp.text();
      return withCORS(NextResponse.json({ error: `Azure OpenAI error: ${resp.status} ${text}` }, { status: 502 }));
    }
    const data = await resp.json();
    const content: string = data?.choices?.[0]?.message?.content || '';

    return withCORS(NextResponse.json({ summary: content }));
  } catch (e: any) {
    return withCORS(NextResponse.json({ error: String(e?.message || e) }, { status: 500 }));
  }
}

export async function OPTIONS() {
  return withCORS(new NextResponse(null, { status: 204 }));
}