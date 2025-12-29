import { NextResponse } from 'next/server';
import { getPool } from '../../../../lib/db';

export const runtime = 'nodejs';

type Role = 'user' | 'manager' | 'admin';

function isValidRole(role: string): role is Role {
  return role === 'user' || role === 'manager' || role === 'admin';
}

/**
 * Azure Static Web Apps Login Endpoint
 * 
 * This endpoint handles authentication after a user signs in via Azure Static Web Apps.
 * It matches the Azure AD username (e.g., 127547@kauveryhospital.com) against the 
 * EmployeeId column in the Users table and returns the user with their role from the database.
 * 
 * IMPORTANT: Users must exist in the database with EmployeeId matching their Azure AD username.
 * The role is fetched from the database, not from Azure AD roles.
 * 
 * Expected payload:
 * {
 *   azureId: string,           // User's Azure AD ID
 *   email: string,              // User's email from Azure AD (e.g., 127547@kauveryhospital.com)
 *   name: string,               // User's display name from Azure AD
 *   identityProvider: string,   // "aad" for Azure AD
 *   roles: string[]             // Array of Azure AD roles (not used, role comes from database)
 * }
 * 
 * Returns: User object in same format as /api/auth/login endpoint
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const azureId = String(body.azureId || '').trim();
    const email = String(body.email || '').trim();
    const name = String(body.name || '').trim();
    const identityProvider = String(body.identityProvider || 'aad').trim();
    const azureRoles = Array.isArray(body.roles) ? body.roles : [];

    if (!azureId) {
      return NextResponse.json(
        { error: 'Azure ID is required' },
        { status: 400 }
      );
    }

    const pool = await getPool();

    // Extract the username from Azure AD (should be in format: 127547@kauveryhospital.com)
    // This matches the EmployeeId column format exactly
    // userDetails from Azure AD typically contains the email/username
    const azureUsername = email || name || '';
    
    if (!azureUsername) {
      return NextResponse.json(
        { error: 'Azure username/email is required' },
        { status: 400 }
      );
    }

    // Normalize to lowercase for matching (EmployeeId is stored in lowercase)
    const normalizedUsername = azureUsername.toLowerCase().trim();

    console.log('[Azure Login] Attempting to match user:', {
      receivedEmail: email,
      receivedName: name,
      azureUsername,
      normalizedUsername,
    });

    // Find user by EmployeeId (which stores the exact Azure AD username)
    // Try exact match first
    let existingByEmployeeId = await pool.request()
      .input('EmployeeId', normalizedUsername)
      .query(`
        SELECT TOP 1 u.UserId, u.Name, u.Role, u.DepartmentId, u.Email, u.EmployeeId, d.Name AS Department
        FROM dbo.Users u
        LEFT JOIN dbo.Departments d ON d.DepartmentId = u.DepartmentId
        WHERE LOWER(u.EmployeeId) = @EmployeeId
      `);

    let user = existingByEmployeeId.recordset[0];

    // If not found, try extracting just the employee number part (before @)
    // In case EmployeeId is stored as just "127547" instead of "127547@kauveryhospital.com"
    if (!user && normalizedUsername.includes('@')) {
      const employeeNumber = normalizedUsername.split('@')[0];
      const withSuffix = employeeNumber + '@kauveryhospital.com';
      console.log('[Azure Login] Trying employee number match:', employeeNumber, 'or', withSuffix);
      
      // Try matching just the employee number
      existingByEmployeeId = await pool.request()
        .input('EmployeeId', employeeNumber)
        .query(`
          SELECT TOP 1 u.UserId, u.Name, u.Role, u.DepartmentId, u.Email, u.EmployeeId, d.Name AS Department
          FROM dbo.Users u
          LEFT JOIN dbo.Departments d ON d.DepartmentId = u.DepartmentId
          WHERE LOWER(u.EmployeeId) = @EmployeeId
        `);
      
      user = existingByEmployeeId.recordset[0];
      
      // If still not found, try with @kauveryhospital.com suffix
      if (!user) {
        existingByEmployeeId = await pool.request()
          .input('EmployeeId', withSuffix)
          .query(`
            SELECT TOP 1 u.UserId, u.Name, u.Role, u.DepartmentId, u.Email, u.EmployeeId, d.Name AS Department
            FROM dbo.Users u
            LEFT JOIN dbo.Departments d ON d.DepartmentId = u.DepartmentId
            WHERE LOWER(u.EmployeeId) = @EmployeeId
          `);
        
        user = existingByEmployeeId.recordset[0];
      }
    }

    // If still not found, try matching with @kauveryhospital.com suffix
    if (!user && !normalizedUsername.includes('@kauveryhospital.com')) {
      const withSuffix = normalizedUsername + '@kauveryhospital.com';
      console.log('[Azure Login] Trying with @kauveryhospital.com suffix:', withSuffix);
      
      existingByEmployeeId = await pool.request()
        .input('EmployeeId', withSuffix)
        .query(`
          SELECT TOP 1 u.UserId, u.Name, u.Role, u.DepartmentId, u.Email, u.EmployeeId, d.Name AS Department
          FROM dbo.Users u
          LEFT JOIN dbo.Departments d ON d.DepartmentId = u.DepartmentId
          WHERE LOWER(u.EmployeeId) = @EmployeeId
        `);
      
      user = existingByEmployeeId.recordset[0];
    }

    // If user not found, return error with helpful message
    if (!user) {
      console.error('[Azure Login] User not found for:', normalizedUsername);
      return NextResponse.json(
        { 
          error: 'User not found. Please contact administrator to add your account.',
          detail: `No user found with EmployeeId matching: ${normalizedUsername}. Please ensure your EmployeeId in the database matches your Azure AD username.`
        },
        { status: 404 }
      );
    }

    console.log('[Azure Login] User found:', {
      UserId: user.UserId,
      Name: user.Name,
      Role: user.Role,
      EmployeeId: user.EmployeeId,
    });

    // Update email if it's missing (keep existing EmployeeId and Role from database)
    if (!user.Email && email) {
      await pool.request()
        .input('UserId', user.UserId)
        .input('Email', email)
        .query(`
          UPDATE dbo.Users SET Email = @Email WHERE UserId = @UserId
        `);
      user.Email = email;
    }

    // Return user with role from database (same format as regular login)
    const res = NextResponse.json({ user }, { status: 200 });
    res.headers.set('Access-Control-Allow-Origin', '*');
    res.headers.set('Access-Control-Allow-Headers', 'Content-Type');
    res.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    return res;
  } catch (err: any) {
    const res = NextResponse.json(
      { error: 'Azure login failed', detail: String(err?.message ?? err) },
      { status: 500 }
    );
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

