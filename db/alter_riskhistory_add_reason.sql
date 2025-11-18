-- Add RejectionReason column to dbo.RiskHistory if it does not exist
IF COL_LENGTH('dbo.RiskHistory', 'RejectionReason') IS NULL
BEGIN
  ALTER TABLE dbo.RiskHistory ADD RejectionReason NVARCHAR(1000) NULL;
END;

PRINT 'dbo.RiskHistory altered: RejectionReason ensured.';


