import { NextResponse } from 'next/server';
import { getPool } from '../../../lib/db';
import { logAuditEvent, getRequestMetadata } from '../../../lib/audit';

export const runtime = 'nodejs';

function withCORS(res: NextResponse) {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  res.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  return res;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const requesterId = searchParams.get('requestedBy');
    const requesterName = searchParams.get('requestedByName');

    const pool = await getPool();
    // Get users with all their assigned departments (from UserDepartments and Risks tables)
    const rs = await pool.request().query(`
      SELECT 
        u.UserId, 
        u.Name, 
        u.Email, 
        u.Role, 
        u.DepartmentId, 
        d.Name AS Department,
        u.EmployeeId, 
        u.Unit, 
        u.IsUnitHead,
        -- Get all assigned departments as comma-separated list (from UserDepartments and Risks)
        STUFF((
          SELECT ', ' + allDepts.Name
          FROM (
            -- Departments from UserDepartments table
            SELECT DISTINCT d2.Name
            FROM dbo.UserDepartments ud
            JOIN dbo.Departments d2 ON d2.DepartmentId = ud.DepartmentId
            WHERE ud.UserId = u.UserId
            
            UNION
            
            -- Departments from Risks table (risks created by this user)
            SELECT DISTINCT d3.Name
            FROM dbo.Risks r
            LEFT JOIN dbo.Departments d3 ON d3.DepartmentId = r.DepartmentId
            WHERE r.CreatedByUserId = u.UserId
              AND r.DepartmentId IS NOT NULL
              AND d3.Name IS NOT NULL
          ) AS allDepts
          ORDER BY allDepts.Name
          FOR XML PATH(''), TYPE
        ).value('.', 'NVARCHAR(MAX)'), 1, 2, '') AS AssignedDepartments,
        -- Get all assigned department IDs as comma-separated list
        STUFF((
          SELECT ',' + CAST(allDeptIds.DepartmentId AS NVARCHAR(36))
          FROM (
            SELECT DISTINCT DepartmentId
            FROM dbo.UserDepartments
            WHERE UserId = u.UserId
            
            UNION
            
            SELECT DISTINCT DepartmentId
            FROM dbo.Risks
            WHERE CreatedByUserId = u.UserId
              AND DepartmentId IS NOT NULL
          ) AS allDeptIds
          FOR XML PATH('')
        ), 1, 1, '') AS AssignedDepartmentIds
      FROM dbo.Users u
      LEFT JOIN dbo.Departments d ON d.DepartmentId = u.DepartmentId
      ORDER BY u.Name
    `);
    
    // Decode HTML entities in AssignedDepartments (fix &amp; -> &)
    const decoded = rs.recordset.map((row: any) => {
      if (row.AssignedDepartments) {
        row.AssignedDepartments = row.AssignedDepartments
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'");
      }
      return row;
    });
    
    const response = withCORS(NextResponse.json(decoded));

    // Audit: log read access (non-blocking)
    try {
      const { ipAddress, userAgent } = getRequestMetadata(req);
      await logAuditEvent({
        tableName: 'Users',
        recordId: 'LIST',
        operation: 'READ',
        changedByUserId: requesterId || null,
        changedByUserName: requesterName || null,
        ipAddress,
        userAgent,
        additionalInfo: `count=${decoded.length}`
      });
    } catch {
      // ignore audit failures
    }

    return response;
  } catch (e: any) {
    return withCORS(NextResponse.json({ error: String(e?.message || e) }, { status: 500 }));
  }
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
    const newUser = created.recordset[0];
    
    // Log audit event for INSERT
    const { ipAddress, userAgent } = getRequestMetadata(req);
    await logAuditEvent({
      tableName: 'Users',
      recordId: newUser.UserId,
      operation: 'INSERT',
      newValue: JSON.stringify({
        name: newUser.Name,
        email: newUser.Email,
        role: newUser.Role,
        department: newUser.Department
      }),
      changedByUserId: null, // Could be passed from frontend if needed
      changedByUserName: null,
      ipAddress,
      userAgent
    });
    
    return withCORS(NextResponse.json({ user: newUser }, { status: 201 }));
  } catch (e: any) {
    return withCORS(NextResponse.json({ error: String(e?.message || e) }, { status: 500 }));
  }
}

export async function OPTIONS() {
  return withCORS(new NextResponse(null, { status: 204 }));
}

