import { NextResponse } from 'next/server';
import { getPool } from '../../../../lib/db';
import { logAuditEvent, getRequestMetadata } from '../../../../lib/audit';

export const runtime = 'nodejs';

function withCORS(res: NextResponse) {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  res.headers.set('Access-Control-Allow-Methods', 'PUT, OPTIONS');
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
    const incidentId = params.id;
    if (!incidentId) {
      return withCORS(NextResponse.json({ error: 'Missing incident id' }, { status: 400 }));
    }
    const body = await req.json();
    const {
      summary,
      description,
      mitigationSteps,
      currentStatusText,
      closedDate, // ISO or null
      occurredAt, // ISO month/day
      changedByUserId,
    } = body || {};

    const pool = await getPool();

    // Resolve user role when changedByUserId provided (for user vs manager/edit flow)
    let userRole: string | null = null;
    if (changedByUserId) {
      try {
        const roleRs = await pool.request().input('UserId', changedByUserId).query(`
          SELECT Role FROM dbo.Users WHERE UserId = @UserId
        `);
        if (roleRs.recordset.length > 0) {
          userRole = roleRs.recordset[0].Role || null;
        }
      } catch (e) {
        // ignore
      }
    }
    const isUserEdit = userRole === 'user';

    // Get existing incident
    const existingRs = await pool.request().input('IncidentId', incidentId).query(`
      SELECT Summary, Description, MitigationSteps, CurrentStatusText, ClosedDateUtc, OccurredAtUtc
      FROM dbo.incidents_t WHERE IncidentId = @IncidentId
    `);
    const existing = existingRs.recordset[0];
    if (!existing) {
      return withCORS(NextResponse.json({ error: 'Incident not found' }, { status: 404 }));
    }

    const sets: string[] = [];
    const changes: Array<{ field: string; oldVal: any; newVal: any }> = [];

    if (summary !== undefined) {
      sets.push('Summary = @Summary');
      if (summary !== existing.Summary) {
        changes.push({ field: 'Summary', oldVal: existing.Summary, newVal: summary });
      }
    }
    if (description !== undefined) {
      sets.push('Description = @Description');
      if (description !== existing.Description) {
        changes.push({ field: 'Description', oldVal: existing.Description, newVal: description });
      }
    }
    if (mitigationSteps !== undefined) {
      sets.push('MitigationSteps = @MitigationSteps');
      if (mitigationSteps !== existing.MitigationSteps) {
        changes.push({ field: 'MitigationSteps', oldVal: existing.MitigationSteps, newVal: mitigationSteps });
      }
    }
    if (currentStatusText !== undefined) {
      sets.push('CurrentStatusText = @CurrentStatusText');
      if (currentStatusText !== existing.CurrentStatusText) {
        changes.push({ field: 'CurrentStatusText', oldVal: existing.CurrentStatusText, newVal: currentStatusText });
      }
    }
    if (closedDate !== undefined) {
      sets.push('ClosedDateUtc = @ClosedDateUtc');
      const oldClosedDate = existing.ClosedDateUtc ? new Date(existing.ClosedDateUtc).toISOString() : null;
      const newClosedDate = closedDate ? new Date(closedDate).toISOString() : null;
      if (oldClosedDate !== newClosedDate) {
        changes.push({ field: 'ClosedDateUtc', oldVal: oldClosedDate, newVal: newClosedDate });
      }
    }
    if (occurredAt !== undefined) {
      sets.push('OccurredAtUtc = @OccurredAtUtc');
      const oldOccurredAt = existing.OccurredAtUtc ? new Date(existing.OccurredAtUtc).toISOString() : null;
      const newOccurredAt = occurredAt ? new Date(occurredAt).toISOString() : null;
      if (oldOccurredAt !== newOccurredAt) {
        changes.push({ field: 'OccurredAtUtc', oldVal: oldOccurredAt, newVal: newOccurredAt });
      }
    }

    if (changes.length === 0) {
      return withCORS(NextResponse.json({ ok: true }));
    }

    if (!isUserEdit) {
      // Manager/Admin: update incidents_t directly
      sets.push('UpdatedAtUtc = SYSUTCDATETIME()');
      const rq = pool.request();
      rq.input('IncidentId', incidentId);
      if (summary !== undefined) rq.input('Summary', summary);
      if (description !== undefined) rq.input('Description', description);
      if (mitigationSteps !== undefined) rq.input('MitigationSteps', mitigationSteps);
      if (currentStatusText !== undefined) rq.input('CurrentStatusText', currentStatusText);
      if (closedDate !== undefined) rq.input('ClosedDateUtc', closedDate ? new Date(closedDate) : null);
      if (occurredAt !== undefined) rq.input('OccurredAtUtc', occurredAt ? new Date(occurredAt) : null);
      const sql = `
        UPDATE dbo.incidents_t
        SET ${sets.join(', ')}
        WHERE IncidentId = @IncidentId
      `;
      await rq.query(sql);

      if (changes.length > 0) {
        const { ipAddress, userAgent } = getRequestMetadata(req);
        let userName: string | null = null;
        if (changedByUserId) {
          try {
            const userRs = await pool.request().input('UserId', changedByUserId).query(`SELECT Name FROM dbo.Users WHERE UserId = @UserId`);
            if (userRs.recordset.length > 0) userName = userRs.recordset[0].Name || null;
          } catch (e) { /* ignore */ }
        }
        for (const change of changes) {
          await logAuditEvent({
            tableName: 'incidents_t',
            recordId: incidentId,
            operation: 'UPDATE',
            fieldName: change.field,
            oldValue: change.oldVal,
            newValue: change.newVal,
            changedByUserId: changedByUserId || null,
            changedByUserName: userName,
            ipAddress,
            userAgent
          });
        }
      }
    }

    // Insert into IncidentHistory (for user: Pending approval; for manager/admin: audit with null status)
    const approvalStatus = isUserEdit ? 'Pending' : null;
    const histRq = pool.request();
    histRq.input('IncidentId', incidentId);
    if (changedByUserId) histRq.input('ChangedByUserId', changedByUserId);
    histRq.input('ApprovalStatus', approvalStatus);
    const valuesSql: string[] = [];
    changes.forEach((c, idx) => {
      histRq.input(`Field${idx}`, c.field);
      histRq.input(`Old${idx}`, c.oldVal == null ? null : String(c.oldVal));
      histRq.input(`New${idx}`, c.newVal == null ? null : String(c.newVal));
      valuesSql.push(`(@IncidentId, SYSUTCDATETIME(), ${changedByUserId ? '@ChangedByUserId' : 'NULL'}, @Field${idx}, @Old${idx}, @New${idx}, @ApprovalStatus)`);
    });
    const insSql = `
      INSERT INTO dbo.IncidentHistory (IncidentId, ChangedAtUtc, ChangedByUserId, FieldName, OldValue, NewValue, ApprovalStatus)
      VALUES ${valuesSql.join(', ')};
    `;
    await histRq.query(insSql);

    return withCORS(NextResponse.json({ ok: true }));
  } catch (e: any) {
    return withCORS(NextResponse.json({ error: String(e?.message || e) }, { status: 500 }));
  }
}

