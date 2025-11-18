-- Add RejectionReason column to dbo.Risks if it does not exist
IF COL_LENGTH('dbo.Risks', 'RejectionReason') IS NULL
BEGIN
  ALTER TABLE dbo.Risks ADD RejectionReason NVARCHAR(1000) NULL;
END;

PRINT 'dbo.Risks altered: RejectionReason ensured.';


