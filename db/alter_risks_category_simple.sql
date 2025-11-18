-- Simple script to change CategoryId from integer/GUID to NVARCHAR
-- Run these commands one by one if needed

-- Step 1: Drop any foreign key constraints on CategoryId
DECLARE @sql NVARCHAR(MAX) = '';
SELECT @sql = @sql + 'ALTER TABLE ' + QUOTENAME(OBJECT_SCHEMA_NAME(parent_object_id)) + '.' + QUOTENAME(OBJECT_NAME(parent_object_id)) + 
                   ' DROP CONSTRAINT ' + QUOTENAME(name) + ';' + CHAR(13)
FROM sys.foreign_keys
WHERE referenced_object_id = OBJECT_ID('dbo.Risks')
  AND EXISTS (
    SELECT 1 FROM sys.foreign_key_columns 
    WHERE constraint_object_id = foreign_keys.object_id 
      AND referenced_column_id = (SELECT column_id FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Risks') AND name = 'CategoryId')
  );

IF @sql <> ''
BEGIN
  EXEC sp_executesql @sql;
  PRINT 'Foreign key constraints dropped.';
END
ELSE
BEGIN
  PRINT 'No foreign key constraints found on CategoryId.';
END

-- Step 2: Drop the CategoryId column
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Risks') AND name = 'CategoryId')
BEGIN
  ALTER TABLE dbo.Risks DROP COLUMN CategoryId;
  PRINT 'CategoryId column dropped.';
END

-- Step 3: Add CategoryId back as NVARCHAR
ALTER TABLE dbo.Risks ADD CategoryId NVARCHAR(200) NULL;
PRINT 'CategoryId column added as NVARCHAR(200).';

PRINT 'Migration completed successfully.';
PRINT 'Note: You may need to manually update existing CategoryId values with category names from RiskCategories table.';

