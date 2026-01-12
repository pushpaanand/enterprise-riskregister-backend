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
          NULL AS ChangedFields
        FROM dbo.RiskHistory h
        WHERE h.ChangedByUserId = @UserId
          AND h.ApprovalStatus IN ('Pending', 'Approved', 'Rejected')
        GROUP BY h.RiskId, h.ApprovalStatus
      `);

    // Group by RiskId to get the most recent status
    const statusMap: Record<string, any> = {};
    
    rs.recordset.forEach((row: any) => {
      // Convert GUID to string
      const riskId = row.RiskId ? String(row.RiskId) : null;
      if (!riskId) return;
      
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
      const rowLatestChange = row.LatestPendingChange || row.LatestRejectedChange || row.LatestApprovedChange;
      
      // Priority: Pending > Rejected > Approved
      // If no current status, use this row's status
      if (!currentStatus) {
        statusMap[riskId].status = rowStatus;
        statusMap[riskId].count = row.EditCount;
        statusMap[riskId].latestChange = rowLatestChange;
      } else if (rowStatus === 'Pending') {
        // Pending always takes priority over any existing status
        statusMap[riskId].status = 'Pending';
        statusMap[riskId].count = row.EditCount;
        statusMap[riskId].latestChange = row.LatestPendingChange || rowLatestChange;
      } else if (rowStatus === 'Rejected' && currentStatus !== 'Pending') {
        // Rejected takes priority over Approved, but not over Pending
        statusMap[riskId].status = 'Rejected';
        statusMap[riskId].count = row.EditCount;
        statusMap[riskId].latestChange = row.LatestRejectedChange || rowLatestChange;
      }
      // If rowStatus is 'Approved' and we already have Pending or Rejected, don't override
    });

    // Convert to array and get detailed info for all statuses
    const results = await Promise.all(
      Object.values(statusMap).map(async (item: any) => {
        if (!item.status) return null;
        
        // Get detailed changes for the status to collect changed fields
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

        // Collect unique field names
        const fieldNames = new Set<string>();
        detailRs.recordset.forEach((row: any) => {
          if (row.FieldName) {
            fieldNames.add(row.FieldName);
          }
        });

        return {
          ...item,
          changes: detailRs.recordset || [],
          changedFields: Array.from(fieldNames),
        };
      })
    );

    // Filter out null entries
    const filteredResults = results.filter((item: any) => item !== null);

    return withCORS(NextResponse.json(filteredResults));
  } catch (e: any) {
    return withCORS(NextResponse.json({ error: String(e?.message || e) }, { status: 500 }));
  }
}
