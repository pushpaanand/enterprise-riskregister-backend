-- Drop Name column from Risks table
-- Only Description will be used going forward

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Risks') AND name = 'Name')
BEGIN
  ALTER TABLE dbo.Risks DROP COLUMN Name;
  PRINT 'Name column dropped from Risks table.';
END
ELSE
BEGIN
  PRINT 'Name column does not exist in Risks table.';
END

PRINT 'Migration completed.';

