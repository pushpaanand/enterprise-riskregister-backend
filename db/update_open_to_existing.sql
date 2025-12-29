-- Update all risks with status "Open" to "Existing"
-- First, check how many records will be affected
SELECT COUNT(*) AS RecordsToUpdate
FROM dbo.Risks
WHERE Status = 'Open';

-- Preview the records that will be updated
SELECT RiskId, RiskNo, Description, Status, Impact, Likelihood, UpdatedAtUtc
FROM dbo.Risks
WHERE Status = 'Open'
ORDER BY UpdatedAtUtc DESC;

-- Perform the update
UPDATE dbo.Risks
SET Status = 'Existing',
    UpdatedAtUtc = GETUTCDATE()  -- Update the timestamp to reflect the change
WHERE Status = 'Open';

-- Verify the update
SELECT COUNT(*) AS UpdatedRecords
FROM dbo.Risks
WHERE Status = 'Existing';

PRINT 'Update completed: All risks with status "Open" have been changed to "Existing".';

