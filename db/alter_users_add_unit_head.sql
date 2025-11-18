-- Add Unit and IsUnitHead columns to dbo.Users if they don't exist
IF COL_LENGTH('dbo.Users', 'Unit') IS NULL
BEGIN
  ALTER TABLE dbo.Users ADD Unit NVARCHAR(50) NULL;
END;

IF COL_LENGTH('dbo.Users', 'IsUnitHead') IS NULL
BEGIN
  ALTER TABLE dbo.Users ADD IsUnitHead BIT NOT NULL CONSTRAINT DF_Users_IsUnitHead DEFAULT (0);
END;

-- Optional index to find unit heads quickly
IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = 'IX_Users_IsUnitHead' AND object_id = OBJECT_ID('dbo.Users')
)
BEGIN
  CREATE INDEX IX_Users_IsUnitHead ON dbo.Users(IsUnitHead);
END;


