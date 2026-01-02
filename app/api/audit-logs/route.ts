import { NextResponse } from 'next/server';
import { getPool } from '../../../lib/db';

export const runtime = 'nodejs';

function withCORS(res: NextResponse) {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  res.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  return res;
}

export async function OPTIONS() {
  return withCORS(new NextResponse(null, { status: 204 }));
}

// GET: Retrieve audit logs with filtering options
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const tableName = searchParams.get('tableName');
    const operation = searchParams.get('operation'); // INSERT, UPDATE, DELETE
    const recordId = searchParams.get('recordId');
    const changedByUserId = searchParams.get('changedByUserId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    const pool = await getPool();
    const rq = pool.request();

    let whereClause = 'WHERE 1=1';
    
    if (tableName) {
      rq.input('TableName', tableName);
      whereClause += ' AND TableName = @TableName';
    }
    
    if (operation) {
      rq.input('Operation', operation);
      whereClause += ' AND Operation = @Operation';
    }
    
    if (recordId) {
      rq.input('RecordId', recordId);
      whereClause += ' AND RecordId = @RecordId';
    }
    
    if (changedByUserId) {
      rq.input('ChangedByUserId', changedByUserId);
      whereClause += ' AND ChangedByUserId = @ChangedByUserId';
    }
    
    if (startDate) {
      rq.input('StartDate', startDate);
      whereClause += ' AND ChangedAtUtc >= @StartDate';
    }
    
    if (endDate) {
      rq.input('EndDate', endDate);
      whereClause += ' AND ChangedAtUtc <= @EndDate';
    }

    rq.input('Limit', limit);
    rq.input('Offset', offset);

    const query = `
      SELECT 
        AuditLogId,
        TableName,
        RecordId,
        Operation,
        FieldName,
        OldValue,
        NewValue,
        ChangedByUserId,
        ChangedByUserName,
        ChangedAtUtc,
        IPAddress,
        UserAgent,
        AdditionalInfo
      FROM dbo.AuditLogs
      ${whereClause}
      ORDER BY ChangedAtUtc DESC
      OFFSET @Offset ROWS
      FETCH NEXT @Limit ROWS ONLY
    `;

    const rs = await rq.query(query);

    // Get total count for pagination
    const countRq = pool.request();
    let countWhereClause = 'WHERE 1=1';
    if (tableName) {
      countRq.input('TableName', tableName);
      countWhereClause += ' AND TableName = @TableName';
    }
    if (operation) {
      countRq.input('Operation', operation);
      countWhereClause += ' AND Operation = @Operation';
    }
    if (recordId) {
      countRq.input('RecordId', recordId);
      countWhereClause += ' AND RecordId = @RecordId';
    }
    if (changedByUserId) {
      countRq.input('ChangedByUserId', changedByUserId);
      countWhereClause += ' AND ChangedByUserId = @ChangedByUserId';
    }
    if (startDate) {
      countRq.input('StartDate', startDate);
      countWhereClause += ' AND ChangedAtUtc >= @StartDate';
    }
    if (endDate) {
      countRq.input('EndDate', endDate);
      countWhereClause += ' AND ChangedAtUtc <= @EndDate';
    }

    const countRs = await countRq.query(`SELECT COUNT(*) AS Total FROM dbo.AuditLogs ${countWhereClause}`);
    const total = countRs.recordset[0]?.Total || 0;

    return withCORS(NextResponse.json({
      logs: rs.recordset,
      total,
      limit,
      offset
    }));
  } catch (e: any) {
    return withCORS(NextResponse.json({ error: String(e?.message || e) }, { status: 500 }));
  }
}

// POST: Create an audit log entry (called by other endpoints)
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      tableName,
      recordId,
      operation,
      fieldName,
      oldValue,
      newValue,
      changedByUserId,
      changedByUserName,
      ipAddress,
      userAgent,
      additionalInfo
    } = body;

    if (!tableName || !recordId || !operation) {
      return withCORS(NextResponse.json({ error: 'tableName, recordId, and operation are required' }, { status: 400 }));
    }

    const pool = await getPool();
    const rq = pool.request();
    
    rq.input('TableName', tableName);
    rq.input('RecordId', recordId);
    rq.input('Operation', operation);
    rq.input('FieldName', fieldName || null);
    rq.input('OldValue', oldValue !== undefined ? (oldValue === null ? null : String(oldValue)) : null);
    rq.input('NewValue', newValue !== undefined ? (newValue === null ? null : String(newValue)) : null);
    rq.input('ChangedByUserId', changedByUserId || null);
    rq.input('ChangedByUserName', changedByUserName || null);
    rq.input('IPAddress', ipAddress || null);
    rq.input('UserAgent', userAgent || null);
    rq.input('AdditionalInfo', additionalInfo || null);

    await rq.query(`
      INSERT INTO dbo.AuditLogs (
        AuditLogId, TableName, RecordId, Operation, FieldName, OldValue, NewValue,
        ChangedByUserId, ChangedByUserName, ChangedAtUtc, IPAddress, UserAgent, AdditionalInfo
      )
      VALUES (
        NEWID(), @TableName, @RecordId, @Operation, @FieldName, @OldValue, @NewValue,
        @ChangedByUserId, @ChangedByUserName, SYSUTCDATETIME(), @IPAddress, @UserAgent, @AdditionalInfo
      )
    `);

    return withCORS(NextResponse.json({ ok: true }, { status: 201 }));
  } catch (e: any) {
    return withCORS(NextResponse.json({ error: String(e?.message || e) }, { status: 500 }));
  }
}

