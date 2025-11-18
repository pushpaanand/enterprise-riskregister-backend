import { NextResponse } from 'next/server';
import { getPool } from '../../../../../lib/db';

export const runtime = 'nodejs';

function withCORS(res: NextResponse) {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  res.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  return res;
}

export async function OPTIONS() {
  return withCORS(new NextResponse(null, { status: 204 }));
}

export async function GET(
  _req: any,
  { params }: { params: { id: string } }
) {
  try {
    const riskId = params.id;
    if (!riskId) {
      return withCORS(NextResponse.json({ error: 'Missing risk id' }, { status: 400 }));
    }
    const pool = await getPool();
    const rs = await pool.request().input('RiskId', riskId).query(`
      SELECT h.RiskHistoryId, h.RiskId, h.ChangedAtUtc,
             h.ChangedByUserId, u.Name AS ChangedByName,
             h.FieldName, h.OldValue, h.NewValue, h.RejectionReason
      FROM dbo.riskhistory h
      LEFT JOIN dbo.Users u ON u.UserId = h.ChangedByUserId
      WHERE h.RiskId = @RiskId
      ORDER BY h.ChangedAtUtc DESC, h.RiskHistoryId DESC
    `);
    return withCORS(NextResponse.json(rs.recordset));
  } catch (e: any) {
    return withCORS(NextResponse.json({ error: String(e?.message || e) }, { status: 500 }));
  }
}