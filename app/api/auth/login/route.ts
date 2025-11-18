import { NextResponse } from 'next/server';
import { getPool } from '../../../../lib/db';

export const runtime = 'nodejs';

type Role = 'user' | 'manager' | 'admin';

function isValidRole(role: string): role is Role {
  return role === 'user' || role === 'manager' || role === 'admin';
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = String(body.name ?? '').trim();
    const role = String(body.role ?? '').trim();
    let departmentName = (body.department ?? body.departmentName ?? '').toString().trim();

    if (!name || !isValidRole(role)) {
      return NextResponse.json({ error: 'Invalid name or role' }, { status: 400 });
    }

    // Admins need no department
    if (role === 'admin') {
      departmentName = '';
    }

    const pool = await getPool();
    const rq = pool.request();

    // Resolve or create department. If not provided for user/manager, pick a sensible default.
    let departmentId: string | null = null;
    if (role !== 'admin') {
      if (departmentName) {
        const depSel = await rq.input('DepName', departmentName).query(`
          SELECT DepartmentId FROM dbo.Departments WHERE Name = @DepName
        `);
        if (depSel.recordset.length > 0) {
          departmentId = depSel.recordset[0].DepartmentId as string;
        } else {
          const depIns = await pool.request().input('DepName', departmentName).query(`
            DECLARE @newId UNIQUEIDENTIFIER = NEWID();
            INSERT INTO dbo.Departments (DepartmentId, Name) VALUES (@newId, @DepName);
            SELECT @newId AS DepartmentId;
          `);
          departmentId = depIns.recordset[0].DepartmentId as string;
        }
      } else {
        // No department passed: prefer 'Engineering' if present, else top 1, else create 'Engineering'
        const depEng = await pool.request().query(`
          SELECT TOP 1 DepartmentId FROM dbo.Departments WHERE Name = N'Engineering'
        `);
        if (depEng.recordset.length > 0) {
          departmentId = depEng.recordset[0].DepartmentId as string;
        } else {
          const depAny = await pool.request().query(`
            SELECT TOP 1 DepartmentId FROM dbo.Departments ORDER BY Name ASC
          `);
          if (depAny.recordset.length > 0) {
            departmentId = depAny.recordset[0].DepartmentId as string;
          } else {
            const depCreate = await pool.request().input('DepName', 'Engineering').query(`
              DECLARE @newId UNIQUEIDENTIFIER = NEWID();
              INSERT INTO dbo.Departments (DepartmentId, Name) VALUES (@newId, @DepName);
              SELECT @newId AS DepartmentId;
            `);
            departmentId = depCreate.recordset[0].DepartmentId as string;
          }
        }
      }
    }

    // Try find existing user
    const findRq = pool.request()
      .input('Name', name)
      .input('Role', role)
      .input('DepartmentId', departmentId);

    const existing = await findRq.query(`
      SELECT TOP 1 u.UserId, u.Name, u.Role, u.DepartmentId, d.Name AS Department
      FROM dbo.Users u
      LEFT JOIN dbo.Departments d ON d.DepartmentId = u.DepartmentId
      WHERE u.Name = @Name AND u.Role = @Role
        AND ((@DepartmentId IS NULL AND u.DepartmentId IS NULL) OR (u.DepartmentId = @DepartmentId))
    `);

    if (existing.recordset.length > 0) {
      const res = NextResponse.json({ user: existing.recordset[0] }, { status: 200 });
      res.headers.set('Access-Control-Allow-Origin', '*');
      res.headers.set('Access-Control-Allow-Headers', 'Content-Type');
      res.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
      return res;
    }

    // Create new user
    const insRq = pool.request()
      .input('Name', name)
      .input('Role', role)
      .input('DepartmentId', departmentId);

    const inserted = await insRq.query(`
      DECLARE @newId UNIQUEIDENTIFIER = NEWID();
      INSERT INTO dbo.Users (UserId, Name, Role, DepartmentId)
      VALUES (@newId, @Name, @Role, @DepartmentId);
      SELECT u.UserId, u.Name, u.Role, u.DepartmentId, d.Name AS Department
      FROM dbo.Users u LEFT JOIN dbo.Departments d ON d.DepartmentId = u.DepartmentId
      WHERE u.UserId = @newId;
    `);

    {
      const res = NextResponse.json({ user: inserted.recordset[0] }, { status: 201 });
      res.headers.set('Access-Control-Allow-Origin', '*');
      res.headers.set('Access-Control-Allow-Headers', 'Content-Type');
      res.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
      return res;
    }
  } catch (err: any) {
    const res = NextResponse.json({ error: 'Login failed', detail: String(err?.message ?? err) }, { status: 500 });
    res.headers.set('Access-Control-Allow-Origin', '*');
    res.headers.set('Access-Control-Allow-Headers', 'Content-Type');
    res.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    return res;
  }
}

export async function OPTIONS() {
  const res = new NextResponse(null, { status: 204 });
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  res.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  return res;
}

