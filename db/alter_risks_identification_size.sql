-- Alter dbo.Risks.Identification column to increase size from NVARCHAR(50) to NVARCHAR(500)
-- This is needed to accommodate longer identification descriptions

SET NOCOUNT ON;

-- Check current column size
DECLARE @CurrentSize INT;
SELECT @CurrentSize = CHARACTER_MAXIMUM_LENGTH
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'dbo'
  AND TABLE_NAME = 'Risks'
  AND COLUMN_NAME = 'Identification';

IF @CurrentSize IS NOT NULL
BEGIN
    IF @CurrentSize < 500
    BEGIN
        -- Alter the column to increase size
        ALTER TABLE dbo.Risks
        ALTER COLUMN Identification NVARCHAR(500) NULL;
        
        PRINT 'Successfully altered Identification column from NVARCHAR(' + CAST(@CurrentSize AS VARCHAR(10)) + ') to NVARCHAR(500)';
    END
    ELSE
    BEGIN
        PRINT 'Identification column is already NVARCHAR(' + CAST(@CurrentSize AS VARCHAR(10)) + ') or larger. No changes needed.';
    END
END
ELSE
BEGIN
    PRINT 'Identification column does not exist. Please run alter_risks_add_columns.sql first.';
END

PRINT 'Script completed.';

