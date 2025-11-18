import { NextResponse } from 'next/server';
import { getPool } from '../../../lib/db';

export const runtime = 'nodejs';

function withCORS(res: NextResponse) {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  res.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  return res;
}

export async function GET() {
  const pool = await getPool();
  const rs = await pool.request().query(`
    SELECT u.UserId, u.Name, u.Email, u.Role, u.DepartmentId, d.Name AS Department,
           u.EmployeeId, u.Unit, u.IsUnitHead
    FROM dbo.Users u
    LEFT JOIN dbo.Departments d ON d.DepartmentId = u.DepartmentId
    ORDER BY u.Name
  `);
  return withCORS(NextResponse.json(rs.recordset));
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = String(body.name || '').trim();
    const email = body.email ? String(body.email).trim() : null;
    const role = String(body.role || '').trim().toLowerCase();
    const departmentName = String(body.department || '').trim();
    let employeeId: string | null = body.employeeId ? String(body.employeeId).trim() : null;
    const unit = body.unit ? String(body.unit).trim() : null;
    const isUnitHead = Boolean(body.isUnitHead === true || body.isUnitHead === 'true' || body.isUnitHead === 1);
    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    if (!['user','manager','admin','unit_head'].includes(role)) return NextResponse.json({ error: 'Invalid role' }, { status: 400 });

    if (employeeId) {
      const six = /^[0-9]{6}$/;
      const full = /^[0-9]{6}@kauveryhospital\.com$/i;
      if (six.test(employeeId)) {
        employeeId = `${employeeId}@kauveryhospital.com`;
      } else if (full.test(employeeId)) {
        const digits = employeeId.substring(0, 6);
        employeeId = `${digits}@kauveryhospital.com`;
      } else {
        return withCORS(NextResponse.json({ error: 'Employee ID must be 6 digits or 6digits@kauveryhospital.com' }, { status: 400 }));
      }
    }

    const pool = await getPool();
    let departmentId: string | null = null;
    // Department is required for user/manager, optional (null) for admin and unit_head
    if (role !== 'admin' && role !== 'unit_head') {
      const depName = departmentName || 'Engineering';
      const depSel = await pool.request().input('dn', depName).query(`SELECT DepartmentId FROM dbo.Departments WHERE Name = @dn`);
      if (depSel.recordset.length) {
        departmentId = depSel.recordset[0].DepartmentId;
      } else {
        const ins = await pool.request().input('dn', depName).query(`
          DECLARE @id UNIQUEIDENTIFIER = NEWID();
          INSERT INTO dbo.Departments(DepartmentId, Name) VALUES(@id, @dn);
          SELECT @id AS DepartmentId;
        `);
        departmentId = ins.recordset[0].DepartmentId;
      }
    }

    // Uniqueness check for EmployeeId
    if (employeeId) {
      const dup = await pool.request().input('Emp', employeeId).query(`SELECT TOP 1 UserId FROM dbo.Users WHERE EmployeeId = @Emp`);
      if (dup.recordset.length) {
        return withCORS(NextResponse.json({ error: 'Employee ID already exists' }, { status: 409 }));
      }
    }

    const rq = pool.request();
    rq.input('Name', name);
    rq.input('Email', email);
    rq.input('Role', ['admin','manager','unit_head'].includes(role) ? role : 'user');
    rq.input('DepartmentId', departmentId);
    rq.input('EmployeeId', employeeId);
    rq.input('Unit', unit);
    rq.input('IsUnitHead', isUnitHead ? 1 : 0);
    const created = await rq.query(`
      DECLARE @id UNIQUEIDENTIFIER = NEWID();
      INSERT INTO dbo.Users(UserId, Name, Email, Role, DepartmentId, EmployeeId, Unit, IsUnitHead)
      VALUES(@id, @Name, @Email, @Role, @DepartmentId, @EmployeeId, @Unit, @IsUnitHead);
      SELECT u.UserId, u.Name, u.Email, u.Role, u.DepartmentId, d.Name AS Department,
             u.EmployeeId, u.Unit, u.IsUnitHead
      FROM dbo.Users u LEFT JOIN dbo.Departments d ON d.DepartmentId = u.DepartmentId
      WHERE u.UserId = @id;
    `);
    return withCORS(NextResponse.json({ user: created.recordset[0] }, { status: 201 }));
  } catch (e: any) {
    return withCORS(NextResponse.json({ error: String(e?.message || e) }, { status: 500 }));
  }
}

export async function OPTIONS() {
  return withCORS(new NextResponse(null, { status: 204 }));
}

