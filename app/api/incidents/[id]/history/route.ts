import { NextResponse } from 'next/server';
import { getPool } from '../../../../../lib/db';

export const runtime = 'nodejs';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const pool = await getPool();
  const rs = await pool.request()
    .input('IncidentId', params.id)
    .query(`
      SELECT IncidentHistoryId, IncidentId, ChangedAtUtc, ChangedByUserId, FieldName, OldValue, NewValue
      FROM dbo.IncidentHistory
      WHERE IncidentId = @IncidentId
      ORDER BY ChangedAtUtc DESC
    `);
  return NextResponse.json(rs.recordset);
}

