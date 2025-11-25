import { NextResponse } from 'next/server';
import { getPool } from '../../../../lib/db';

export const runtime = 'nodejs';

function withCORS(res: NextResponse) {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  res.headers.set('Access-Control-Allow-Methods', 'PUT, DELETE, OPTIONS');
  return res;
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const userId = params.id;
    const body = await request.json();
    const name = body.name !== undefined ? String(body.name).trim() : undefined;
    const email = body.email !== undefined ? String(body.email).trim() : undefined;
    const role = body.role !== undefined ? String(body.role).trim().toLowerCase() : undefined;
    const departmentName = body.department !== undefined ? String(body.department).trim() : undefined;
    const unit = body.unit !== undefined ? String(body.unit).trim() : undefined;
    const isUnitHead = body.isUnitHead !== undefined ? Boolean(body.isUnitHead === true || body.isUnitHead === 'true' || body.isUnitHead === 1) : undefined;
    let employeeId = body.employeeId !== undefined ? String(body.employeeId).trim() : undefined;

    const pool = await getPool();

    // Fetch existing user
    const existing = await pool.request().input('UserId', userId).query(`
      SELECT UserId, Name, Email, Role, DepartmentId, Unit, IsUnitHead, EmployeeId FROM dbo.Users WHERE UserId = @UserId
    `);
    if (!existing.recordset.length) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    let nextRole = existing.recordset[0].Role as string;
    if (role) {
      if (!['user','manager','admin','unit_head'].includes(role)) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
      }
      nextRole = role;
    }

    let nextDepartmentId: string | null | undefined = existing.recordset[0].DepartmentId ?? null;
    if (nextRole === 'admin' || nextRole === 'unit_head') {
      nextDepartmentId = null; // admins and unit heads can have no department
    } else if (departmentName !== undefined) {
      if (departmentName === '') {
        return NextResponse.json({ error: 'Department is required for user/manager' }, { status: 400 });
      }
      const depSel = await pool.request().input('dn', departmentName).query(`SELECT DepartmentId FROM dbo.Departments WHERE Name = @dn`);
      if (depSel.recordset.length) {
        nextDepartmentId = depSel.recordset[0].DepartmentId;
      } else {
        const ins = await pool.request().input('dn', departmentName).query(`
          DECLARE @id UNIQUEIDENTIFIER = NEWID();
          INSERT INTO dbo.Departments(DepartmentId, Name) VALUES(@id, @dn);
          SELECT @id AS DepartmentId;
        `);
        nextDepartmentId = ins.recordset[0].DepartmentId;
      }
    }

    // Normalize and validate employeeId if provided
    if (employeeId !== undefined) {
      if (employeeId === null || employeeId === '') {
        // allow clearing? keep existing
        employeeId = existing.recordset[0].EmployeeId;
      } else {
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
        // uniqueness check exclude current user
        const dup = await pool.request().input('Emp', employeeId).input('UserId', userId).query(`SELECT TOP 1 UserId FROM dbo.Users WHERE EmployeeId = @Emp AND UserId <> @UserId`);
        if (dup.recordset.length) {
          return withCORS(NextResponse.json({ error: 'Employee ID already exists' }, { status: 409 }));
        }
      }
    } else {
      employeeId = existing.recordset[0].EmployeeId;
    }

    const rq = pool.request();
    rq.input('UserId', userId);
    rq.input('Name', name ?? existing.recordset[0].Name);
    rq.input('Email', email ?? existing.recordset[0].Email);
    rq.input('Role', nextRole);
    rq.input('DepartmentId', nextDepartmentId);
    rq.input('Unit', unit !== undefined ? unit : existing.recordset[0].Unit);
    rq.input('IsUnitHead', isUnitHead !== undefined ? (isUnitHead ? 1 : 0) : existing.recordset[0].IsUnitHead);
    rq.input('EmployeeId', employeeId);
    await rq.query(`
      UPDATE dbo.Users
      SET Name = @Name,
          Email = @Email,
          Role = @Role,
          DepartmentId = @DepartmentId,
          Unit = @Unit,
          IsUnitHead = @IsUnitHead,
          EmployeeId = @EmployeeId
      WHERE UserId = @UserId;
    `);

    const updated = await pool.request().input('UserId', userId).query(`
      SELECT u.UserId, u.Name, u.Email, u.Role, u.DepartmentId, d.Name AS Department,
             u.EmployeeId, u.Unit, u.IsUnitHead
      FROM dbo.Users u LEFT JOIN dbo.Departments d ON d.DepartmentId = u.DepartmentId
      WHERE u.UserId = @UserId;
    `);
    return withCORS(NextResponse.json({ user: updated.recordset[0] }));
  } catch (e: any) {
    return withCORS(NextResponse.json({ error: String(e?.message || e) }, { status: 500 }));
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userId = params.id;
    if (!userId) {
      return withCORS(NextResponse.json({ error: 'Missing user id' }, { status: 400 }));
    }

    const pool = await getPool();

    // Check if user exists
    const existing = await pool.request().input('UserId', userId).query(`
      SELECT UserId, Name, Role FROM dbo.Users WHERE UserId = @UserId
    `);
    if (!existing.recordset.length) {
      return withCORS(NextResponse.json({ error: 'User not found' }, { status: 404 }));
    }

    // Check for dependencies - risks created by this user
    const riskCount = await pool.request().input('UserId', userId).query(`
      SELECT COUNT(*) AS Count FROM dbo.Risks WHERE CreatedByUserId = @UserId
    `);
    const hasRisks = riskCount.recordset[0]?.Count > 0;

    if (hasRisks) {
      // Option 1: Prevent deletion if user has created risks
      return withCORS(NextResponse.json({ 
        error: 'Cannot delete user: User has created risks. Please reassign risks first or set CreatedByUserId to NULL.' 
      }, { status: 409 }));
      
      // Option 2: Set CreatedByUserId to NULL instead (uncomment if preferred)
      // await pool.request().input('UserId', userId).query(`
      //   UPDATE dbo.Risks SET CreatedByUserId = NULL WHERE CreatedByUserId = @UserId
      // `);
    }

    // Check for incidents created by this user
    const incidentCount = await pool.request().input('UserId', userId).query(`
      SELECT COUNT(*) AS Count FROM dbo.incidents_t WHERE CreatedByUserId = @UserId
    `);
    const hasIncidents = incidentCount.recordset[0]?.Count > 0;

    if (hasIncidents) {
      // Set CreatedByUserId to NULL for incidents (or prevent deletion)
      await pool.request().input('UserId', userId).query(`
        UPDATE dbo.incidents_t SET CreatedByUserId = NULL WHERE CreatedByUserId = @UserId
      `);
    }

    // Delete the user
    const rq = pool.request();
    rq.input('UserId', userId);
    await rq.query(`DELETE FROM dbo.Users WHERE UserId = @UserId`);

    return withCORS(NextResponse.json({ ok: true, message: 'User deleted successfully' }));
  } catch (e: any) {
    // Check for foreign key constraint violations
    const errorMessage = String(e?.message || e);
    if (errorMessage.includes('FOREIGN KEY') || errorMessage.includes('REFERENCES')) {
      return withCORS(NextResponse.json({ 
        error: 'Cannot delete user: User is referenced by other records. Please remove dependencies first.' 
      }, { status: 409 }));
    }
    return withCORS(NextResponse.json({ error: errorMessage }, { status: 500 }));
  }
}

export async function OPTIONS() {
  return withCORS(new NextResponse(null, { status: 204 }));
}

