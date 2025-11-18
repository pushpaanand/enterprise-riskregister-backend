import { NextResponse } from 'next/server';
import { getPool } from '../../../lib/db';

export const runtime = 'nodejs';

function isGuid(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const re = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  const nil = /^00000000-0000-0000-0000-000000000000$/;
  return re.test(value) || nil.test(value);
}

function derivePrefixFromName(input: string | null | undefined): string {
  if (!input) return 'R';
  const match = String(input)
    .trim()
    .toUpperCase()
    .match(/[A-Z]/);
  return match ? match[0] : 'R';
}

export async function GET() {
  const pool = await getPool();
  const rs = await pool.request().query(`
    SELECT r.RiskId, r.RiskNo, r.DepartmentId, d.Name AS Department, r.Name, r.Description,
           r.CategoryId,
           r.Identification, r.ExistingControlInPlace, r.PlanOfAction,
           r.Impact, r.Likelihood, r.Status, r.OwnerId, o.Name AS Owner,
           r.CreatedByUserId, u.Name AS CreatedByName,
           r.CreatedAtUtc, r.UpdatedAtUtc,
           r.RejectionReason
    FROM dbo.Risks r
    JOIN dbo.Departments d ON d.DepartmentId = r.DepartmentId
    LEFT JOIN dbo.Owners o ON o.OwnerId = r.OwnerId
    LEFT JOIN dbo.Users u ON u.UserId = r.CreatedByUserId
    ORDER BY d.Name, r.RiskNo
  `);
  const res = NextResponse.json(rs.recordset);
  res.headers.set('Access-Control-Allow-Origin', '*');
  return res;
}

export async function OPTIONS() {
  const res = new NextResponse(null, { status: 204 });
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  res.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  return res;
}

