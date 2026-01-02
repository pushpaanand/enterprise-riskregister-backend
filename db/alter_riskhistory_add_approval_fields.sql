-- Add approval fields to RiskHistory table for pending edit approval workflow
-- This allows user edits to be saved as pending and require manager approval

SET NOCOUNT ON;

-- Add ApprovalStatus column if it doesn't exist
IF COL_LENGTH('dbo.RiskHistory', 'ApprovalStatus') IS NULL
BEGIN
  ALTER TABLE dbo.RiskHistory ADD ApprovalStatus NVARCHAR(50) NULL;
  PRINT 'Added ApprovalStatus column to RiskHistory';
END
ELSE
BEGIN
  PRINT 'ApprovalStatus column already exists';
END

-- Add ApprovedByUserId column if it doesn't exist
IF COL_LENGTH('dbo.RiskHistory', 'ApprovedByUserId') IS NULL
BEGIN
  ALTER TABLE dbo.RiskHistory ADD ApprovedByUserId UNIQUEIDENTIFIER NULL;
  PRINT 'Added ApprovedByUserId column to RiskHistory';
END
ELSE
BEGIN
  PRINT 'ApprovedByUserId column already exists';
END

-- Add ApprovedAtUtc column if it doesn't exist
IF COL_LENGTH('dbo.RiskHistory', 'ApprovedAtUtc') IS NULL
BEGIN
  ALTER TABLE dbo.RiskHistory ADD ApprovedAtUtc DATETIME2 NULL;
  PRINT 'Added ApprovedAtUtc column to RiskHistory';
END
ELSE
BEGIN
  PRINT 'ApprovedAtUtc column already exists';
END

PRINT 'RiskHistory table updated successfully for approval workflow.';

