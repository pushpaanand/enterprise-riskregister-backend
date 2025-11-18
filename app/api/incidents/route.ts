import { NextResponse } from 'next/server';
import { getPool } from '../../../lib/db';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const createdBy = searchParams.get('createdBy');
  const riskId = searchParams.get('riskId');
  const riskNo = searchParams.get('riskNo');
  const department = searchParams.get('department');

  const pool = await getPool();
  const rq = pool.request();
  let where = 'WHERE 1=1';
  if (createdBy) {
    rq.input('CreatedBy', createdBy);
    where += ' AND (i.CreatedByUserId = @CreatedBy OR r.CreatedByUserId = @CreatedBy)';
  }
  if (riskId) {
    rq.input('RiskId', riskId);
    where += ' AND i.RiskId = @RiskId';
  }
  if (riskNo) {
    rq.input('RiskNo', riskNo);
    where += ' AND r.RiskNo = @RiskNo';
  }
  if (department) {
    rq.input('DepName', department);
    where += ' AND d.Name = @DepName';
  }

  const rs = await rq.query(`
    SELECT i.IncidentId, i.RiskId, r.RiskNo,
           i.DepartmentId, d.Name AS Department,
           i.Summary, i.OccurredAtUtc, i.Description, i.MitigationSteps,
           i.CurrentStatusText, i.ClosedDateUtc,
           i.CreatedByUserId, i.CreatedAtUtc, i.UpdatedAtUtc
    FROM dbo.incidents_t i
    JOIN dbo.Risks r ON r.RiskId = i.RiskId
    JOIN dbo.Departments d ON d.DepartmentId = i.DepartmentId
    ${where}
    ORDER BY i.OccurredAtUtc DESC
  `);
  const res = NextResponse.json(rs.recordset);
  res.headers.set('Access-Control-Allow-Origin', '*');
  return res;
}

export async function POST(req: Request) {
  const b = await req.json();
  const pool = await getPool();
  const rq = pool.request();
  rq.input('RiskId', b.riskId);
  rq.input('DepartmentId', b.departmentId);
  rq.input('Summary', b.summary || null);
  rq.input('OccurredAtUtc', b.occurredAtUtc);
  rq.input('Description', b.description);
  rq.input('MitigationSteps', b.mitigationSteps || null);
  rq.input('CurrentStatusText', b.currentStatusText || null);
  rq.input('ClosedDateUtc', b.closedDateUtc || null);
  rq.input('CreatedByUserId', b.createdByUserId || null);
  await rq.query(`
    INSERT INTO dbo.incidents_t (
      IncidentId, RiskId, DepartmentId, Summary, OccurredAtUtc, Description,
      MitigationSteps, CurrentStatusText, ClosedDateUtc,
      CreatedByUserId
    )
    VALUES (
      NEWID(), @RiskId, @DepartmentId, @Summary, @OccurredAtUtc, @Description,
      @MitigationSteps, @CurrentStatusText, @ClosedDateUtc,
      @CreatedByUserId
    )
  `);
  return NextResponse.json({ ok: true }, { status: 201 });
}

