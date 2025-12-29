-- Create UserDepartments junction table for many-to-many relationship
-- This allows users/managers to be assigned to multiple departments

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'UserDepartments' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE dbo.UserDepartments (
    UserDepartmentId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    UserId UNIQUEIDENTIFIER NOT NULL,
    DepartmentId UNIQUEIDENTIFIER NOT NULL,
    CreatedAtUtc DATETIME NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT FK_UserDepartments_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(UserId) ON DELETE CASCADE,
    CONSTRAINT FK_UserDepartments_Departments FOREIGN KEY (DepartmentId) REFERENCES dbo.Departments(DepartmentId) ON DELETE CASCADE,
    CONSTRAINT UQ_UserDepartments_User_Dept UNIQUE (UserId, DepartmentId)
  );

  -- Create index for faster lookups
  CREATE INDEX IX_UserDepartments_UserId ON dbo.UserDepartments(UserId);
  CREATE INDEX IX_UserDepartments_DepartmentId ON dbo.UserDepartments(DepartmentId);

  PRINT 'UserDepartments table created successfully.';
END
ELSE
BEGIN
  PRINT 'UserDepartments table already exists.';
END

-- Migrate existing single department assignments to UserDepartments
-- This ensures existing users/managers with DepartmentId are preserved
INSERT INTO dbo.UserDepartments (UserId, DepartmentId)
SELECT u.UserId, u.DepartmentId
FROM dbo.Users u
WHERE u.DepartmentId IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM dbo.UserDepartments ud 
    WHERE ud.UserId = u.UserId AND ud.DepartmentId = u.DepartmentId
  );

PRINT 'Migrated existing department assignments to UserDepartments table.';

