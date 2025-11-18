-- Add EmployeeId column and unique index to dbo.Users if not present
IF COL_LENGTH('dbo.Users', 'EmployeeId') IS NULL
BEGIN
  ALTER TABLE dbo.Users ADD EmployeeId NVARCHAR(128) NULL;
END;
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = 'UX_Users_EmployeeId' AND object_id = OBJECT_ID('dbo.Users')
)
BEGIN
  CREATE UNIQUE INDEX UX_Users_EmployeeId ON dbo.Users (EmployeeId) WHERE EmployeeId IS NOT NULL;
END;
GO


