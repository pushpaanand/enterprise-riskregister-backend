-- Add approval workflow columns to IncidentHistory (mirror RiskHistory).
-- Run this and alter_incidents_t_approval.sql before using incident user-edit approval flow.
-- Enables user incident edits to be stored as Pending and approved by manager

SET NOCOUNT ON;

-- IncidentHistory: ApprovalStatus
IF COL_LENGTH('dbo.IncidentHistory', 'ApprovalStatus') IS NULL
BEGIN
  ALTER TABLE dbo.IncidentHistory ADD ApprovalStatus NVARCHAR(50) NULL;
  PRINT 'Added ApprovalStatus to IncidentHistory';
END

-- IncidentHistory: ApprovedByUserId
IF COL_LENGTH('dbo.IncidentHistory', 'ApprovedByUserId') IS NULL
BEGIN
  ALTER TABLE dbo.IncidentHistory ADD ApprovedByUserId UNIQUEIDENTIFIER NULL;
  PRINT 'Added ApprovedByUserId to IncidentHistory';
END

-- IncidentHistory: ApprovedAtUtc
IF COL_LENGTH('dbo.IncidentHistory', 'ApprovedAtUtc') IS NULL
BEGIN
  ALTER TABLE dbo.IncidentHistory ADD ApprovedAtUtc DATETIME2 NULL;
  PRINT 'Added ApprovedAtUtc to IncidentHistory';
END

-- IncidentHistory: RejectionReason
IF COL_LENGTH('dbo.IncidentHistory', 'RejectionReason') IS NULL
BEGIN
  ALTER TABLE dbo.IncidentHistory ADD RejectionReason NVARCHAR(1000) NULL;
  PRINT 'Added RejectionReason to IncidentHistory';
END

PRINT 'IncidentHistory approval columns done.';
