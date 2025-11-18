-- Complete script to change CategoryId from foreign key to NVARCHAR string
-- Run this script in order

PRINT 'Step 1: Dropping foreign key constraint from Risks.CategoryId...';

-- Step 1: Drop foreign key constraint from Risks.CategoryId to RiskCategories
DECLARE @fkName NVARCHAR(128);
DECLARE @sql NVARCHAR(MAX);

SELECT @fkName = fk.name
FROM sys.foreign_keys fk
INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
WHERE fk.parent_object_id = OBJECT_ID('dbo.Risks')
  AND fkc.parent_column_id = (SELECT column_id FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Risks') AND name = 'CategoryId')
  AND fkc.referenced_object_id = OBJECT_ID('dbo.RiskCategories');

IF @fkName IS NOT NULL
BEGIN
  SET @sql = 'ALTER TABLE dbo.Risks DROP CONSTRAINT ' + QUOTENAME(@fkName);
  EXEC sp_executesql @sql;
  PRINT '  Dropped constraint: ' + @fkName;
END
ELSE
BEGIN
  PRINT '  No foreign key constraint found.';
END

PRINT 'Step 2: Dropping CategoryId column...';

-- Step 2: Drop CategoryId column
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Risks') AND name = 'CategoryId')
BEGIN
  ALTER TABLE dbo.Risks DROP COLUMN CategoryId;
  PRINT '  CategoryId column dropped.';
END
ELSE
BEGIN
  PRINT '  CategoryId column does not exist.';
END

PRINT 'Step 3: Adding CategoryId as NVARCHAR...';

-- Step 3: Add CategoryId back as NVARCHAR
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Risks') AND name = 'CategoryId')
BEGIN
  ALTER TABLE dbo.Risks ADD CategoryId NVARCHAR(200) NULL;
  PRINT '  CategoryId added as NVARCHAR(200).';
END
ELSE
BEGIN
  PRINT '  CategoryId already exists.';
END

PRINT '';
PRINT 'Migration completed successfully!';
PRINT 'CategoryId is now NVARCHAR(200) and can store text values.';
PRINT '';
PRINT 'Optional: If you no longer need RiskCategories table, you can drop it:';
PRINT '  DROP TABLE IF EXISTS dbo.RiskCategories;';

