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

// Get all pending incident edit approvals grouped by incident.
// - changedByUserId: show only pending edits by this user (for the user who made the edits).
// - userId + optional departmentName: show pending edits in manager's department(s). Fallback: resolve departmentName to DepartmentId.
// - departmentId: filter by single department.
// - No filter: admin sees all.
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const departmentId = searchParams.get('departmentId');
    const userId = searchParams.get('userId');
    const departmentName = searchParams.get('departmentName');
    const changedByUserId = searchParams.get('changedByUserId');

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

    if (changedByUserId) {
      rq.input('ChangedByUserId', changedByUserId);
      query += ` AND h.ChangedByUserId = @ChangedByUserId`;
    } else if (departmentId) {
      rq.input('DepartmentId', departmentId);
      query += ` AND i.DepartmentId = @DepartmentId`;
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
