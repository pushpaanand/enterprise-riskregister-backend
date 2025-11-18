-- Make Name column nullable in Risks table
-- This allows the column to accept NULL values

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Risks') AND name = 'Name')
BEGIN
  -- Check if column is already nullable
  IF (SELECT is_nullable FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Risks') AND name = 'Name') = 0
  BEGIN
    ALTER TABLE dbo.Risks ALTER COLUMN Name NVARCHAR(MAX) NULL;
    PRINT 'Name column set to nullable.';
  END
  ELSE
  BEGIN
    PRINT 'Name column is already nullable.';
  END
END
ELSE
BEGIN
  PRINT 'Name column does not exist in Risks table.';
END

PRINT 'Migration completed.';

