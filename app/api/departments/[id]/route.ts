import { NextResponse } from 'next/server';
import { getPool } from '../../../../lib/db';

export const runtime = 'nodejs';

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const departmentId = params.id;
    const body = await request.json();
    const name = String(body.name || '').trim();
    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

    const pool = await getPool();
    await pool.request().input('DepartmentId', departmentId).input('Name', name).query(`
      UPDATE dbo.Departments SET Name = @Name WHERE DepartmentId = @DepartmentId;
    `);
    const rs = await pool.request().input('DepartmentId', departmentId).query(`
      SELECT DepartmentId, Name FROM dbo.Departments WHERE DepartmentId = @DepartmentId;
    `);
    if (!rs.recordset.length) return NextResponse.json({ error: 'Department not found' }, { status: 404 });
    const res = NextResponse.json({ department: rs.recordset[0] });
    res.headers.set('Access-Control-Allow-Origin', '*');
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}

export async function OPTIONS() {
  const res = new NextResponse(null, { status: 204 });
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  res.headers.set('Access-Control-Allow-Methods', 'PUT, OPTIONS');
  return res;
}

