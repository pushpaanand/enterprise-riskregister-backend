-- Update role CHECK constraint to include 'unit_head'
-- Drop existing constraint if present
IF EXISTS (
  SELECT 1
  FROM sys.check_constraints
  WHERE name = 'CK_Users_Role'
    AND parent_object_id = OBJECT_ID('dbo.Users')
)
BEGIN
  ALTER TABLE dbo.Users DROP CONSTRAINT CK_Users_Role;
END;
GO

-- Recreate with allowed roles
ALTER TABLE dbo.Users WITH NOCHECK
ADD CONSTRAINT CK_Users_Role CHECK (Role IN (N'user', N'manager', N'admin', N'unit_head'));
GO

-- Enable the constraint for future inserts/updates
ALTER TABLE dbo.Users CHECK CONSTRAINT CK_Users_Role;
GO


