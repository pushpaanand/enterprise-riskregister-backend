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

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const incidentId = params.id;
    const body = await req.json();
    const { historyId, approvedByUserId, rejectionReason } = body || {};

    if (!incidentId) {
      return withCORS(NextResponse.json({ error: 'Missing incidentId' }, { status: 400 }));
    }

    const pool = await getPool();
    const updateRq = pool.request();
    updateRq.input('IncidentId', incidentId);
    updateRq.input('ApprovedByUserId', approvedByUserId || null);
    updateRq.input('RejectionReason', rejectionReason || null);

    let updateSql = `
      UPDATE dbo.IncidentHistory
      SET ApprovalStatus = 'Rejected',
          ApprovedByUserId = @ApprovedByUserId,
          ApprovedAtUtc = SYSUTCDATETIME(),
          RejectionReason = @RejectionReason
      WHERE IncidentId = @IncidentId AND ApprovalStatus = 'Pending'
    `;
    if (historyId != null) {
      updateRq.input('HistoryId', historyId);
      updateSql = `
      UPDATE dbo.IncidentHistory
      SET ApprovalStatus = 'Rejected',
          ApprovedByUserId = @ApprovedByUserId,
          ApprovedAtUtc = SYSUTCDATETIME(),
          RejectionReason = @RejectionReason
      WHERE IncidentId = @IncidentId AND IncidentHistoryId = @HistoryId AND ApprovalStatus = 'Pending'
      `;
    }

    await updateRq.query(updateSql);
    return withCORS(NextResponse.json({ ok: true, message: 'Incident edit rejected' }));
  } catch (e: any) {
    return withCORS(NextResponse.json({ error: String(e?.message || e) }, { status: 500 }));
  }
}
