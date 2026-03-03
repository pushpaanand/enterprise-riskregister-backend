import { NextResponse } from 'next/server';
import { getPool } from '../../../../../lib/db';

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

// Approve pending incident edit - apply IncidentHistory changes to incidents_t
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const incidentId = params.id;
    const body = await req.json();
    const { historyId, approvedByUserId } = body || {};

    if (!incidentId || !historyId) {
      return withCORS(NextResponse.json({ error: 'Missing incidentId or historyId' }, { status: 400 }));
    }

    const pool = await getPool();

    const historyRs = await pool.request()
      .input('HistoryId', historyId)
      .input('IncidentId', incidentId)
      .query(`
        SELECT FieldName, NewValue
        FROM dbo.IncidentHistory
        WHERE IncidentHistoryId = @HistoryId AND IncidentId = @IncidentId AND ApprovalStatus = 'Pending'
      `);

    if (historyRs.recordset.length === 0) {
      return withCORS(NextResponse.json({ error: 'Pending edit not found or already processed' }, { status: 404 }));
    }

    const allPendingRs = await pool.request()
      .input('IncidentId', incidentId)
      .query(`
        SELECT FieldName, NewValue
        FROM dbo.IncidentHistory
        WHERE IncidentId = @IncidentId AND ApprovalStatus = 'Pending'
        ORDER BY ChangedAtUtc
      `);

    const updateFields: string[] = [];
    const updateRq = pool.request();
    updateRq.input('IncidentId', incidentId);

    allPendingRs.recordset.forEach((edit: any) => {
      const field = edit.FieldName;
      const value = edit.NewValue;
      if (field === 'Summary') {
        updateRq.input('Summary', value);
        updateFields.push('Summary = @Summary');
      } else if (field === 'Description') {
        updateRq.input('Description', value);
        updateFields.push('Description = @Description');
      } else if (field === 'MitigationSteps') {
        updateRq.input('MitigationSteps', value);
        updateFields.push('MitigationSteps = @MitigationSteps');
      } else if (field === 'CurrentStatusText') {
        updateRq.input('CurrentStatusText', value);
        updateFields.push('CurrentStatusText = @CurrentStatusText');
      } else if (field === 'ClosedDateUtc') {
        updateRq.input('ClosedDateUtc', value);
        updateFields.push('ClosedDateUtc = @ClosedDateUtc');
      } else if (field === 'OccurredAtUtc') {
        updateRq.input('OccurredAtUtc', value);
        updateFields.push('OccurredAtUtc = @OccurredAtUtc');
      }
    });

    if (updateFields.length > 0) {
      updateFields.push('UpdatedAtUtc = SYSUTCDATETIME()');
      await updateRq.query(`
        UPDATE dbo.incidents_t
        SET ${updateFields.join(', ')}
        WHERE IncidentId = @IncidentId
      `);
    }

    await pool.request()
      .input('IncidentId', incidentId)
      .input('ApprovedByUserId', approvedByUserId || null)
      .query(`
        UPDATE dbo.IncidentHistory
        SET ApprovalStatus = 'Approved',
            ApprovedByUserId = @ApprovedByUserId,
            ApprovedAtUtc = SYSUTCDATETIME()
        WHERE IncidentId = @IncidentId AND ApprovalStatus = 'Pending'
      `);

    return withCORS(NextResponse.json({ ok: true, message: 'Incident edit approved and applied' }));
  } catch (e: any) {
    return withCORS(NextResponse.json({ error: String(e?.message || e) }, { status: 500 }));
  }
}
