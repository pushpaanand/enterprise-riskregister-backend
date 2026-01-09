-- Diagnostic query to check Legal risks in the database
-- Run this first to see what data exists
-- This matches the structure used in insert_legal_risks.sql

SET NOCOUNT ON;

-- Check if Legal department exists
PRINT '=== Step 1: Checking Legal Department ===';
SELECT 
    DepartmentId,
    Name AS DepartmentName
FROM dbo.Departments 
WHERE Name LIKE N'%Legal%'
ORDER BY Name;

DECLARE @LegalDeptId UNIQUEIDENTIFIER;
SELECT TOP 1 @LegalDeptId = DepartmentId FROM dbo.Departments WHERE Name = N'Legal';

IF @LegalDeptId IS NULL
BEGIN
    PRINT '';
    PRINT 'Legal department not found with exact name "Legal".';
    PRINT 'Checking all departments:';
    SELECT DepartmentId, Name FROM dbo.Departments ORDER BY Name;
    PRINT '';
    PRINT 'Please check if Legal department exists or has a different name.';
END
ELSE
BEGIN
    PRINT '';
    PRINT 'Legal Department ID: ' + CAST(@LegalDeptId AS NVARCHAR(50));
    PRINT '';
    
    -- Check all Legal risks with all columns (matching insert query structure)
    PRINT '=== Step 2: All Legal Risks (matching insert_legal_risks.sql structure) ===';
    SELECT 
        RiskId,
        DepartmentId,
        RiskNo,
        Description,
        CategoryId,
        Identification,
        RiskIndicator,
        ExistingControlInPlace,
        PlanOfAction,
        Impact,
        Likelihood,
        Status,
        OwnerId,
        CreatedByUserId,
        CreatedAtUtc,
        UpdatedAtUtc
    FROM dbo.Risks
    WHERE DepartmentId = @LegalDeptId
    ORDER BY RiskNo;
    
    PRINT '';
    PRINT '=== Step 3: Summary - Legal Risks Count ===';
    SELECT 
        COUNT(*) AS TotalLegalRisks,
        COUNT(CASE WHEN RiskNo LIKE N'L%' THEN 1 END) AS RisksStartingWithL
    FROM dbo.Risks
    WHERE DepartmentId = @LegalDeptId;
    
    PRINT '';
    PRINT '=== Step 4: Checking for L004, L008, L011 specifically ===';
    SELECT 
        RiskId,
        RiskNo,
        Description,
        Status,
        CategoryId
    FROM dbo.Risks
    WHERE DepartmentId = @LegalDeptId
    AND (RiskNo = N'L004' OR RiskNo = N'L008' OR RiskNo = N'L011' 
         OR RiskNo LIKE N'L004%' OR RiskNo LIKE N'L008%' OR RiskNo LIKE N'L011%');
    
    DECLARE @TargetCount INT;
    SELECT @TargetCount = COUNT(*) 
    FROM dbo.Risks
    WHERE DepartmentId = @LegalDeptId
    AND RiskNo IN (N'L004', N'L008', N'L011');
    
    IF @TargetCount = 0
    BEGIN
        PRINT '';
        PRINT 'WARNING: L004, L008, and L011 were NOT found!';
        PRINT '';
        PRINT '=== Step 5: All risks starting with L (ordered by number) ===';
        SELECT 
            RiskNo,
            Description,
            Status,
            CategoryId
        FROM dbo.Risks
        WHERE DepartmentId = @LegalDeptId
        AND RiskNo LIKE N'L%'
        ORDER BY 
            CASE 
                WHEN ISNUMERIC(SUBSTRING(RiskNo, 2, 10)) = 1 
                THEN CAST(SUBSTRING(RiskNo, 2, 10) AS INT)
                ELSE 9999
            END;
    END
    ELSE
    BEGIN
        PRINT '';
        PRINT 'Found ' + CAST(@TargetCount AS NVARCHAR(10)) + ' target risks (L004, L008, L011)';
    END
END