export async function POST(req: Request) {
  const body = await req.json();
  const pool = await getPool();
  // Resolve DepartmentId if not provided using CreatedByUserId
  let departmentId = body.departmentId || null;
  const providedDepartmentName = [body.departmentName, body.department, body.department_name]
    .find((val) => typeof val === 'string' && val.trim().length);
  let departmentName: string | null = providedDepartmentName ? String(providedDepartmentName).trim() : null;

  const applyDepartment = (id: any, name?: any) => {
    if (id) departmentId = id;
    if (!departmentName && typeof name === 'string') {
      const trimmed = name.trim();
      if (trimmed.length) departmentName = trimmed;
    }
  };

  if (departmentId && !departmentName) {
    const depRow = await pool
      .request()
      .input('dep', departmentId)
      .query(`SELECT Name FROM dbo.Departments WHERE DepartmentId = @dep`);
    if (depRow.recordset.length) {
      applyDepartment(departmentId, depRow.recordset[0].Name);
    }
  }

  if (!departmentId && body.createdByUserId) {
    if (isGuid(body.createdByUserId)) {
      const dep = await pool
        .request()
        .input('uid', body.createdByUserId)
        .query(`
          SELECT u.DepartmentId, d.Name AS DepartmentName
          FROM dbo.Users u
          LEFT JOIN dbo.Departments d ON d.DepartmentId = u.DepartmentId
          WHERE u.UserId = @uid
        `);
      if (dep.recordset.length) {
        applyDepartment(dep.recordset[0].DepartmentId, dep.recordset[0].DepartmentName);
      }
    }
  }
  // Fallback: try resolve by creator name if provided
  if (!departmentId && body.createdByName) {
    const depByName = await pool
      .request()
      .input('uname', body.createdByName)
      .query(`
      SELECT TOP 1 u.DepartmentId, d.Name AS DepartmentName
      FROM dbo.Users u
      LEFT JOIN dbo.Departments d ON d.DepartmentId = u.DepartmentId
      WHERE u.Name = @uname
    `);
    if (depByName.recordset.length) {
      applyDepartment(depByName.recordset[0].DepartmentId, depByName.recordset[0].DepartmentName);
    }
  }
  if (!departmentId) {
    const depAny = await pool
      .request()
      .query(`SELECT TOP 1 DepartmentId, Name FROM dbo.Departments ORDER BY Name`);
    const fallback = depAny.recordset[0];
    if (fallback) {
      applyDepartment(fallback.DepartmentId, fallback.Name);
    } else {
      departmentId = null;
    }
  }
  if (departmentId && !departmentName) {
    const depRow = await pool
      .request()
      .input('dep', departmentId)
      .query(`SELECT Name FROM dbo.Departments WHERE DepartmentId = @dep`);
    if (depRow.recordset.length) {
      applyDepartment(departmentId, depRow.recordset[0].Name);
    }
  }
  // Auto-generate risk number if missing
  let riskNo = body.riskNo || null;
  const prefix = derivePrefixFromName(departmentName);
  const prefixPattern = `${prefix}%`;

  if (!riskNo && departmentId) {
    const rsNo = await pool
      .request()
      .input('dep', departmentId)
      .input('prefix', prefixPattern)
      .query(`
      SELECT MAX(CAST(SUBSTRING(RiskNo, 2, 10) AS INT)) AS MaxNo
      FROM dbo.Risks
      WHERE DepartmentId = @dep
        AND UPPER(RiskNo) LIKE @prefix
        AND ISNUMERIC(SUBSTRING(RiskNo,2,10)) = 1
    `);
    const nextNo = (rsNo.recordset[0]?.MaxNo || 0) + 1;
    riskNo = `${prefix}${String(nextNo).padStart(3, '0')}`;
  } else if (!riskNo) {
    riskNo = `${prefix}001`;
  }
  const rq = pool.request();
  rq.input('DepartmentId', departmentId);
  rq.input('RiskNo', riskNo || body.riskNo);
  rq.input('Name', body.name);
  rq.input('Description', body.description);
  rq.input('Impact', body.impact);
  rq.input('Likelihood', body.likelihood);
  rq.input('Status', body.status);
  // Resolve OwnerId: ensure non-null to satisfy NOT NULL constraint
  let ownerIdToUse: string | null = isGuid(body.ownerId) ? body.ownerId : null;
  if (!ownerIdToUse) {
    // Prefer an owner from the database if any exist
    const ownerAny = await pool.request().query(`SELECT TOP 1 OwnerId FROM dbo.Owners ORDER BY Name`);
    ownerIdToUse = ownerAny.recordset[0]?.OwnerId || null;
  }
  if (!ownerIdToUse) {
    // Create a fallback owner
    const createdOwner = await pool.request().input('OwnerName', 'Default Owner').query(`
      DECLARE @oid UNIQUEIDENTIFIER = NEWID();
      INSERT INTO dbo.Owners (OwnerId, Name) VALUES (@oid, @OwnerName);
      SELECT @oid AS OwnerId;
    `);
    ownerIdToUse = createdOwner.recordset[0]?.OwnerId || null;
  }
  rq.input('OwnerId', ownerIdToUse);
  rq.input('CreatedByUserId', isGuid(body.createdByUserId) ? body.createdByUserId : null);
  rq.input('CategoryId', body.categoryId || null);
  rq.input('Identification', body.identification || null);
  rq.input('ExistingControlInPlace', body.existingControlInPlace || null);
  rq.input('PlanOfAction', body.planOfAction || null);
  rq.input('RejectionReason', body.rejectionReason ?? null);
  const ins = await rq.query(`
    DECLARE @id UNIQUEIDENTIFIER = NEWID();
    INSERT INTO dbo.Risks (RiskId, DepartmentId, RiskNo, Name, Description, CategoryId, Identification, ExistingControlInPlace, PlanOfAction, Impact, Likelihood, Status, OwnerId, RejectionReason, CreatedByUserId, CreatedAtUtc, UpdatedAtUtc)
    VALUES (@id, @DepartmentId, @RiskNo, @Name, @Description, @CategoryId, @Identification, @ExistingControlInPlace, @PlanOfAction, @Impact, @Likelihood, @Status, @OwnerId, @RejectionReason, @CreatedByUserId, SYSUTCDATETIME(), SYSUTCDATETIME());
    SELECT r.RiskId, r.RiskNo, r.DepartmentId, d.Name AS Department, r.Name, r.Description,
           r.CategoryId, c.Name AS CategoryName, r.Identification, r.ExistingControlInPlace, r.PlanOfAction,
           r.Impact, r.Likelihood, r.Status, r.OwnerId, o.Name AS OwnerName,
           r.CreatedByUserId, u.Name AS CreatedByName,
           r.CreatedAtUtc, r.UpdatedAtUtc,
           r.RejectionReason
    FROM dbo.Risks r
    JOIN dbo.Departments d ON d.DepartmentId = r.DepartmentId
    LEFT JOIN dbo.RiskCategories c ON c.CategoryId = r.CategoryId
    LEFT JOIN dbo.Owners o ON o.OwnerId = r.OwnerId
    LEFT JOIN dbo.Users u ON u.UserId = r.CreatedByUserId
    WHERE r.RiskId = @id;
  `);
  const newRisk = ins.recordset[0];
  // Notify department managers via SMTP (best effort)
  try {
    const mgrs = await pool.request().input('dep', newRisk.DepartmentId).query(`
      SELECT TOP 5 Email FROM dbo.Users WHERE Role = 'manager' AND DepartmentId = @dep AND Email IS NOT NULL
    `);
    if (mgrs.recordset.length) {
      const to = mgrs.recordset.map((m:any)=>m.Email).join(',');
      const toList: string[] = mgrs.recordset.map((m:any)=>String(m.Email));

      const stringReplacements: Record<string, string> = {
        riskId: newRisk.RiskId ? String(newRisk.RiskId) : '',
        riskNo: newRisk.RiskNo ? String(newRisk.RiskNo) : '',
        departmentId: newRisk.DepartmentId ? String(newRisk.DepartmentId) : '',
        rejectionReason: newRisk.RejectionReason ? String(newRisk.RejectionReason) : '',
      };
      const buildFromTemplate = (template?: string | null): string | null => {
        if (!template) return null;
        const trimmed = template.trim();
        if (!trimmed) return null;
        return trimmed.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key: string) => encodeURIComponent(stringReplacements[key] ?? ''));
      };
      const portalBaseCandidate =
        [process.env.RISK_PORTAL_BASE_URL, process.env.APP_BASE_URL, process.env.PORTAL_BASE_URL, process.env.NEXT_PUBLIC_RISK_PORTAL_URL, process.env.NEXT_PUBLIC_APP_BASE_URL]
          .find((val) => val && String(val).trim().length) || 'http://localhost:3000';
      const normalizedPortalBase = portalBaseCandidate ? String(portalBaseCandidate).trim().replace(/\/$/, '') : null;
      const defaultViewLink = normalizedPortalBase ? `${normalizedPortalBase}/risks/${encodeURIComponent(stringReplacements.riskId)}` : null;
      const defaultApproveLink = normalizedPortalBase ? `${defaultViewLink}?action=approve` : null;
      const viewLink = buildFromTemplate(process.env.RISK_VIEW_LINK_TEMPLATE || process.env.RISK_DETAILS_LINK_TEMPLATE) ?? defaultViewLink;
      const approvalLink = buildFromTemplate(process.env.RISK_APPROVAL_LINK_TEMPLATE || process.env.RISK_APPROVAL_URL_TEMPLATE) ?? defaultApproveLink ?? viewLink ?? null;

      const formatValue = (value: any): string => {
        if (value === null || value === undefined) return '—';
        if (value instanceof Date) return value.toISOString();
        if (typeof value === 'string') {
          const trimmed = value.trim();
          return trimmed.length ? trimmed : '—';
        }
        if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean') return String(value);
        try {
          return JSON.stringify(value);
        } catch {
          return String(value);
        }
      };

      const rawEntries = [       
        { label: 'Risk ID', value: newRisk.RiskNo },
        { label: 'Department', value: newRisk.Department },
        { label: 'Description', value: newRisk.Description },
        { label: 'Category', value: newRisk.CategoryName },
        { label: 'Identification', value: newRisk.Identification },
        { label: 'Existing Control In Place', value: newRisk.ExistingControlInPlace },
        { label: 'Plan Of Action', value: newRisk.PlanOfAction },
        { label: 'Impact', value: newRisk.Impact },
        { label: 'Likelihood', value: newRisk.Likelihood },
        { label: 'Status', value: newRisk.Status },
        { label: 'Rejection Reason', value: newRisk.RejectionReason },
        { label: 'Raised By', value: newRisk.CreatedByName },
        { label: 'Created At', value: newRisk.CreatedAtUtc },
      ];
      const detailEntries = rawEntries.map(({ label, value }) => ({ label, value: formatValue(value) }));
      const detailLines = detailEntries.map((entry) => `${entry.label}: ${entry.value}`).join('\n');

      const linkLines: string[] = [];
      if (viewLink) linkLines.push(`View Risk: ${viewLink}`);
      if (approvalLink) linkLines.push(`Approve Risk: ${approvalLink}`);

      const textBodyParts = [
        'Dear Manager,',
        '',
        'A new risk has been raised and requires your review.',
        '',
        detailLines,
      ];
      if (linkLines.length) {
        textBodyParts.push('', ...linkLines);
      }
      textBodyParts.push('', 'Thanks.');
      const textBody = textBodyParts.join('\n');

      const escapeHtml = (input: string) =>
        input.replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      const toHtmlValue = (value: string) => escapeHtml(value).replace(/\r?\n/g, '<br />');
      const htmlRows = detailEntries.map(({ label, value }) => `
        <tr>
          <td style="padding:4px 8px;font-weight:600;vertical-align:top;">${escapeHtml(label)}</td>
          <td style="padding:4px 8px;vertical-align:top;">${toHtmlValue(value)}</td>
        </tr>
      `).join('');
      const htmlLinkParts: string[] = [];
      if (viewLink) {
        htmlLinkParts.push(`<a href="${escapeHtml(viewLink)}" target="_blank" rel="noopener noreferrer">View Risk</a>`);
      }
      if (approvalLink) {
        htmlLinkParts.push(`<a href="${escapeHtml(approvalLink)}" target="_blank" rel="noopener noreferrer">Approve Risk</a>`);
      }
      const linksHtml = htmlLinkParts.length ? `<p>${htmlLinkParts.join(' | ')}</p>` : '';
      const htmlBody = `
        <p>Dear Manager,</p>
        <p>A new risk has been raised and requires your review.</p>
        <table style="border-collapse:collapse;width:100%;max-width:640px;font-family:Arial,Helvetica,sans-serif;font-size:14px;">
          <tbody>
            ${htmlRows}
          </tbody>
        </table>
        ${linksHtml}
        <p>Thanks.</p>
      `;

      // @ts-ignore - nodemailer types not required on server
      const { default: nodemailer } = await import('nodemailer');
      const from = process.env.SMTP_FROM || (process.env.SMTP_USER || 'productanalyst.pushpa@kauveryhospital.com');
      const subject = `Approval needed: ${newRisk.RiskNo} - ${newRisk.Name}`;

      // Skip email entirely if disabled
      const smtpEnabled = (process.env.SMTP_ENABLED || 'true').toLowerCase() !== 'false';
      if (!smtpEnabled) {
        console.warn('Email notify skipped: SMTP_ENABLED=false');
      } else {
        // Prepare optional Graph fallback
        const tenant = process.env.MS_TENANT_ID;
        const clientId = process.env.MS_CLIENT_ID;
        const clientSecret = process.env.MS_CLIENT_SECRET;
        const graphSender = process.env.MS_GRAPH_SENDER || from;
        const canUseGraph = Boolean(tenant && clientId && clientSecret && graphSender);
        const sendViaGraph = async () => {
          // Get token
          const tokenResp = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: clientId!,
              client_secret: clientSecret!,
              scope: 'https://graph.microsoft.com/.default',
              grant_type: 'client_credentials'
            })
          });
          if (!tokenResp.ok) {
            const t = await tokenResp.text();
            throw new Error(`Graph token failed: ${tokenResp.status} ${t}`);
          }
          const tokenJson: any = await tokenResp.json();
          const accessToken = tokenJson.access_token as string;
          // Send email via Graph
          const recipients = toList.map(addr => ({ emailAddress: { address: addr } }));
          const graphBody = {
            message: {
              subject,
              body: { contentType: 'HTML', content: htmlBody },
              toRecipients: recipients
            },
            saveToSentItems: 'false'
          };
          const graphResp = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(graphSender)}/sendMail`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify(graphBody)
          });
          if (!graphResp.ok) {
            const gtxt = await graphResp.text();
            throw new Error(`Graph sendMail failed: ${graphResp.status} ${gtxt}`);
          }
          console.info('Email sent via Microsoft Graph');
        };

        // Try SMTP with Gmail only
        const isGmail = true;
        const smtpSecure = false; // Gmail via STARTTLS on 587 by default
        const rejectUnauthorized = process.env.SMTP_TLS_REJECT_UNAUTHORIZED === 'true';
        const smtpUser = (process.env.SMTP_USER || 'productanalyst.pushpa@kauveryhospital.com').trim();
        const smtpPass = (process.env.SMTP_PASS || 'fprg nbfn ftat hngt').trim();
        const hasSmtpCreds = smtpUser !== '' && smtpPass !== '';
        // If SMTP credentials are missing, prefer Graph fallback (if configured)
        if (!hasSmtpCreds) {
          if (canUseGraph) {
            try {
              await sendViaGraph();
            } catch (graphErr) {
              console.error('Email notify failed via Graph (no SMTP creds)', graphErr);
            }
          } else {
            console.error('Email notify skipped: missing SMTP_USER/SMTP_PASS and no Graph credentials configured');
          }
          // Stop further SMTP attempts
          return;
        }

        const auth = { user: smtpUser, pass: smtpPass };
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth,
          tls: { rejectUnauthorized },
          debug: process.env.SMTP_DEBUG === 'true',
        });
        try {
          await transporter.sendMail({ from, to, subject, text: textBody, html: htmlBody });
        } catch (smtpErr: any) {
          // On SMTP auth failure, optionally fall back to Microsoft Graph if configured
          const maybeEAUTH = (smtpErr && (smtpErr.code === 'EAUTH' || `${smtpErr}`.includes('535') || `${smtpErr}`.toLowerCase().includes('missing credentials'))) ? true : false;
          if (maybeEAUTH && canUseGraph) {
            try {
              await sendViaGraph();
            } catch (graphErr) {
              console.error('Email notify failed via SMTP and Graph', graphErr);
            }
          } else {
            console.error('Email notify failed via SMTP', smtpErr);
          }
        }
      }
    }
  } catch (e) {
    console.error('Email notify failed', e);
  }
  const res = NextResponse.json({ ok: true, risk: newRisk }, { status: 201 });
  res.headers.set('Access-Control-Allow-Origin', '*');
  return res;
}