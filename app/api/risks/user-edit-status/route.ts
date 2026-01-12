import { NextResponse } from 'next/server';
import { getPool } from '../../../../lib/db';
import sql from 'mssql';

export const runtime = 'nodejs';

function withCORS(res: NextResponse) {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  res.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  return res;
}

export async function OPTIONS() {
  return withCORS(new NextResponse(null, { status: 204 }));
}

// Get edit status for risks edited by a specific user
// Returns: { riskId: { status: 'Pending'|'Approved'|'Rejected', count: number, latestChange: date } }
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return withCORS(NextResponse.json({ error: 'userId is required' }, { status: 400 }));
    }

    const pool = await getPool();
    
    // Get the latest edit status for each risk edited by this user
    const rs = await pool.request()
      .input('UserId', sql.UniqueIdentifier, userId)
      .query(`
        SELECT 
          h.RiskId,
          h.ApprovalStatus,
          COUNT(*) AS EditCount,
          MAX(h.ChangedAtUtc) AS LatestChange,
          MAX(CASE WHEN h.ApprovalStatus = 'Pending' THEN h.ChangedAtUtc END) AS LatestPendingChange,
          MAX(CASE WHEN h.ApprovalStatus = 'Approved' THEN h.ChangedAtUtc END) AS LatestApprovedChange,
          MAX(CASE WHEN h.ApprovalStatus = 'Rejected' THEN h.ChangedAtUtc END) AS LatestRejectedChange,
          STUFF((
            SELECT ', ' + h2.FieldName
            FROM (
              SELECT DISTINCT h2.FieldName
              FROM dbo.RiskHistory h2
              WHERE h2.RiskId = h.RiskId
                AND h2.ApprovalStatus = h.ApprovalStatus
                AND h2.ChangedByUserId = @UserId
                AND h2.FieldName IS NOT NULL
            ) AS distinctFields
            ORDER BY distinctFields.FieldName
            FOR XML PATH(''), TYPE
          ).value('.', 'NVARCHAR(MAX)'), 1, 2, '') AS ChangedFields
        FROM dbo.RiskHistory h
        WHERE h.ChangedByUserId = @UserId
          AND h.ApprovalStatus IN ('Pending', 'Approved', 'Rejected')
        GROUP BY h.RiskId, h.ApprovalStatus
      `);

    // Group by RiskId to get the most recent status
    const statusMap: Record<string, any> = {};
    
    rs.recordset.forEach((row: any) => {
      const riskId = row.RiskId;
      if (!statusMap[riskId]) {
        statusMap[riskId] = {
          riskId: riskId,
          status: null,
          count: 0,
          latestChange: null,
          changedFields: [],
        };
      }

      // Determine the most relevant status (Pending > Rejected > Approved)
      const currentStatus = statusMap[riskId].status;
      const rowStatus = row.ApprovalStatus;
      
      if (!currentStatus || 
          (rowStatus === 'Pending') ||
          (rowStatus === 'Rejected' && currentStatus !== 'Pending') ||
          (rowStatus === 'Approved' && currentStatus === 'Approved' && row.LatestApprovedChange > statusMap[riskId].latestChange)) {
        statusMap[riskId].status = rowStatus;
        statusMap[riskId].count = row.EditCount;
        
        if (rowStatus === 'Pending' && row.LatestPendingChange) {
          statusMap[riskId].latestChange = row.LatestPendingChange;
        } else if (rowStatus === 'Rejected' && row.LatestRejectedChange) {
          statusMap[riskId].latestChange = row.LatestRejectedChange;
        } else if (rowStatus === 'Approved' && row.LatestApprovedChange) {
          statusMap[riskId].latestChange = row.LatestApprovedChange;
        }
      }

      // Collect changed fields
      if (row.ChangedFields) {
        const fields = row.ChangedFields.split(', ');
        statusMap[riskId].changedFields = [
          ...new Set([...statusMap[riskId].changedFields, ...fields])
        ];
      }
    });

    // Convert to array and get detailed info for pending/rejected
    const results = await Promise.all(
      Object.values(statusMap).map(async (item: any) => {
        if (item.status === 'Pending' || item.status === 'Rejected') {
          // Get detailed changes
          const detailRs = await pool.request()
            .input('RiskId', sql.UniqueIdentifier, item.riskId)
            .input('UserId', sql.UniqueIdentifier, userId)
            .input('Status', sql.NVarChar, item.status)
            .query(`
              SELECT 
                FieldName,
                OldValue,
                NewValue,
                ChangedAtUtc,
                RejectionReason
              FROM dbo.RiskHistory
              WHERE RiskId = @RiskId 
                AND ChangedByUserId = @UserId
                AND ApprovalStatus = @Status
              ORDER BY ChangedAtUtc DESC
            `);

          return {
            ...item,
            changes: detailRs.recordset,
          };
        }
        return item;
      })
    );

    return withCORS(NextResponse.json(results));
  } catch (e: any) {
    return withCORS(NextResponse.json({ error: String(e?.message || e) }, { status: 500 }));
  }
}
