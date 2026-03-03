import { NextResponse } from 'next/server';
import { getPool } from '../../../../lib/db';

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

// Get all pending incident edit approvals grouped by incident (mirror risks pending-edits)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const departmentId = searchParams.get('departmentId');
    const userId = searchParams.get('userId');

    const pool = await getPool();
    let query = `
      SELECT DISTINCT
        i.IncidentId,
        r.RiskNo,
        i.Summary AS IncidentSummary,
        d.Name AS DepartmentName,
        d.DepartmentId,
        u.Name AS ChangedByName,
        h.ChangedByUserId,
        MIN(h.ChangedAtUtc) AS FirstPendingChange,
        COUNT(*) AS PendingChangesCount,
        STRING_AGG(h.FieldName, ', ') WITHIN GROUP (ORDER BY h.FieldName) AS ChangedFields
      FROM dbo.IncidentHistory h
      INNER JOIN dbo.incidents_t i ON i.IncidentId = h.IncidentId
      INNER JOIN dbo.Risks r ON r.RiskId = i.RiskId
      LEFT JOIN dbo.Departments d ON d.DepartmentId = i.DepartmentId
      LEFT JOIN dbo.Users u ON u.UserId = h.ChangedByUserId
      WHERE h.ApprovalStatus = 'Pending'
    `;

    const rq = pool.request();
    if (departmentId) {
      rq.input('DepartmentId', departmentId);
      query += ` AND i.DepartmentId = @DepartmentId`;
    }
    if (userId) {
      rq.input('UserId', userId);
      query += ` AND (
        i.DepartmentId IN (
          SELECT DepartmentId FROM dbo.UserDepartments WHERE UserId = @UserId
          UNION
          SELECT DepartmentId FROM dbo.Users WHERE UserId = @UserId AND DepartmentId IS NOT NULL
        )
      )`;
    }
    query += `
      GROUP BY i.IncidentId, r.RiskNo, i.Summary, d.Name, d.DepartmentId, u.Name, h.ChangedByUserId
      ORDER BY FirstPendingChange DESC
    `;

    const rs = await rq.query(query);

    const results = await Promise.all(
      rs.recordset.map(async (row: any) => {
        const detailRs = await pool.request()
          .input('IncidentId', row.IncidentId)
          .query(`
            SELECT IncidentHistoryId, FieldName, OldValue, NewValue, ChangedAtUtc, ChangedByUserId
            FROM dbo.IncidentHistory
            WHERE IncidentId = @IncidentId AND ApprovalStatus = 'Pending'
            ORDER BY ChangedAtUtc
          `);
        return { ...row, pendingChanges: detailRs.recordset };
      })
    );

    return withCORS(NextResponse.json(results));
  } catch (e: any) {
    return withCORS(NextResponse.json({ error: String(e?.message || e) }, { status: 500 }));
  }
}
