-- Quick check: What Legal risks exist?
-- Run this FIRST to see what's in the database

SET NOCOUNT ON;

-- Get Legal department
DECLARE @LegalDeptId UNIQUEIDENTIFIER;
SELECT TOP 1 @LegalDeptId = DepartmentId FROM dbo.Departments WHERE Name = N'Legal';

IF @LegalDeptId IS NULL
BEGIN
    PRINT 'ERROR: Legal department not found!';
    SELECT Name FROM dbo.Departments ORDER BY Name;
    RETURN;
END

PRINT 'Legal Department ID: ' + CAST(@LegalDeptId AS NVARCHAR(50));
PRINT '';

-- Show ALL Legal risks
PRINT '=== ALL LEGAL RISKS ===';
SELECT 
    RiskId,
    RiskNo,
    LEFT(Description, 50) AS Description,
    DepartmentId
FROM dbo.Risks
WHERE DepartmentId = @LegalDeptId
AND RiskNo LIKE N'L%'
ORDER BY CAST(SUBSTRING(RiskNo, 2, 10) AS INT);

PRINT '';

-- Check specifically for L004, L008, L011
PRINT '=== CHECKING FOR L004, L008, L011 ===';
SELECT 
    RiskNo,
    Description,
    DepartmentId,
    CASE WHEN DepartmentId = @LegalDeptId THEN 'MATCH' ELSE 'NO MATCH' END AS DeptMatch
FROM dbo.Risks
WHERE RiskNo IN (N'L004', N'L008', N'L011');

PRINT '';
PRINT 'If you see risks above, the delete query should work.';
PRINT 'If you see NO risks, run insert_legal_risks.sql first.';

