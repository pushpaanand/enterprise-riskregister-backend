-- Script to delete L004, L008, L011 and renumber remaining Legal risks to be continuous
-- This will make the risk numbers L001, L002, L003, L004, ... without gaps

SET NOCOUNT ON;

-- Get Legal department ID (try exact match first, then case-insensitive)
DECLARE @LegalDeptId UNIQUEIDENTIFIER;
SELECT TOP 1 @LegalDeptId = DepartmentId FROM dbo.Departments WHERE Name = N'Legal';

-- If not found, try case-insensitive search
IF @LegalDeptId IS NULL
BEGIN
    SELECT TOP 1 @LegalDeptId = DepartmentId 
    FROM dbo.Departments 
    WHERE UPPER(LTRIM(RTRIM(Name))) = N'LEGAL';
END

IF @LegalDeptId IS NULL
BEGIN
    PRINT 'ERROR: Legal department not found!';
    PRINT 'Please run diagnose_legal_risks.sql first to check available departments.';
    RETURN;
END

PRINT 'Legal Department ID: ' + CAST(@LegalDeptId AS NVARCHAR(50));
PRINT 'Starting deletion and renumbering process for Legal risks...';
PRINT '';

-- Step 1: Check what risks exist before deletion
PRINT 'Step 0: Checking existing Legal risks...';
SELECT RiskNo, Description 
FROM dbo.Risks 
WHERE DepartmentId = @LegalDeptId 
AND RiskNo LIKE N'L%'
ORDER BY CAST(SUBSTRING(RiskNo, 2, 10) AS INT);
PRINT '';

-- Step 1: Delete the specified risks (L004, L008, L011)
PRINT 'Step 1: Deleting L004, L008, L011...';

-- First, check if these risks exist and show them
PRINT 'Checking for risks to delete:';
SELECT RiskId, RiskNo, Description, DepartmentId
FROM dbo.Risks 
WHERE DepartmentId = @LegalDeptId 
AND RiskNo IN (N'L004', N'L008', N'L011');

DECLARE @CheckCount INT;
SELECT @CheckCount = COUNT(*) 
FROM dbo.Risks 
WHERE DepartmentId = @LegalDeptId 
AND RiskNo IN (N'L004', N'L008', N'L011');

IF @CheckCount = 0
BEGIN
    PRINT '';
    PRINT 'WARNING: No risks found with RiskNo L004, L008, or L011.';
    PRINT 'Checking for similar RiskNo values...';
    SELECT RiskNo, Description, DepartmentId
    FROM dbo.Risks 
    WHERE DepartmentId = @LegalDeptId 
    AND (RiskNo LIKE N'L004%' OR RiskNo LIKE N'L008%' OR RiskNo LIKE N'L011%');
    PRINT '';
    PRINT 'Skipping deletion step. Proceeding to renumbering...';
END
ELSE
BEGIN
    PRINT '';
    PRINT 'Found ' + CAST(@CheckCount AS NVARCHAR(10)) + ' risks to delete.';
    PRINT 'Starting deletion process...';
    
    -- Get the RiskIds first for more reliable deletion
    DECLARE @RiskIdsToDelete TABLE (RiskId UNIQUEIDENTIFIER);
    INSERT INTO @RiskIdsToDelete (RiskId)
    SELECT RiskId 
    FROM dbo.Risks 
    WHERE DepartmentId = @LegalDeptId 
    AND RiskNo IN (N'L004', N'L008', N'L011');
    
    -- Delete from RiskHistory first (if exists) to maintain referential integrity
    DECLARE @HistoryDeleted INT;
    DELETE FROM dbo.RiskHistory 
    WHERE RiskId IN (SELECT RiskId FROM @RiskIdsToDelete);
    SET @HistoryDeleted = @@ROWCOUNT;
    PRINT 'Deleted ' + CAST(@HistoryDeleted AS NVARCHAR(10)) + ' records from RiskHistory';
    
    -- Delete from Incidents linked to these risks (if exists)
    DECLARE @IncidentsDeleted INT;
    DELETE FROM dbo.Incidents 
    WHERE RiskId IN (SELECT RiskId FROM @RiskIdsToDelete);
    SET @IncidentsDeleted = @@ROWCOUNT;
    PRINT 'Deleted ' + CAST(@IncidentsDeleted AS NVARCHAR(10)) + ' records from Incidents';
    
    -- Delete the risks one by one to ensure all are deleted
    DECLARE @DeletedCount INT = 0;
    DECLARE @CurrentRiskId UNIQUEIDENTIFIER;
    DECLARE @CurrentRiskNo NVARCHAR(50);
    
    DECLARE delete_cursor CURSOR FOR
    SELECT rs.RiskId, rs.RiskNo FROM @RiskIdsToDelete r
    INNER JOIN dbo.Risks rs ON r.RiskId = rs.RiskId;
    
    OPEN delete_cursor;
    FETCH NEXT FROM delete_cursor INTO @CurrentRiskId, @CurrentRiskNo;
    
    WHILE @@FETCH_STATUS = 0
    BEGIN
        DELETE FROM dbo.Risks WHERE RiskId = @CurrentRiskId;
        IF @@ROWCOUNT > 0
        BEGIN
            SET @DeletedCount = @DeletedCount + 1;
            PRINT 'Deleted risk: ' + @CurrentRiskNo;
        END
        FETCH NEXT FROM delete_cursor INTO @CurrentRiskId, @CurrentRiskNo;
    END;
    
    CLOSE delete_cursor;
    DEALLOCATE delete_cursor;
    
    PRINT '';
    PRINT 'Total deleted: ' + CAST(@DeletedCount AS NVARCHAR(10)) + ' risks (L004, L008, L011)';
    PRINT '';
