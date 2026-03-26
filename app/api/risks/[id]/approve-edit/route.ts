import { NextResponse } from 'next/server';
import { getPool } from '../../../../../lib/db';
import sql from 'mssql';

export const runtime = 'nodejs';

function withCORS(res: NextResponse) {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  res.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  return res;
}

export async function OPTIONS() {
  return withCORS(new NextResponse(null, { status: 204 }));
}

// Approve pending edit - applies changes from RiskHistory to Risks table
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const riskId = params.id;
    const body = await req.json();
    const { historyId, approvedByUserId } = body || {}; // historyId is the RiskHistoryId to approve

    if (!riskId || !historyId) {
      return withCORS(NextResponse.json({ error: 'Missing riskId or historyId' }, { status: 400 }));
    }

    const pool = await getPool();

    // Get the pending edit from RiskHistory
    const historyRs = await pool.request()
      .input('HistoryId', historyId)
      .input('RiskId', riskId)
      .query(`
        SELECT FieldName, NewValue, OldValue
        FROM dbo.RiskHistory
        WHERE RiskHistoryId = @HistoryId AND RiskId = @RiskId AND ApprovalStatus = 'Pending'
      `);

    if (historyRs.recordset.length === 0) {
      return withCORS(NextResponse.json({ error: 'Pending edit not found or already processed' }, { status: 404 }));
    }

    const pendingEdit = historyRs.recordset[0];
    const fieldName = pendingEdit.FieldName;
    const newValue = pendingEdit.NewValue;

    // Get all pending edits for this risk to apply them together
    const allPendingRs = await pool.request()
      .input('RiskId', riskId)
      .query(`
        SELECT FieldName, NewValue
        FROM dbo.RiskHistory
        WHERE RiskId = @RiskId AND ApprovalStatus = 'Pending'
        ORDER BY ChangedAtUtc
      `);

    // Build update query for Risks table (dedupe by field to avoid duplicate SQL params)
    const latestByField = new Map<string, any>();
    allPendingRs.recordset.forEach((edit: any) => {
      if (edit?.FieldName) {
        // rows are ordered by ChangedAtUtc, so last one wins per field
        latestByField.set(edit.FieldName, edit.NewValue);
      }
    });

    const updateFields: string[] = [];
    const updateRq = pool.request();
    updateRq.input('RiskId', riskId);

    latestByField.forEach((value: any, field: string) => {
      // Map field names to database columns
      if (field === 'Description') {
        updateRq.input('Description', value);
        updateFields.push('Description = @Description');
      } else if (field === 'Impact') {
        updateRq.input('Impact', value);
        updateFields.push('Impact = @Impact');
      } else if (field === 'Likelihood') {
        updateRq.input('Likelihood', value);
        updateFields.push('Likelihood = @Likelihood');
      } else if (field === 'Status') {
        updateRq.input('Status', value);
        updateFields.push('Status = @Status');
      } else if (field === 'Identification') {
        updateRq.input('Identification', value);
        updateFields.push('Identification = @Identification');
      } else if (field === 'ExistingControlInPlace') {
        updateRq.input('ExistingControlInPlace', value);
        updateFields.push('ExistingControlInPlace = @ExistingControlInPlace');
      } else if (field === 'PlanOfAction') {
        updateRq.input('PlanOfAction', value);
        updateFields.push('PlanOfAction = @PlanOfAction');
      } else if (field === 'RiskIndicator') {
        updateRq.input('RiskIndicator', value);
        updateFields.push('RiskIndicator = @RiskIndicator');
      } else if (field === 'Category') {
        updateRq.input('CategoryId', value);
        updateFields.push('CategoryId = @CategoryId');
      }
    });

    if (updateFields.length > 0) {
      updateFields.push('UpdatedAtUtc = SYSUTCDATETIME()');
      const updateSql = `
        UPDATE dbo.Risks
        SET ${updateFields.join(', ')}
        WHERE RiskId = @RiskId
      `;
      await updateRq.query(updateSql);
    }

    // Update all pending edits for this risk to Approved
    await pool.request()
      .input('RiskId', riskId)
      .input('ApprovedByUserId', approvedByUserId || null)
      .query(`
        UPDATE dbo.RiskHistory
        SET ApprovalStatus = 'Approved',
            ApprovedByUserId = @ApprovedByUserId,
            ApprovedAtUtc = SYSUTCDATETIME()
        WHERE RiskId = @RiskId AND ApprovalStatus = 'Pending'
      `);

    return withCORS(NextResponse.json({ ok: true, message: 'Edit approved and applied successfully' }));
  } catch (e: any) {
    return withCORS(NextResponse.json({ error: String(e?.message || e) }, { status: 500 }));
  }
}

