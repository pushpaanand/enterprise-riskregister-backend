import { NextResponse } from 'next/server';
// @ts-ignore
import dotenv from 'dotenv';
// Load env for local dev
// @ts-ignore
dotenv.config({ path: '.env.local' });
// @ts-ignore
dotenv.config({ path: '.env' });
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

function withCORS(res: NextResponse) {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  res.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  return res;
}

export async function GET() {
  try {
    const endpointRaw = process.env.AZURE_OPENAI_ENDPOINT || process.env.NEXT_PUBLIC_AZURE_OPENAI_ENDPOINT;
    const apiKey = process.env.AZURE_OPENAI_API_KEY || process.env.NEXT_PUBLIC_AZURE_OPENAI_API_KEY;
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION || process.env.NEXT_PUBLIC_AZURE_OPENAI_API_VERSION || '2025-01-01-preview';
    const deployment = process.env.AZURE_OPENAI_COMPLETION_DEPLOYMENT
      || process.env.AZURE_OPENAI_CHAT_DEPLOYMENT
      || process.env.NEXT_PUBLIC_AZURE_OPENAI_COMPLETION_DEPLOYMENT
      || process.env.NEXT_PUBLIC_AZURE_OPENAI_CHAT_DEPLOYMENT;
console.log(apiVersion,deployment,endpointRaw,apiKey);
    if (!endpointRaw || !apiKey) {
      return withCORS(NextResponse.json({ error: 'Missing endpoint or apiKey in env' }, { status: 500 }));
    }

    const normalizedEndpoint = String(endpointRaw).trim().replace(/^http:\/\//i, 'https://');
    const isFullUrl = /\/openai\/deployments\//i.test(normalizedEndpoint);
    if (!isFullUrl && !deployment) {
      return withCORS(NextResponse.json({ error: 'Missing deployment name (AZURE_OPENAI_COMPLETION_DEPLOYMENT)' }, { status: 500 }));
    }

    const body = {
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: "Say 'hi'" },
      ],
      temperature: 0,
      max_tokens: 5,
      model: deployment,
    } as any;

    // If full Chat Completions URL is provided, use REST directly (helps validate URL and connectivity)
    if (isFullUrl) {
      const hasVersion = /[?&]api-version=/.test(normalizedEndpoint);
      const url = hasVersion ? normalizedEndpoint : `${normalizedEndpoint}${normalizedEndpoint.includes('?') ? '&' : '?'}api-version=${encodeURIComponent(apiVersion)}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      try {
        const r = await fetch(url, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'api-key': apiKey,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        const text = await r.text();
        if (!r.ok) return withCORS(NextResponse.json({ error: 'Azure error', status: r.status, body: text, used: { endpoint: normalizedEndpoint, apiVersion } }, { status: 502 }));
        let json: any = {};
        try { json = JSON.parse(text); } catch {}
        const reply = json?.choices?.[0]?.message?.content ?? text;
        return withCORS(NextResponse.json({ ok: true, reply, used: { endpoint: normalizedEndpoint, apiVersion } }));
      } catch (e: any) {
        return withCORS(NextResponse.json({ error: 'REST call failed', message: String(e?.message || e), used: { endpoint: normalizedEndpoint, apiVersion } }, { status: 502 }));
      } finally {
        clearTimeout(timeout);
      }
    }

    // Otherwise, use the SDK with the resource endpoint and deployment
    try {
      const { AzureOpenAI } = await import('openai');
      const resourceEndpoint = normalizedEndpoint.replace(/\/$/, '');
      // @ts-ignore
      const client = new AzureOpenAI({ endpoint: resourceEndpoint, apiKey, deployment, apiVersion });
      const resp = await client.chat.completions.create({
        messages: body.messages,
        temperature: body.temperature,
        max_tokens: body.max_tokens,
        model: deployment as any,
      });
      const text: string = resp?.choices?.[0]?.message?.content || '';
      return withCORS(NextResponse.json({ ok: true, reply: text, used: { endpoint: resourceEndpoint, deployment, apiVersion } }));
    } catch (sdkErr: any) {
      // Fallback: if openai.azure.com fails, try cognitiveservices.azure.com
      try {
        if (/\.openai\.azure\.com\/?$/i.test(normalizedEndpoint)) {
          const { AzureOpenAI } = await import('openai');
          const alt = normalizedEndpoint.replace(/\.openai\.azure\.com\/?$/i, '.cognitiveservices.azure.com/').replace(/\/$/, '');
          // @ts-ignore
          const client2 = new AzureOpenAI({ endpoint: alt, apiKey, deployment, apiVersion });
          const resp2 = await client2.chat.completions.create({
            messages: body.messages,
            temperature: body.temperature,
            max_tokens: body.max_tokens,
            model: deployment as any,
          });
          const text2: string = resp2?.choices?.[0]?.message?.content || '';
          return withCORS(NextResponse.json({ ok: true, reply: text2, used: { endpoint: alt, deployment, apiVersion } }));
        }
      } catch {}
      return withCORS(NextResponse.json({ error: 'SDK call failed', message: String(sdkErr?.message || sdkErr), used: { endpoint: normalizedEndpoint, deployment, apiVersion } }, { status: 502 }));
    }
  } catch (e: any) {
    return withCORS(NextResponse.json({ error: String(e?.message || e) }, { status: 500 }));
  }
}

export async function OPTIONS() {
  return withCORS(new NextResponse(null, { status: 204 }));
}