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

// Reject new incident (user-created, was Pending)
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const incidentId = params.id;
    const body = await req.json();
    const { rejectionReason } = body || {};

    if (!incidentId) {
      return withCORS(NextResponse.json({ error: 'Missing incidentId' }, { status: 400 }));
    }

    const pool = await getPool();
    const rq = pool.request();
    rq.input('IncidentId', incidentId);
    rq.input('RejectionReason', rejectionReason || null);

    const rs = await rq.query(`
      UPDATE dbo.incidents_t
      SET ApprovalStatus = 'Rejected',
          RejectionReason = @RejectionReason
      WHERE IncidentId = @IncidentId AND ApprovalStatus = 'Pending';
      SELECT @@ROWCOUNT AS Updated;
    `);
    const updated = rs.recordset[0]?.Updated;
    if (!updated) {
      return withCORS(NextResponse.json({ error: 'Incident not found or not pending' }, { status: 404 }));
    }
    return withCORS(NextResponse.json({ ok: true, message: 'Incident rejected' }));
  } catch (e: any) {
    return withCORS(NextResponse.json({ error: String(e?.message || e) }, { status: 500 }));
  }
}
