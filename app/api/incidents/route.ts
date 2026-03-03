import { NextResponse } from 'next/server';
import { getPool } from '../../../lib/db';
import { logAuditEvent, getRequestMetadata } from '../../../lib/audit';

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
           i.CreatedByUserId, i.CreatedAtUtc, i.UpdatedAtUtc,
           i.ApprovalStatus, i.RejectionReason
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
  // Support both camelCase (API) and PascalCase (legacy)
  const riskId = b.riskId ?? b.RiskId;
  const summary = b.summary ?? b.Summary ?? null;
  const occurredAtUtc = b.occurredAtUtc ?? b.OccurredAtUtc;
  const description = b.description ?? b.Description ?? null;
  const mitigationSteps = b.mitigationSteps ?? b.MitigationSteps ?? null;
  const currentStatusText = b.currentStatusText ?? b.CurrentStatusText ?? null;
  const closedDateUtc = b.closedDateUtc ?? b.ClosedDateUtc ?? null;
  const createdByUserId = b.createdByUserId ?? b.CreatedByUserId ?? null;

  if (!riskId) {
    return NextResponse.json({ error: 'riskId is required' }, { status: 400 });
  }

  const pool = await getPool();

  // Derive DepartmentId from the risk if not provided
  let departmentId = b.departmentId ?? b.DepartmentId;
  if (!departmentId) {
    const riskRs = await pool.request().input('RiskId', riskId).query(`
      SELECT DepartmentId FROM dbo.Risks WHERE RiskId = @RiskId
    `);
    if (riskRs.recordset.length > 0) {
      departmentId = riskRs.recordset[0].DepartmentId;
    }
  }
  if (!departmentId) {
    return NextResponse.json({ error: 'Could not resolve department for the risk' }, { status: 400 });
  }

  // If creator is a regular 'user', new incident requires manager approval (ApprovalStatus = 'Pending')
  let approvalStatus: string | null = null;
  if (createdByUserId) {
    try {
      const roleRs = await pool.request().input('UserId', createdByUserId).query(`
        SELECT Role FROM dbo.Users WHERE UserId = @UserId
      `);
      if (roleRs.recordset.length > 0 && String(roleRs.recordset[0].Role || '').toLowerCase() === 'user') {
        approvalStatus = 'Pending';
      }
    } catch (e) {
      // ignore
    }
  }

  const rq = pool.request();
  rq.input('RiskId', riskId);
  rq.input('DepartmentId', departmentId);
  rq.input('Summary', summary);
  rq.input('OccurredAtUtc', occurredAtUtc);
  rq.input('Description', description);
  rq.input('MitigationSteps', mitigationSteps);
  rq.input('CurrentStatusText', currentStatusText);
  rq.input('ClosedDateUtc', closedDateUtc);
  rq.input('CreatedByUserId', createdByUserId);
  rq.input('ApprovalStatus', approvalStatus);
  const result = await rq.query(`
    DECLARE @id UNIQUEIDENTIFIER = NEWID();
    INSERT INTO dbo.incidents_t (
      IncidentId, RiskId, DepartmentId, Summary, OccurredAtUtc, Description,
      MitigationSteps, CurrentStatusText, ClosedDateUtc,
      CreatedByUserId, ApprovalStatus
    )
    VALUES (
      @id, @RiskId, @DepartmentId, @Summary, @OccurredAtUtc, @Description,
      @MitigationSteps, @CurrentStatusText, @ClosedDateUtc,
      @CreatedByUserId, @ApprovalStatus
    );
    SELECT @id AS IncidentId;
  `);
  const incidentId = result.recordset[0]?.IncidentId;
  
  // Log audit event for INSERT
  if (incidentId) {
    const { ipAddress, userAgent } = getRequestMetadata(req);
    let userName: string | null = null;
    if (createdByUserId) {
      try {
        const userRs = await pool.request().input('UserId', createdByUserId).query(`
          SELECT Name FROM dbo.Users WHERE UserId = @UserId
        `);
        if (userRs.recordset.length > 0) {
          userName = userRs.recordset[0].Name || null;
        }
      } catch (e) {
        // ignore
      }
    }
    await logAuditEvent({
      tableName: 'incidents_t',
      recordId: incidentId,
      operation: 'INSERT',
      newValue: JSON.stringify({
        summary,
        description,
        occurredAtUtc
      }),
      changedByUserId: createdByUserId,
      changedByUserName: userName,
      ipAddress,
      userAgent
    });
  }
  
  return NextResponse.json({ ok: true }, { status: 201 });
}

