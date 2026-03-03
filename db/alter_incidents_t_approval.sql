-- Add approval status to incidents_t for new incident submission by users.
-- Run this and alter_incident_history_approval.sql before using incident user-approval flow.
-- When a user creates an incident, it is stored with ApprovalStatus = 'Pending' until manager approves

SET NOCOUNT ON;

IF COL_LENGTH('dbo.incidents_t', 'ApprovalStatus') IS NULL
BEGIN
  ALTER TABLE dbo.incidents_t ADD ApprovalStatus NVARCHAR(50) NULL;
  PRINT 'Added ApprovalStatus to incidents_t';
END

IF COL_LENGTH('dbo.incidents_t', 'RejectionReason') IS NULL
BEGIN
  ALTER TABLE dbo.incidents_t ADD RejectionReason NVARCHAR(1000) NULL;
  PRINT 'Added RejectionReason to incidents_t';
END

PRINT 'incidents_t approval columns done.';
