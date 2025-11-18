-- Step 1: Drop foreign key constraint from Risks.CategoryId to RiskCategories
-- This will allow us to change CategoryId type and optionally drop RiskCategories table

DECLARE @fkName NVARCHAR(128);
DECLARE @sql NVARCHAR(MAX);

-- Find the foreign key constraint on Risks.CategoryId
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
  PRINT 'Dropped foreign key constraint: ' + @fkName;
END
ELSE
BEGIN
  PRINT 'No foreign key constraint found on Risks.CategoryId referencing RiskCategories.';
END

-- Step 2: Now you can optionally drop RiskCategories table if no longer needed
-- Uncomment the line below if you want to drop the RiskCategories table:
-- DROP TABLE IF EXISTS dbo.RiskCategories;
-- PRINT 'RiskCategories table dropped.';

PRINT 'Foreign key constraint removed. You can now change CategoryId to NVARCHAR.';

