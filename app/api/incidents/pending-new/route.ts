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

// Get new incidents awaiting approval (ApprovalStatus = 'Pending')
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    const pool = await getPool();
    let query = `
      SELECT i.IncidentId, i.RiskId, r.RiskNo,
             i.Summary, i.OccurredAtUtc, i.Description, i.CreatedByUserId, i.CreatedAtUtc,
             d.Name AS DepartmentName, u.Name AS CreatedByName
      FROM dbo.incidents_t i
      JOIN dbo.Risks r ON r.RiskId = i.RiskId
      LEFT JOIN dbo.Departments d ON d.DepartmentId = i.DepartmentId
      LEFT JOIN dbo.Users u ON u.UserId = i.CreatedByUserId
      WHERE i.ApprovalStatus = 'Pending'
    `;
    const rq = pool.request();
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
    query += ` ORDER BY i.CreatedAtUtc DESC`;

    const rs = await rq.query(query);
    return withCORS(NextResponse.json(rs.recordset));
  } catch (e: any) {
    return withCORS(NextResponse.json({ error: String(e?.message || e) }, { status: 500 }));
  }
}
