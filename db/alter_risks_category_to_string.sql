-- Alter dbo.Risks to change CategoryId from integer/GUID to NVARCHAR string (keeping column name as CategoryId)
SET NOCOUNT ON;

-- Drop any foreign keys referencing dbo.Risks(CategoryId)
DECLARE @fk sysname, @sql nvarchar(4000);
DECLARE fkcur CURSOR FAST_FORWARD FOR
SELECT fk.name
FROM sys.foreign_keys AS fk
JOIN sys.foreign_key_columns AS fkc ON fk.object_id = fkc.constraint_object_id
JOIN sys.columns AS c ON c.object_id = fkc.parent_object_id AND c.column_id = fkc.parent_column_id
JOIN sys.tables AS t ON t.object_id = c.object_id
WHERE t.schema_id = SCHEMA_ID('dbo') AND t.name = 'Risks' AND c.name = 'CategoryId';

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

-- Check if CategoryTemp exists (from a previous failed run) and drop it first
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Risks') AND name = 'CategoryTemp')
BEGIN
  ALTER TABLE dbo.Risks DROP COLUMN CategoryTemp;
END

-- Migrate existing CategoryId values to category name from RiskCategories table, then change type to NVARCHAR
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Risks') AND name = 'CategoryId')
BEGIN
  -- Check if CategoryId is already NVARCHAR (migration already done)
  DECLARE @DataType NVARCHAR(128);
  SELECT @DataType = t.name
  FROM sys.columns c
  JOIN sys.types t ON c.user_type_id = t.user_type_id
  WHERE c.object_id = OBJECT_ID('dbo.Risks') AND c.name = 'CategoryId';

  IF @DataType NOT IN ('nvarchar', 'varchar', 'nchar', 'char')
  BEGIN
    -- CategoryId exists but is not a string type, need to migrate
    
    -- Create temporary column to store category names
    ALTER TABLE dbo.Risks ADD CategoryTemp NVARCHAR(200) NULL;

    -- Migrate data: convert CategoryId to category name
    UPDATE r
    SET r.CategoryTemp = c.Name
    FROM dbo.Risks r
    LEFT JOIN dbo.RiskCategories c ON c.CategoryId = r.CategoryId
    WHERE r.CategoryId IS NOT NULL AND c.Name IS NOT NULL;

    -- Drop the old CategoryId column
    ALTER TABLE dbo.Risks DROP COLUMN CategoryId;

    -- Add new CategoryId column as NVARCHAR
    ALTER TABLE dbo.Risks ADD CategoryId NVARCHAR(200) NULL;

    -- Copy data from temp column to new CategoryId
    UPDATE dbo.Risks
    SET CategoryId = CategoryTemp
    WHERE CategoryTemp IS NOT NULL;

    -- Drop temporary column
    ALTER TABLE dbo.Risks DROP COLUMN CategoryTemp;
  END
  ELSE
  BEGIN
    -- CategoryId is already NVARCHAR, just migrate existing integer/GUID values if any
    UPDATE r
    SET r.CategoryId = c.Name
    FROM dbo.Risks r
    LEFT JOIN dbo.RiskCategories c ON c.CategoryId = CAST(r.CategoryId AS UNIQUEIDENTIFIER)
    WHERE r.CategoryId IS NOT NULL 
      AND ISNUMERIC(r.CategoryId) = 0 
      AND TRY_CAST(r.CategoryId AS UNIQUEIDENTIFIER) IS NOT NULL
      AND c.Name IS NOT NULL;
  END
END
ELSE
BEGIN
  -- CategoryId doesn't exist, add it as NVARCHAR
  ALTER TABLE dbo.Risks ADD CategoryId NVARCHAR(200) NULL;
END

PRINT 'dbo.Risks CategoryId column migrated to NVARCHAR successfully.';

