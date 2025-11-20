-- Add RiskIndicator column to Risks table
IF COL_LENGTH('dbo.Risks', 'RiskIndicator') IS NULL
BEGIN
  ALTER TABLE dbo.Risks ADD RiskIndicator NVARCHAR(500) NULL;
END

PRINT 'RiskIndicator column added to Risks table.';

