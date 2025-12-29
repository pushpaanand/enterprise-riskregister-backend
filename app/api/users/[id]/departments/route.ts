import { NextResponse } from 'next/server';
import { getPool } from '../../../../lib/db';
import sql from 'mssql';

export const runtime = 'nodejs';

function withCORS(res: NextResponse) {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  return res;
}

// GET: Get all departments assigned to a user
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userId = params.id;
    if (!userId) {
      return withCORS(NextResponse.json({ error: 'User ID is required' }, { status: 400 }));
    }

    const pool = await getPool();
    const rs = await pool.request()
      .input('UserId', sql.UniqueIdentifier, userId)
      .query(`
        SELECT 
          d.DepartmentId,
          d.Name AS Department
        FROM dbo.UserDepartments ud
        JOIN dbo.Departments d ON d.DepartmentId = ud.DepartmentId
        WHERE ud.UserId = @UserId
        ORDER BY d.Name
      `);

    return withCORS(NextResponse.json(rs.recordset));
  } catch (e: any) {
    return withCORS(NextResponse.json({ error: String(e?.message || e) }, { status: 500 }));
  }
}

// POST: Assign departments to a user (replaces existing assignments)
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userId = params.id;
    const body = await req.json();
    const departmentIds = Array.isArray(body.departmentIds) ? body.departmentIds : [];

    if (!userId) {
      return withCORS(NextResponse.json({ error: 'User ID is required' }, { status: 400 }));
    }

    const pool = await getPool();
    
    // Start transaction
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // Delete existing assignments
      await transaction.request()
        .input('UserId', sql.UniqueIdentifier, userId)
        .query('DELETE FROM dbo.UserDepartments WHERE UserId = @UserId');

      // Insert new assignments
      for (const deptId of departmentIds) {
        if (deptId) {
          await transaction.request()
            .input('UserId', sql.UniqueIdentifier, userId)
            .input('DepartmentId', sql.UniqueIdentifier, deptId)
            .query(`
              INSERT INTO dbo.UserDepartments (UserId, DepartmentId)
              VALUES (@UserId, @DepartmentId)
            `);
        }
      }

      await transaction.commit();

      // Return updated list
      const rs = await pool.request()
        .input('UserId', sql.UniqueIdentifier, userId)
        .query(`
          SELECT 
            d.DepartmentId,
            d.Name AS Department
          FROM dbo.UserDepartments ud
          JOIN dbo.Departments d ON d.DepartmentId = ud.DepartmentId
          WHERE ud.UserId = @UserId
          ORDER BY d.Name
        `);

      return withCORS(NextResponse.json(rs.recordset));
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (e: any) {
    return withCORS(NextResponse.json({ error: String(e?.message || e) }, { status: 500 }));
  }
}

export async function OPTIONS() {
  return withCORS(new NextResponse(null, { status: 204 }));
}

