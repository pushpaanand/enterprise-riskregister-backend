-- Ensure Branding user (EmployeeId 127250) exists and assign Branding B* risks to this user.
-- Safe to run multiple times.

SET NOCOUNT ON;

DECLARE @BrandingDeptId UNIQUEIDENTIFIER;
DECLARE @UserId UNIQUEIDENTIFIER;
DECLARE @EmployeeId NVARCHAR(128) = N'127250';
DECLARE @UserName NVARCHAR(255) = N'Haripriya';

-- Get or create Branding department
SELECT TOP 1 @BrandingDeptId = DepartmentId
FROM dbo.Departments
WHERE Name = N'Branding';

IF @BrandingDeptId IS NULL
BEGIN
    SET @BrandingDeptId = NEWID();
    INSERT INTO dbo.Departments (DepartmentId, Name)
    VALUES (@BrandingDeptId, N'Branding');
    PRINT 'Created Branding department';
END
ELSE
BEGIN
    PRINT 'Using existing Branding department';
END;

-- Try resolve user by EmployeeId first
SELECT TOP 1 @UserId = UserId
FROM dbo.Users
WHERE EmployeeId = @EmployeeId;

-- Fallback resolution by name in Branding department
IF @UserId IS NULL
BEGIN
    SELECT TOP 1 @UserId = UserId
    FROM dbo.Users
    WHERE Name = @UserName
      AND DepartmentId = @BrandingDeptId;
END;

-- Create user when not found
IF @UserId IS NULL
BEGIN
    SET @UserId = NEWID();
    INSERT INTO dbo.Users (UserId, Name, Role, DepartmentId, EmployeeId)
    VALUES (@UserId, @UserName, N'user', @BrandingDeptId, @EmployeeId);
    PRINT 'Created user Haripriya (127250)';
END
ELSE
BEGIN
    -- Normalize existing user details
    UPDATE dbo.Users
    SET Name = @UserName,
        Role = COALESCE(NULLIF(Role, N''), N'user'),
        DepartmentId = @BrandingDeptId,
        EmployeeId = COALESCE(EmployeeId, @EmployeeId)
    WHERE UserId = @UserId;
    PRINT 'Updated existing user details for Haripriya (127250)';
END;

-- Assign all Branding B* risks to this user as creator
UPDATE r
SET CreatedByUserId = @UserId,
    UpdatedAtUtc = SYSUTCDATETIME()
FROM dbo.Risks r
WHERE r.RiskNo LIKE N'B%'
  AND r.DepartmentId = @BrandingDeptId;

PRINT CONCAT('Updated Branding B* risks count: ', @@ROWCOUNT);

-- Verification
SELECT
    u.UserId,
    u.Name,
    u.EmployeeId,
    u.Role,
    d.Name AS Department
FROM dbo.Users u
LEFT JOIN dbo.Departments d ON d.DepartmentId = u.DepartmentId
WHERE u.UserId = @UserId;

SELECT
    COUNT(*) AS BrandingBRisksAssigned
FROM dbo.Risks
WHERE DepartmentId = @BrandingDeptId
  AND RiskNo LIKE N'B%'
  AND CreatedByUserId = @UserId;
