-- Simple script to change CategoryId to NVARCHAR
-- This will drop foreign keys, drop the column, and recreate it as NVARCHAR

-- Step 1: Drop all foreign keys referencing CategoryId column in Risks table
DECLARE @fkName NVARCHAR(128);
DECLARE @tableName NVARCHAR(128);
DECLARE @sql NVARCHAR(MAX);

DECLARE fk_cursor CURSOR FOR
SELECT fk.name, OBJECT_SCHEMA_NAME(fk.parent_object_id) + '.' + OBJECT_NAME(fk.parent_object_id) AS table_name
FROM sys.foreign_keys fk
INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
WHERE fkc.referenced_object_id = OBJECT_ID('dbo.Risks')
  AND fkc.referenced_column_id = (SELECT column_id FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Risks') AND name = 'CategoryId');

OPEN fk_cursor;
FETCH NEXT FROM fk_cursor INTO @fkName, @tableName;
WHILE @@FETCH_STATUS = 0
BEGIN
  SET @sql = 'ALTER TABLE ' + @tableName + ' DROP CONSTRAINT ' + QUOTENAME(@fkName);
  EXEC sp_executesql @sql;
  PRINT 'Dropped constraint: ' + @fkName + ' from table: ' + @tableName;
  FETCH NEXT FROM fk_cursor INTO @fkName, @tableName;
END
CLOSE fk_cursor;
DEALLOCATE fk_cursor;

-- Step 2: Drop CategoryId column
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Risks') AND name = 'CategoryId')
BEGIN
  ALTER TABLE dbo.Risks DROP COLUMN CategoryId;
  PRINT 'CategoryId column dropped.';
END

-- Step 3: Add CategoryId as NVARCHAR
ALTER TABLE dbo.Risks ADD CategoryId NVARCHAR(200) NULL;
PRINT 'CategoryId added as NVARCHAR(200).';

PRINT 'Migration completed!';