END

-- Step 2: Renumber remaining risks to be continuous
PRINT 'Step 2: Renumbering remaining risks to be continuous...';

-- Create a temporary table to hold the mapping of old RiskNo to new RiskNo
-- We'll use ROW_NUMBER() to assign sequential numbers
DECLARE @Renumbering TABLE (
    RiskId UNIQUEIDENTIFIER,
    OldRiskNo NVARCHAR(50),
    NewRiskNo NVARCHAR(50),
    RowNum INT
);

-- Insert all remaining Legal risks ordered by their current RiskNo
INSERT INTO @Renumbering (RiskId, OldRiskNo, NewRiskNo, RowNum)
SELECT 
    RiskId,
    RiskNo AS OldRiskNo,
    N'L' + RIGHT('00' + CAST(ROW_NUMBER() OVER (ORDER BY 
        CAST(SUBSTRING(RiskNo, 2, 10) AS INT)
    ) AS NVARCHAR(10)), 3) AS NewRiskNo,
    ROW_NUMBER() OVER (ORDER BY CAST(SUBSTRING(RiskNo, 2, 10) AS INT)) AS RowNum
FROM dbo.Risks
WHERE DepartmentId = @LegalDeptId
AND RiskNo LIKE N'L%'
AND ISNUMERIC(SUBSTRING(RiskNo, 2, 10)) = 1
ORDER BY CAST(SUBSTRING(RiskNo, 2, 10) AS INT);

-- Show what will be renumbered
PRINT 'Renumbering mapping:';
SELECT OldRiskNo, NewRiskNo FROM @Renumbering ORDER BY RowNum;
PRINT '';

-- Update RiskNo for each risk
DECLARE @UpdateCount INT = 0;
DECLARE @RiskId UNIQUEIDENTIFIER;
DECLARE @OldRiskNo NVARCHAR(50);
DECLARE @NewRiskNo NVARCHAR(50);

DECLARE renumber_cursor CURSOR FOR
SELECT RiskId, OldRiskNo, NewRiskNo 
FROM @Renumbering
WHERE OldRiskNo <> NewRiskNo
ORDER BY RowNum;

OPEN renumber_cursor;
FETCH NEXT FROM renumber_cursor INTO @RiskId, @OldRiskNo, @NewRiskNo;

WHILE @@FETCH_STATUS = 0
BEGIN
    -- Update the RiskNo
    UPDATE dbo.Risks
    SET RiskNo = @NewRiskNo,
        UpdatedAtUtc = SYSUTCDATETIME()
    WHERE RiskId = @RiskId;
    
    SET @UpdateCount = @UpdateCount + 1;
    PRINT 'Renumbered ' + @OldRiskNo + ' -> ' + @NewRiskNo;
    
    FETCH NEXT FROM renumber_cursor INTO @RiskId, @OldRiskNo, @NewRiskNo;
END;

CLOSE renumber_cursor;
DEALLOCATE renumber_cursor;

PRINT '';
PRINT 'Renumbered ' + CAST(@UpdateCount AS NVARCHAR(10)) + ' risks';
PRINT '';

-- Step 3: Verify the results
PRINT 'Step 3: Verification - Current Legal risks:';
SELECT 
    RiskNo,
    Description,
    Status
FROM dbo.Risks
WHERE DepartmentId = @LegalDeptId
AND RiskNo LIKE N'L%'
ORDER BY CAST(SUBSTRING(RiskNo, 2, 10) AS INT);

DECLARE @TotalCount INT;
SELECT @TotalCount = COUNT(*) 
FROM dbo.Risks
WHERE DepartmentId = @LegalDeptId
AND RiskNo LIKE N'L%';

PRINT '';
PRINT 'Total Legal risks after deletion and renumbering: ' + CAST(@TotalCount AS NVARCHAR(10));
PRINT '';
PRINT 'Process completed successfully!';

