import { NextResponse } from 'next/server';
import { getPool } from '../../../lib/db';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const pool = await getPool();
    const rs = await pool.request().query(`
      SELECT DepartmentId, Name
      FROM dbo.Departments
      ORDER BY Name
    `);
    const res = NextResponse.json(rs.recordset);
    res.headers.set('Access-Control-Allow-Origin', '*');
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = String(body.name || '').trim();
    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

    const pool = await getPool();
    const exists = await pool.request().input('n', name).query(`SELECT DepartmentId FROM dbo.Departments WHERE Name = @n`);
    if (exists.recordset.length) {
      const res = NextResponse.json({ department: exists.recordset[0], existed: true }, { status: 200 });
      res.headers.set('Access-Control-Allow-Origin', '*');
      return res;
    }

    const insert = await pool.request().input('n', name).query(`
      DECLARE @id UNIQUEIDENTIFIER = NEWID();
      INSERT INTO dbo.Departments(DepartmentId, Name) VALUES(@id, @n);
      SELECT DepartmentId, Name FROM dbo.Departments WHERE DepartmentId = @id;
    `);
    const res = NextResponse.json({ department: insert.recordset[0] }, { status: 201 });
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
  res.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  return res;
}

