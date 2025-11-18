import { NextResponse } from 'next/server';
import { getPool } from '../../../../lib/db';

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
    } = body || {};

    const pool = await getPool();
    const rq = pool.request();
    rq.input('IncidentId', incidentId);
    if (summary !== undefined) rq.input('Summary', summary);
    if (description !== undefined) rq.input('Description', description);
    if (mitigationSteps !== undefined) rq.input('MitigationSteps', mitigationSteps);
    if (currentStatusText !== undefined) rq.input('CurrentStatusText', currentStatusText);
    if (closedDate !== undefined) rq.input('ClosedDateUtc', closedDate ? new Date(closedDate) : null);
    if (occurredAt !== undefined) rq.input('OccurredAtUtc', occurredAt ? new Date(occurredAt) : null);

    const sets: string[] = [];
    if (summary !== undefined) sets.push('Summary = @Summary');
    if (description !== undefined) sets.push('Description = @Description');
    if (mitigationSteps !== undefined) sets.push('MitigationSteps = @MitigationSteps');
    if (currentStatusText !== undefined) sets.push('CurrentStatusText = @CurrentStatusText');
    if (closedDate !== undefined) sets.push('ClosedDateUtc = @ClosedDateUtc');
    if (occurredAt !== undefined) sets.push('OccurredAtUtc = @OccurredAtUtc');
    sets.push('UpdatedAtUtc = SYSUTCDATETIME()');

    if (sets.length === 0) {
      return withCORS(NextResponse.json({ ok: true }));
    }

    const sql = `
      UPDATE dbo.incidents_t
      SET ${sets.join(', ')}
      WHERE IncidentId = @IncidentId
    `;
    await rq.query(sql);
    return withCORS(NextResponse.json({ ok: true }));
  } catch (e: any) {
    return withCORS(NextResponse.json({ error: String(e?.message || e) }, { status: 500 }));
  }
}

