// Helper function to log audit events
import { getPool } from './db';

const NIL_GUID = '00000000-0000-0000-0000-000000000000';

function isGuid(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const re = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  const nil = /^00000000-0000-0000-0000-000000000000$/;
  return re.test(value) || nil.test(value);
}

export interface AuditLogData {
  tableName: string;
  recordId: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE' | 'READ';
  fieldName?: string | null;
  oldValue?: any;
  newValue?: any;
  changedByUserId?: string | null;
  changedByUserName?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  additionalInfo?: string | null;
}

export async function logAuditEvent(data: AuditLogData): Promise<void> {
  try {
    // Sanitize GUIDs to avoid conversion errors
    const safeRecordId = isGuid(data.recordId) ? data.recordId : NIL_GUID;
    const safeChangedByUserId = data.changedByUserId && isGuid(data.changedByUserId) ? data.changedByUserId : null;

    const pool = await getPool();
    const rq = pool.request();
    
    rq.input('TableName', data.tableName);
    rq.input('RecordId', safeRecordId);
    rq.input('Operation', data.operation);
    rq.input('FieldName', data.fieldName || null);
    rq.input('OldValue', data.oldValue !== undefined ? (data.oldValue === null ? null : String(data.oldValue)) : null);
    rq.input('NewValue', data.newValue !== undefined ? (data.newValue === null ? null : String(data.newValue)) : null);
    rq.input('ChangedByUserId', safeChangedByUserId);
    rq.input('ChangedByUserName', data.changedByUserName || null);
    rq.input('IPAddress', data.ipAddress || null);
    rq.input('UserAgent', data.userAgent || null);
    rq.input('AdditionalInfo', data.additionalInfo || null);

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
  } catch (error) {
    // Don't throw - audit logging should not break the main operation
    console.error('Failed to log audit event:', error);
  }
}

// Helper to get IP address and user agent from request
export function getRequestMetadata(req: Request): { ipAddress: string | null; userAgent: string | null } {
  const ipAddress = req.headers.get('x-forwarded-for') || 
                    req.headers.get('x-real-ip') || 
                    null;
  const userAgent = req.headers.get('user-agent') || null;
  return { ipAddress, userAgent };
}

