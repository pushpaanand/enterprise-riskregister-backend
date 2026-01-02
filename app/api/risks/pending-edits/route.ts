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

// Get all pending edit approvals grouped by risk
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const departmentId = searchParams.get('departmentId');
    const userId = searchParams.get('userId'); // Manager's user ID to filter by their departments

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

    // Filter by department if provided
    if (departmentId) {
      rq.input('DepartmentId', departmentId);
      query += ` AND r.DepartmentId = @DepartmentId`;
    }

    // Filter by manager's assigned departments if userId provided
    if (userId) {
      rq.input('UserId', userId);
      query += ` AND (
        r.DepartmentId IN (
          SELECT DepartmentId FROM dbo.UserDepartments WHERE UserId = @UserId
          UNION
          SELECT DepartmentId FROM dbo.Users WHERE UserId = @UserId AND DepartmentId IS NOT NULL
        )
      )`;
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

