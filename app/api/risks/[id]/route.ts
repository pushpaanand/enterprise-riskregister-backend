import { NextResponse } from 'next/server';
import { getPool } from '../../../../lib/db';

export const runtime = 'nodejs';

function withCORS(res: NextResponse) {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  res.headers.set('Access-Control-Allow-Methods', 'PUT, DELETE, OPTIONS');
  return res;
}

export async function OPTIONS() {
  return withCORS(new NextResponse(null, { status: 204 }));
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const riskId = params.id;
    if (!riskId) {
      return withCORS(NextResponse.json({ error: 'Missing risk id' }, { status: 400 }));
    }
    const body = await req.json();
    const {
      description,
      impact,
      likelihood,
      status,
      identification,
      existingControlInPlace,
      planOfAction,
      category,
      riskIndicator,
      changedByUserId, // optional: who made the change (GUID)
      rejectionReason,
    } = body || {};

    const pool = await getPool();

    // Load existing row to detect changes
    const existingSel = await pool.request().input('RiskId', riskId).query(`
      SELECT Description, Impact, Likelihood, Status, Identification, ExistingControlInPlace, PlanOfAction, CategoryId AS Category, RejectionReason, RiskIndicator
      FROM dbo.Risks WHERE RiskId = @RiskId
    `);
    const existing = existingSel.recordset[0] || {};

    let normalizedRejectionReason = rejectionReason;
    if (normalizedRejectionReason !== undefined) {
      if (normalizedRejectionReason === null) {
        normalizedRejectionReason = null;
      } else {
        const trimmed = String(normalizedRejectionReason).trim();
        normalizedRejectionReason = trimmed.length ? trimmed : null;
      }
    }

    const nextStatusLower = status !== undefined ? String(status).toLowerCase() : undefined;
    if (status !== undefined && nextStatusLower !== 'rejected' && normalizedRejectionReason === undefined) {
      normalizedRejectionReason = null;
    }

    const finalStatus = status !== undefined ? status : existing.Status;
    const finalStatusLower = finalStatus ? String(finalStatus).toLowerCase() : '';
    const effectiveRejectionReason =
      normalizedRejectionReason !== undefined ? normalizedRejectionReason : existing.RejectionReason ?? null;
    if (finalStatusLower === 'rejected' && (effectiveRejectionReason === null || effectiveRejectionReason === '')) {
      return withCORS(NextResponse.json({ error: 'Rejection reason is required when rejecting a risk' }, { status: 400 }));
    }

    const rq = pool.request();
    rq.input('RiskId', riskId);
    if (description !== undefined) rq.input('Description', description);
    if (impact !== undefined) rq.input('Impact', impact);
    if (likelihood !== undefined) rq.input('Likelihood', likelihood);
    if (status !== undefined) rq.input('Status', status);
    if (identification !== undefined) rq.input('Identification', identification);
    if (existingControlInPlace !== undefined) rq.input('ExistingControlInPlace', existingControlInPlace);
    if (planOfAction !== undefined) rq.input('PlanOfAction', planOfAction);
    if (category !== undefined) {
      const categoryValue = category ? String(category).trim() : null;
      rq.input('CategoryId', categoryValue || null);
    }
    if (riskIndicator !== undefined) {
      const riskIndicatorValue = riskIndicator ? String(riskIndicator).trim() : null;
      rq.input('RiskIndicator', riskIndicatorValue || null);
    }
    if (normalizedRejectionReason !== undefined) rq.input('RejectionReason', normalizedRejectionReason);

    // Build dynamic SET clause only for provided fields
    const sets: string[] = [];
    if (description !== undefined) sets.push('Description = @Description');
    if (impact !== undefined) sets.push('Impact = @Impact');
    if (likelihood !== undefined) sets.push('Likelihood = @Likelihood');
    if (status !== undefined) sets.push('Status = @Status');
    if (identification !== undefined) sets.push('Identification = @Identification');
    if (existingControlInPlace !== undefined) sets.push('ExistingControlInPlace = @ExistingControlInPlace');
    if (planOfAction !== undefined) sets.push('PlanOfAction = @PlanOfAction');
    if (riskIndicator !== undefined) sets.push('RiskIndicator = @RiskIndicator');
    if (category !== undefined) sets.push('CategoryId = @CategoryId');
    if (rejectionReason !== undefined) sets.push('RejectionReason = @RejectionReason');
    sets.push('UpdatedAtUtc = SYSUTCDATETIME()');

    if (sets.length === 0) {
      return withCORS(NextResponse.json({ ok: true }));
    }

    const sql = `
      UPDATE dbo.Risks
      SET ${sets.join(', ')}
      WHERE RiskId = @RiskId
    `;
    await rq.query(sql);

    // Insert history rows for changed fields
    const changes: Array<{ field: string; oldVal: any; newVal: any }> = [];
    if (description !== undefined && description !== existing.Description) changes.push({ field: 'Description', oldVal: existing.Description, newVal: description });
    if (impact !== undefined && impact !== existing.Impact) changes.push({ field: 'Impact', oldVal: existing.Impact, newVal: impact });
    if (likelihood !== undefined && likelihood !== existing.Likelihood) changes.push({ field: 'Likelihood', oldVal: existing.Likelihood, newVal: likelihood });
    if (status !== undefined && status !== existing.Status) changes.push({ field: 'Status', oldVal: existing.Status, newVal: status });
    if (identification !== undefined && identification !== existing.Identification) changes.push({ field: 'Identification', oldVal: existing.Identification, newVal: identification });
    if (existingControlInPlace !== undefined && existingControlInPlace !== existing.ExistingControlInPlace) changes.push({ field: 'ExistingControlInPlace', oldVal: existing.ExistingControlInPlace, newVal: existingControlInPlace });
    if (planOfAction !== undefined && planOfAction !== existing.PlanOfAction) changes.push({ field: 'PlanOfAction', oldVal: existing.PlanOfAction, newVal: planOfAction });
    if (riskIndicator !== undefined) {
      const riskIndicatorValue = riskIndicator ? String(riskIndicator).trim() : null;
      const existingRiskIndicator = existing.RiskIndicator ?? null;
      if (riskIndicatorValue !== existingRiskIndicator) {
        changes.push({ field: 'RiskIndicator', oldVal: existingRiskIndicator, newVal: riskIndicatorValue });
      }
    }
    if (category !== undefined) {
      const categoryValue = category ? String(category).trim() : null;
      const existingCategory = existing.Category ?? null;
      if (categoryValue !== existingCategory) {
        changes.push({ field: 'Category', oldVal: existingCategory, newVal: categoryValue });
      }
    }
    if (normalizedRejectionReason !== undefined) {
      const normalizedExistingReason = existing.RejectionReason ?? null;
      const normalizedNewReason = normalizedRejectionReason;
      if (normalizedNewReason !== normalizedExistingReason) {
        changes.push({ field: 'RejectionReason', oldVal: normalizedExistingReason, newVal: normalizedNewReason });
      }
    }

    const statusChangedToNew = changes.some(
      (c) => c.field === 'Status' && String(c.newVal || '').toLowerCase() === 'new'
    );

    if (changes.length) {
      const histRq = pool.request();
      histRq.input('RiskId', riskId);
      if (changedByUserId) histRq.input('ChangedByUserId', changedByUserId);
      // Build a multi-values insert
      const valuesSql: string[] = [];
      changes.forEach((c, idx) => {
        histRq.input(`Field${idx}`, String(c.field));
        histRq.input(`Old${idx}`, c.oldVal === undefined || c.oldVal === null ? null : String(c.oldVal));
        histRq.input(`New${idx}`, c.newVal === undefined || c.newVal === null ? null : String(c.newVal));
        histRq.input(`Reason${idx}`, c.field === 'RejectionReason' ? (c.newVal ?? null) : null);
        valuesSql.push(`(@RiskId, SYSUTCDATETIME(), ${changedByUserId ? '@ChangedByUserId' : 'NULL'}, @Field${idx}, @Old${idx}, @New${idx}, @Reason${idx})`);
      });
      const insSql = `
        INSERT INTO dbo.RiskHistory (RiskId, ChangedAtUtc, ChangedByUserId, FieldName, OldValue, NewValue, RejectionReason)
        VALUES ${valuesSql.join(',')};
      `;
      await histRq.query(insSql);
    }

    if (statusChangedToNew) {
      try {
        const detailRs = await pool.request().input('RiskId', riskId).query(`
          SELECT r.RiskNo, r.Description, r.Impact, r.Likelihood,
                 r.Identification, r.PlanOfAction, d.Name AS DepartmentName
          FROM dbo.Risks r
          LEFT JOIN dbo.Departments d ON d.DepartmentId = r.DepartmentId
          WHERE r.RiskId = @RiskId
        `);
        const info = detailRs.recordset[0];
        const heads = await pool.request().query(`
          SELECT TOP 100 Name, Email, Unit
          FROM dbo.Users
          WHERE (IsUnitHead = 1 OR Role = 'unit_head') AND Email IS NOT NULL
        `);
        if (info && heads.recordset.length) {
          const toList = heads.recordset.map((h: any) => String(h.Email).trim()).filter(Boolean);
          if (toList.length) {
            // @ts-ignore
            const { default: nodemailer } = await import('nodemailer');
            const smtpUser = (process.env.SMTP_USER || 'productanalyst.pushpa@kauveryhospital.com').trim();
            const smtpPass = (process.env.SMTP_PASS || 'fprg nbfn ftat hngt').trim();
            const from = process.env.SMTP_FROM || smtpUser;
            if (smtpUser && smtpPass && from) {
              const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: { user: smtpUser, pass: smtpPass },
                tls: { rejectUnauthorized: process.env.SMTP_TLS_REJECT_UNAUTHORIZED === 'true' },
                debug: process.env.SMTP_DEBUG === 'true',
              });
              const subject = `Risk approved: ${info.RiskNo || ''} - ${info.Name}`;
              const text = `Dear Unit Head,

A risk was raised and approved in ${info.DepartmentName || 'the department'}.

Risk Details:
- Risk ID: ${info.RiskNo || 'N/A'}
- Title: ${info.Name || 'N/A'}
- Description: ${info.Description || 'N/A'}
- Impact: ${info.Impact || 'N/A'}
- Likelihood: ${info.Likelihood || 'N/A'}
- Identification: ${info.Identification || 'N/A'}
- Plan of Action: ${info.PlanOfAction || 'N/A'}

If your unit encounters a similar situation, please review and confirm any required actions.

Thanks.`;
              await transporter.sendMail({
                from,
                to: toList.join(','),
                subject,
                text,
              });
            } else {
              console.error('Unit head email skipped: SMTP credentials not configured');
            }
          }
        }
      } catch (notifyErr) {
        console.error('Unit head approval notify failed', notifyErr);
      }
    }

    return withCORS(NextResponse.json({ ok: true }));
  } catch (e: any) {
    return withCORS(NextResponse.json({ error: String(e?.message || e) }, { status: 500 }));
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const riskId = params.id;
    if (!riskId) {
      return withCORS(NextResponse.json({ error: 'Missing risk id' }, { status: 400 }));
    }
    const pool = await getPool();
    const rq = pool.request();
    rq.input('RiskId', riskId);
    // Remove dependent incidents first (foreign key protection)
    await rq.query(`DELETE FROM dbo.incidents_t WHERE RiskId = @RiskId`);
    // Delete risk
    const result = await rq.query(`DELETE FROM dbo.Risks WHERE RiskId = @RiskId`);
    // rowsAffected: [count] for each statement; second delete is at index 1 sometimes, but we can just reply ok
    return withCORS(NextResponse.json({ ok: true }));
  } catch (e: any) {
    return withCORS(NextResponse.json({ error: String(e?.message || e) }, { status: 500 }));
  }
}

