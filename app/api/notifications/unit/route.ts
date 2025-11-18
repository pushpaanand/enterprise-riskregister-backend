import { NextResponse } from 'next/server';
import { getPool } from '../../../../lib/db';

export const runtime = 'nodejs';

function withCORS(res: NextResponse) {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  res.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  return res;
}

export async function OPTIONS() {
  return withCORS(new NextResponse(null, { status: 204 }));
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const userIds: string[] = Array.isArray(body.userIds) ? body.userIds : [];
    const emails: string[] = Array.isArray(body.emails) ? body.emails : [];
    const subject: string = String(body.subject || 'Unit Risk Notification');
    const content: string = String(body.content || '');

    const recipients: string[] = [];
    // Collect emails from explicit list
    for (const e of emails) {
      const t = String(e || '').trim();
      if (t) recipients.push(t);
    }
    // Collect emails by userIds from DB
    if (userIds.length) {
      const pool = await getPool();
      const inList = userIds.map(id => `'${id.replace(/'/g, "''")}'`).join(',');
      const rs = await pool.request().query(`
        SELECT Email FROM dbo.Users WHERE UserId IN (${inList}) AND Email IS NOT NULL
      `);
      for (const row of rs.recordset) {
        const t = String(row.Email || '').trim();
        if (t) recipients.push(t);
      }
    }

    const uniqueRecipients = Array.from(new Set(recipients));
    if (uniqueRecipients.length === 0) {
      return withCORS(NextResponse.json({ error: 'No recipients' }, { status: 400 }));
    }

    // Send via Gmail (configured globally in risks route) or fallback simple transporter
    // @ts-ignore
    const { default: nodemailer } = await import('nodemailer');
    const rejectUnauthorized = process.env.SMTP_TLS_REJECT_UNAUTHORIZED === 'true';
    const smtpUser = (process.env.SMTP_USER || 'productanalyst.pushpa@kauveryhospital.com').trim();
    const smtpPass = (process.env.SMTP_PASS || 'fprg nbfn ftat hngt').trim();
    const from = process.env.SMTP_FROM || smtpUser;
    if (!smtpUser || !smtpPass || !from) {
      return withCORS(NextResponse.json({ error: 'SMTP not configured' }, { status: 500 }));
    }
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: smtpUser, pass: smtpPass },
      tls: { rejectUnauthorized },
      debug: process.env.SMTP_DEBUG === 'true'
    });
    await transporter.sendMail({
      from,
      to: uniqueRecipients.join(','),
      subject,
      text: content
    });

    return withCORS(NextResponse.json({ ok: true, sent: uniqueRecipients.length }));
  } catch (e: any) {
    return withCORS(NextResponse.json({ error: String(e?.message || e) }, { status: 500 }));
  }
}


