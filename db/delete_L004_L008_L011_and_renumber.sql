-- DELETE L004, L008, L011 AND RENUMBER - WITH FULL DIAGNOSTICS
-- This will show exactly what happens at each step

SET NOCOUNT ON;

BEGIN TRANSACTION;

BEGIN TRY
    -- Get Legal department
    DECLARE @LegalDeptId UNIQUEIDENTIFIER;
    SELECT TOP 1 @LegalDeptId = DepartmentId FROM dbo.Departments WHERE Name = N'Legal';
    
    IF @LegalDeptId IS NULL
    BEGIN
        PRINT 'ERROR: Legal department not found!';
        ROLLBACK TRANSACTION;
        RETURN;
    END
    
    PRINT 'Legal Department ID: ' + CAST(@LegalDeptId AS NVARCHAR(50));
    PRINT '';
    
    -- STEP 1: Show what exists BEFORE
    PRINT '=== BEFORE DELETION ===';
    SELECT RiskNo, LEFT(Description, 50) AS Description
    FROM dbo.Risks
    WHERE DepartmentId = @LegalDeptId AND RiskNo LIKE N'L%'
    ORDER BY CAST(SUBSTRING(RiskNo, 2, 10) AS INT);
    PRINT '';
    
    -- STEP 2: Get RiskIds for L004, L008, L011
    DECLARE @L004Id UNIQUEIDENTIFIER = NULL;
    DECLARE @L008Id UNIQUEIDENTIFIER = NULL;
    DECLARE @L011Id UNIQUEIDENTIFIER = NULL;
    
    SELECT @L004Id = RiskId FROM dbo.Risks WHERE DepartmentId = @LegalDeptId AND RiskNo = N'L004';
    SELECT @L008Id = RiskId FROM dbo.Risks WHERE DepartmentId = @LegalDeptId AND RiskNo = N'L008';
    SELECT @L011Id = RiskId FROM dbo.Risks WHERE DepartmentId = @LegalDeptId AND RiskNo = N'L011';
    
    PRINT '=== RISK IDs FOUND ===';
    IF @L004Id IS NOT NULL
        PRINT 'L004 RiskId: ' + CAST(@L004Id AS NVARCHAR(50));
    ELSE
        PRINT 'L004: NOT FOUND';
        
    IF @L008Id IS NOT NULL
        PRINT 'L008 RiskId: ' + CAST(@L008Id AS NVARCHAR(50));
    ELSE
        PRINT 'L008: NOT FOUND';
        
    IF @L011Id IS NOT NULL
        PRINT 'L011 RiskId: ' + CAST(@L011Id AS NVARCHAR(50));
    ELSE
        PRINT 'L011: NOT FOUND';
    PRINT '';
    
    -- STEP 3: Delete from RiskHistory
    PRINT '=== DELETING FROM RiskHistory ===';
    IF @L004Id IS NOT NULL
    BEGIN
        DELETE FROM dbo.RiskHistory WHERE RiskId = @L004Id;
        PRINT 'L004 RiskHistory: ' + CAST(@@ROWCOUNT AS NVARCHAR(10)) + ' rows deleted';
    END
    IF @L008Id IS NOT NULL
    BEGIN
        DELETE FROM dbo.RiskHistory WHERE RiskId = @L008Id;
        PRINT 'L008 RiskHistory: ' + CAST(@@ROWCOUNT AS NVARCHAR(10)) + ' rows deleted';
    END
    IF @L011Id IS NOT NULL
    BEGIN
        DELETE FROM dbo.RiskHistory WHERE RiskId = @L011Id;
        PRINT 'L011 RiskHistory: ' + CAST(@@ROWCOUNT AS NVARCHAR(10)) + ' rows deleted';
    END
    PRINT '';
    
    -- STEP 4: Delete from Incidents
    PRINT '=== DELETING FROM Incidents ===';
    IF @L004Id IS NOT NULL
    BEGIN
        DELETE FROM dbo.Incidents WHERE RiskId = @L004Id;
        PRINT 'L004 Incidents: ' + CAST(@@ROWCOUNT AS NVARCHAR(10)) + ' rows deleted';
    END
    IF @L008Id IS NOT NULL
    BEGIN
        DELETE FROM dbo.Incidents WHERE RiskId = @L008Id;
        PRINT 'L008 Incidents: ' + CAST(@@ROWCOUNT AS NVARCHAR(10)) + ' rows deleted';
    END
    IF @L011Id IS NOT NULL
    BEGIN
        DELETE FROM dbo.Incidents WHERE RiskId = @L011Id;
        PRINT 'L011 Incidents: ' + CAST(@@ROWCOUNT AS NVARCHAR(10)) + ' rows deleted';
    END
    PRINT '';
    
    -- STEP 5: Delete the risks
    PRINT '=== DELETING RISKS ===';
    IF @L004Id IS NOT NULL
    BEGIN
        DELETE FROM dbo.Risks WHERE RiskId = @L004Id;
        IF @@ROWCOUNT > 0
            PRINT '✓ L004 DELETED';
        ELSE
            PRINT '✗ L004 DELETE FAILED';
    END
    ELSE
        PRINT '✗ L004 NOT FOUND';
        
    IF @L008Id IS NOT NULL
    BEGIN
        DELETE FROM dbo.Risks WHERE RiskId = @L008Id;
        IF @@ROWCOUNT > 0
            PRINT '✓ L008 DELETED';
        ELSE
            PRINT '✗ L008 DELETE FAILED';
    END
    ELSE
        PRINT '✗ L008 NOT FOUND';
        
    IF @L011Id IS NOT NULL
    BEGIN
        DELETE FROM dbo.Risks WHERE RiskId = @L011Id;
        IF @@ROWCOUNT > 0
            PRINT '✓ L011 DELETED';
        ELSE
            PRINT '✗ L011 DELETE FAILED';
    END
    ELSE
        PRINT '✗ L011 NOT FOUND';
    PRINT '';
    
    -- STEP 6: Renumber remaining risks
    PRINT '=== RENUMBERING ===';
    
    DECLARE @RiskId UNIQUEIDENTIFIER;
    DECLARE @Counter INT = 1;
    DECLARE @NewRiskNo NVARCHAR(10);
    DECLARE @OldRiskNo NVARCHAR(10);
    DECLARE @Renumbered INT = 0;
    
    DECLARE renum_cursor CURSOR FOR
    SELECT RiskId, RiskNo
    FROM dbo.Risks
    WHERE DepartmentId = @LegalDeptId
    AND RiskNo LIKE N'L%'
    AND ISNUMERIC(SUBSTRING(RiskNo, 2, 10)) = 1
    ORDER BY CAST(SUBSTRING(RiskNo, 2, 10) AS INT);
    
    OPEN renum_cursor;
    FETCH NEXT FROM renum_cursor INTO @RiskId, @OldRiskNo;
    
    WHILE @@FETCH_STATUS = 0
    BEGIN
        SET @NewRiskNo = N'L' + RIGHT('000' + CAST(@Counter AS NVARCHAR(10)), 3);
        
        IF @OldRiskNo <> @NewRiskNo
        BEGIN
            UPDATE dbo.Risks
            SET RiskNo = @NewRiskNo,
                UpdatedAtUtc = GETUTCDATE()
            WHERE RiskId = @RiskId;
            
            IF @@ROWCOUNT > 0
            BEGIN
                SET @Renumbered = @Renumbered + 1;
                PRINT @OldRiskNo + ' -> ' + @NewRiskNo;
            END
        END
        
        SET @Counter = @Counter + 1;
        FETCH NEXT FROM renum_cursor INTO @RiskId, @OldRiskNo;
    END;
    
    CLOSE renum_cursor;
    DEALLOCATE renum_cursor;
    
    PRINT 'Total renumbered: ' + CAST(@Renumbered AS NVARCHAR(10));
    PRINT '';
    
    -- STEP 7: Show final results
    PRINT '=== AFTER DELETION AND RENUMBERING ===';
    SELECT RiskNo, LEFT(Description, 50) AS Description
    FROM dbo.Risks
    WHERE DepartmentId = @LegalDeptId AND RiskNo LIKE N'L%'
    ORDER BY CAST(SUBSTRING(RiskNo, 2, 10) AS INT);
    
    -- COMMIT TRANSACTION
    COMMIT TRANSACTION;
    PRINT '';
    PRINT '=== SUCCESS! Transaction committed. ===';
    
END TRY
BEGIN CATCH
    ROLLBACK TRANSACTION;
    PRINT '=== ERROR OCCURRED ===';
    PRINT 'Error Number: ' + CAST(ERROR_NUMBER() AS NVARCHAR(10));
    PRINT 'Error Message: ' + ERROR_MESSAGE();
    PRINT 'Transaction rolled back.';
END CATCH;
