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

// Reject pending edit - marks pending edits as rejected
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const riskId = params.id;
    const body = await req.json();
    const { historyId, approvedByUserId, rejectionReason } = body || {}; // historyId is optional - if not provided, reject all pending

    if (!riskId) {
      return withCORS(NextResponse.json({ error: 'Missing riskId' }, { status: 400 }));
    }

    const pool = await getPool();

    // Update pending edits to Rejected
    const updateRq = pool.request();
    updateRq.input('RiskId', riskId);
    updateRq.input('ApprovedByUserId', approvedByUserId || null);
    updateRq.input('RejectionReason', rejectionReason || null);

    let updateSql = `
      UPDATE dbo.RiskHistory
      SET ApprovalStatus = 'Rejected',
          ApprovedByUserId = @ApprovedByUserId,
          ApprovedAtUtc = SYSUTCDATETIME()
    `;

    if (rejectionReason) {
      updateSql += `, RejectionReason = @RejectionReason`;
    }

    updateSql += `
      WHERE RiskId = @RiskId AND ApprovalStatus = 'Pending'
    `;

    if (historyId) {
      updateRq.input('HistoryId', historyId);
      updateSql += ` AND RiskHistoryId = @HistoryId`;
    }

    await updateRq.query(updateSql);

    return withCORS(NextResponse.json({ ok: true, message: 'Edit rejected successfully' }));
  } catch (e: any) {
    return withCORS(NextResponse.json({ error: String(e?.message || e) }, { status: 500 }));
  }
}

