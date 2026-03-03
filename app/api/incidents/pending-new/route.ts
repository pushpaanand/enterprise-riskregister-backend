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
    const departmentName = searchParams.get('departmentName');
    const createdByUserId = searchParams.get('createdByUserId');

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
    if (createdByUserId) {
      rq.input('CreatedByUserId', createdByUserId);
      query += ` AND i.CreatedByUserId = @CreatedByUserId`;
    } else if (userId) {
      const deptRs = await pool.request().input('UserId', userId).query(`
        SELECT DepartmentId FROM dbo.UserDepartments WHERE UserId = @UserId
        UNION
        SELECT DepartmentId FROM dbo.Users WHERE UserId = @UserId AND DepartmentId IS NOT NULL
      `);
      let deptIds: string[] = (deptRs.recordset || []).map((row: any) => row.DepartmentId);
      if (deptIds.length === 0 && departmentName) {
        const nameRs = await pool.request().input('DepName', departmentName).query(`SELECT DepartmentId FROM dbo.Departments WHERE Name = @DepName`);
        if (nameRs.recordset?.length) deptIds = nameRs.recordset.map((row: any) => row.DepartmentId);
      }
      if (deptIds.length > 0) {
        if (deptIds.length === 1) {
          rq.input('DepartmentId', deptIds[0]);
          query += ` AND i.DepartmentId = @DepartmentId`;
        } else {
          deptIds.forEach((id, idx) => rq.input(`DeptId${idx}`, id));
          query += ` AND i.DepartmentId IN (${deptIds.map((_, idx) => `@DeptId${idx}`).join(', ')})`;
        }
      } else {
        query += ` AND 1 = 0`;
      }
    }
    query += ` ORDER BY i.CreatedAtUtc DESC`;

    const rs = await rq.query(query);
    return withCORS(NextResponse.json(rs.recordset));
  } catch (e: any) {
    return withCORS(NextResponse.json({ error: String(e?.message || e) }, { status: 500 }));
  }
}
