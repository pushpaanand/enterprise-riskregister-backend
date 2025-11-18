-- Alter dbo.Risks to remove SubcategoryId and add Identification, ExistingControlInPlace, PlanOfAction
SET NOCOUNT ON;

-- Drop any foreign keys referencing dbo.Risks(SubcategoryId)
DECLARE @fk sysname, @sql nvarchar(4000);
DECLARE fkcur CURSOR FAST_FORWARD FOR
SELECT fk.name
FROM sys.foreign_keys AS fk
JOIN sys.foreign_key_columns AS fkc ON fk.object_id = fkc.constraint_object_id
JOIN sys.columns AS c ON c.object_id = fkc.parent_object_id AND c.column_id = fkc.parent_column_id
JOIN sys.tables AS t ON t.object_id = c.object_id
WHERE t.schema_id = SCHEMA_ID('dbo') AND t.name = 'Risks' AND c.name = 'SubcategoryId';

OPEN fkcur;
FETCH NEXT FROM fkcur INTO @fk;
WHILE @@FETCH_STATUS = 0
BEGIN
  SET @sql = N'ALTER TABLE dbo.Risks DROP CONSTRAINT ' + QUOTENAME(@fk) + N';';
  EXEC sp_executesql @sql;
  FETCH NEXT FROM fkcur INTO @fk;
END
CLOSE fkcur;
DEALLOCATE fkcur;

-- Drop SubcategoryId column if exists
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Risks') AND name = 'SubcategoryId')
BEGIN
  ALTER TABLE dbo.Risks DROP COLUMN SubcategoryId;
END

-- Add new columns if not exist
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Risks') AND name = 'Identification')
BEGIN
  ALTER TABLE dbo.Risks ADD Identification NVARCHAR(50) NULL;
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Risks') AND name = 'ExistingControlInPlace')
BEGIN
  ALTER TABLE dbo.Risks ADD ExistingControlInPlace NVARCHAR(1000) NULL;
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Risks') AND name = 'PlanOfAction')
BEGIN
  ALTER TABLE dbo.Risks ADD PlanOfAction NVARCHAR(1000) NULL;
END

PRINT 'dbo.Risks altered successfully.';


