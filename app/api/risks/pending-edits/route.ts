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

// Get all pending edit approvals grouped by risk.
// - changedByUserId: show only pending edits by this user (for the user who made the edits).
// - userId + optional departmentName: show pending edits for manager's department(s). If UserDepartments/Users.DepartmentId is empty, departmentName is resolved to DepartmentId.
// - departmentId: filter by single department.
// - No filter: admin sees all.
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const departmentId = searchParams.get('departmentId');
    const userId = searchParams.get('userId'); // Manager's user ID to filter by their departments
    const departmentName = searchParams.get('departmentName'); // Fallback when manager has no DepartmentId in DB
    const changedByUserId = searchParams.get('changedByUserId'); // User's own ID to see only their pending edits

    const pool = await getPool();
    let query = `
      SELECT DISTINCT
        r.RiskId,
        r.RiskNo,
        r.Description AS RiskDescription,
        d.Name AS DepartmentName,
        d.DepartmentId,
        u.Name AS ChangedByName,
        h.ChangedByUserId,
        MIN(h.ChangedAtUtc) AS FirstPendingChange,
        COUNT(*) AS PendingChangesCount,
        STRING_AGG(h.FieldName, ', ') WITHIN GROUP (ORDER BY h.FieldName) AS ChangedFields
      FROM dbo.RiskHistory h
      INNER JOIN dbo.Risks r ON r.RiskId = h.RiskId
      LEFT JOIN dbo.Departments d ON d.DepartmentId = r.DepartmentId
      LEFT JOIN dbo.Users u ON u.UserId = h.ChangedByUserId
      WHERE h.ApprovalStatus = 'Pending'
    `;

    const rq = pool.request();

    // User viewing their own pending edits
    if (changedByUserId) {
      rq.input('ChangedByUserId', changedByUserId);
      query += ` AND h.ChangedByUserId = @ChangedByUserId`;
    } else if (departmentId) {
      // Filter by single department
      rq.input('DepartmentId', departmentId);
      query += ` AND r.DepartmentId = @DepartmentId`;
    } else if (userId) {
      // Manager: resolve department IDs (UserDepartments + Users.DepartmentId; fallback to departmentName)
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
          query += ` AND r.DepartmentId = @DepartmentId`;
        } else {
          deptIds.forEach((id, idx) => rq.input(`DeptId${idx}`, id));
          query += ` AND r.DepartmentId IN (${deptIds.map((_, idx) => `@DeptId${idx}`).join(', ')})`;
        }
      } else {
        query += ` AND 1 = 0`;
      }
    }

    query += `
      GROUP BY r.RiskId, r.RiskNo, r.Description, d.Name, d.DepartmentId, u.Name, h.ChangedByUserId
      ORDER BY FirstPendingChange DESC
    `;

    const rs = await rq.query(query);

    // Get detailed changes for each risk
    const results = await Promise.all(
      rs.recordset.map(async (risk: any) => {
        const detailRs = await pool.request()
          .input('RiskId', risk.RiskId)
          .query(`
            SELECT 
              RiskHistoryId,
              FieldName,
              OldValue,
              NewValue,
              ChangedAtUtc,
              ChangedByUserId
            FROM dbo.RiskHistory
            WHERE RiskId = @RiskId AND ApprovalStatus = 'Pending'
            ORDER BY ChangedAtUtc
          `);

        return {
          ...risk,
          pendingChanges: detailRs.recordset,
        };
      })
    );

    return withCORS(NextResponse.json(results));
  } catch (e: any) {
    return withCORS(NextResponse.json({ error: String(e?.message || e) }, { status: 500 }));
  }
}

