import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import sql from 'mssql';

export const runtime = 'nodejs';

function withCORS(res: NextResponse) {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  return res;
}

// GET: Get all departments assigned to a user (from UserDepartments and Risks tables)
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
    
    // Get departments from UserDepartments table
    const udRs = await pool.request()
      .input('UserId', sql.UniqueIdentifier, userId)
      .query(`
        SELECT 
          d.DepartmentId,
          d.Name AS Department
        FROM dbo.UserDepartments ud
        JOIN dbo.Departments d ON d.DepartmentId = ud.DepartmentId
        WHERE ud.UserId = @UserId
      `);

    // Get departments from Risks table (risks created by this user)
    const risksRs = await pool.request()
      .input('UserId', sql.UniqueIdentifier, userId)
      .query(`
        SELECT DISTINCT
          r.DepartmentId,
          d.Name AS Department
        FROM dbo.Risks r
        LEFT JOIN dbo.Departments d ON d.DepartmentId = r.DepartmentId
        WHERE r.CreatedByUserId = @UserId
          AND r.DepartmentId IS NOT NULL
          AND d.Name IS NOT NULL
      `);

    // Combine and deduplicate by Department name
    const deptMap = new Map<string, any>();
    
    udRs.recordset.forEach((row: any) => {
      if (row.Department) {
        deptMap.set(row.Department, { DepartmentId: row.DepartmentId, Department: row.Department });
      }
    });
    
    risksRs.recordset.forEach((row: any) => {
      if (row.Department && !deptMap.has(row.Department)) {
        deptMap.set(row.Department, { DepartmentId: row.DepartmentId, Department: row.Department });
      }
    });

    const result = Array.from(deptMap.values()).sort((a, b) => 
      (a.Department || '').localeCompare(b.Department || '')
    );

    return withCORS(NextResponse.json(result));
  } catch (e: any) {
    return withCORS(NextResponse.json({ error: String(e?.message || e) }, { status: 500 }));
  }
}

// POST: Assign departments to a user (replaces existing assignments)
// Accepts department names (array of strings) or departmentIds (array of GUIDs)
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userId = params.id;
    const body = await req.json();
    // Support both departmentNames (array of strings) and departmentIds (array of GUIDs)
    const departmentNames = Array.isArray(body.departmentNames) ? body.departmentNames : [];
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

      // Resolve department names to IDs if names are provided
      const finalDepartmentIds: string[] = [];
      
      if (departmentNames.length > 0) {
        for (const deptName of departmentNames) {
          if (deptName && typeof deptName === 'string') {
            const deptRs = await transaction.request()
              .input('DeptName', sql.NVarChar, deptName.trim())
              .query(`SELECT DepartmentId FROM dbo.Departments WHERE Name = @DeptName`);
            
            if (deptRs.recordset.length > 0) {
              finalDepartmentIds.push(deptRs.recordset[0].DepartmentId);
            } else {
              // Create department if it doesn't exist
              const newDeptRs = await transaction.request()
                .input('DeptName', sql.NVarChar, deptName.trim())
                .query(`
                  DECLARE @id UNIQUEIDENTIFIER = NEWID();
                  INSERT INTO dbo.Departments(DepartmentId, Name) VALUES(@id, @DeptName);
                  SELECT @id AS DepartmentId;
                `);
              finalDepartmentIds.push(newDeptRs.recordset[0].DepartmentId);
            }
          }
        }
      } else if (departmentIds.length > 0) {
        // Use provided IDs directly
        finalDepartmentIds.push(...departmentIds.filter((id: any) => id));
      }

      // Insert new assignments
      for (const deptId of finalDepartmentIds) {
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

      // Return updated list (using GET logic to include Risks departments)
      const udRs = await pool.request()
        .input('UserId', sql.UniqueIdentifier, userId)
        .query(`
          SELECT 
            d.DepartmentId,
            d.Name AS Department
          FROM dbo.UserDepartments ud
          JOIN dbo.Departments d ON d.DepartmentId = ud.DepartmentId
          WHERE ud.UserId = @UserId
        `);

      const risksRs = await pool.request()
        .input('UserId', sql.UniqueIdentifier, userId)
        .query(`
          SELECT DISTINCT
            r.DepartmentId,
            d.Name AS Department
          FROM dbo.Risks r
          LEFT JOIN dbo.Departments d ON d.DepartmentId = r.DepartmentId
          WHERE r.CreatedByUserId = @UserId
            AND r.DepartmentId IS NOT NULL
            AND d.Name IS NOT NULL
        `);

      const deptMap = new Map<string, any>();
      udRs.recordset.forEach((row: any) => {
        if (row.Department) {
          deptMap.set(row.Department, { DepartmentId: row.DepartmentId, Department: row.Department });
        }
      });
      risksRs.recordset.forEach((row: any) => {
        if (row.Department && !deptMap.has(row.Department)) {
          deptMap.set(row.Department, { DepartmentId: row.DepartmentId, Department: row.Department });
        }
      });

      const result = Array.from(deptMap.values()).sort((a, b) => 
        (a.Department || '').localeCompare(b.Department || '')
      );

      return withCORS(NextResponse.json(result));
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

