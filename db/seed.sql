-- SAMPLE SEED DATA (run after schema creation)

-- Departments
INSERT INTO dbo.Departments (DepartmentId, Name) VALUES
(NEWID(), N'Engineering'),
(NEWID(), N'Marketing'),
(NEWID(), N'HR');

DECLARE @Eng UNIQUEIDENTIFIER = (SELECT TOP 1 DepartmentId FROM dbo.Departments WHERE Name=N'Engineering');
DECLARE @Mkt UNIQUEIDENTIFIER = (SELECT TOP 1 DepartmentId FROM dbo.Departments WHERE Name=N'Marketing');
DECLARE @HR  UNIQUEIDENTIFIER = (SELECT TOP 1 DepartmentId FROM dbo.Departments WHERE Name=N'HR');

-- Users
INSERT INTO dbo.Users (UserId, Name, Role, DepartmentId) VALUES
(NEWID(), N'Sam',   N'user',    @Eng),
(NEWID(), N'Maya',  N'manager', @Eng),
(NEWID(), N'Alex',  N'admin',   NULL);

DECLARE @UserSam UNIQUEIDENTIFIER  = (SELECT TOP 1 UserId FROM dbo.Users WHERE Name=N'Sam');
DECLARE @UserMaya UNIQUEIDENTIFIER = (SELECT TOP 1 UserId FROM dbo.Users WHERE Name=N'Maya');
DECLARE @UserAlex UNIQUEIDENTIFIER = (SELECT TOP 1 UserId FROM dbo.Users WHERE Name=N'Alex');

-- Owners
INSERT INTO dbo.Owners (OwnerId, Name, DepartmentId) VALUES
(NEWID(), N'Alice Johnson', @Eng),
(NEWID(), N'Bob Williams',  @Mkt),
(NEWID(), N'Diana Miller',  @HR);

DECLARE @OwnerEng UNIQUEIDENTIFIER = (SELECT TOP 1 OwnerId FROM dbo.Owners WHERE Name=N'Alice Johnson');
DECLARE @OwnerMkt UNIQUEIDENTIFIER = (SELECT TOP 1 OwnerId FROM dbo.Owners WHERE Name=N'Bob Williams');
DECLARE @OwnerHR  UNIQUEIDENTIFIER = (SELECT TOP 1 OwnerId FROM dbo.Owners WHERE Name=N'Diana Miller');

-- Categories/Subcategories (optional)
INSERT INTO dbo.RiskCategories (CategoryId, Name) VALUES (NEWID(), N'Operational'), (NEWID(), N'Security'), (NEWID(), N'Strategic'), (NEWID(), N'People');
DECLARE @CatOperational UNIQUEIDENTIFIER = (SELECT TOP 1 CategoryId FROM dbo.RiskCategories WHERE Name=N'Operational');
DECLARE @CatSecurity    UNIQUEIDENTIFIER = (SELECT TOP 1 CategoryId FROM dbo.RiskCategories WHERE Name=N'Security');
DECLARE @CatStrategic   UNIQUEIDENTIFIER = (SELECT TOP 1 CategoryId FROM dbo.RiskCategories WHERE Name=N'Strategic');
DECLARE @CatPeople      UNIQUEIDENTIFIER = (SELECT TOP 1 CategoryId FROM dbo.RiskCategories WHERE Name=N'People');

INSERT INTO dbo.RiskSubcategories (SubcategoryId, CategoryId, Name) VALUES
(NEWID(), @CatOperational, N'Third-party dependency'),
(NEWID(), @CatSecurity,    N'Application Vulnerability'),
(NEWID(), @CatStrategic,   N'Go-to-market'),
(NEWID(), @CatPeople,      N'Engagement');

DECLARE @SubThirdParty UNIQUEIDENTIFIER = (SELECT TOP 1 SubcategoryId FROM dbo.RiskSubcategories WHERE Name=N'Third-party dependency');
DECLARE @SubAppVuln    UNIQUEIDENTIFIER = (SELECT TOP 1 SubcategoryId FROM dbo.RiskSubcategories WHERE Name=N'Application Vulnerability');
DECLARE @SubGTM        UNIQUEIDENTIFIER = (SELECT TOP 1 SubcategoryId FROM dbo.RiskSubcategories WHERE Name=N'Go-to-market');
DECLARE @SubEngage     UNIQUEIDENTIFIER = (SELECT TOP 1 SubcategoryId FROM dbo.RiskSubcategories WHERE Name=N'Engagement');

-- Risks
INSERT INTO dbo.Risks (RiskId, DepartmentId, RiskNo, Name, Description, CategoryId, SubcategoryId, Impact, Likelihood, Status, OwnerId, CreatedByUserId)
VALUES
(NEWID(), @Eng, N'R001', N'Third-Party API Outage', N'Payments may fail during provider downtime.', @CatOperational, @SubThirdParty, N'Significant', N'Likely',   N'Open',   @OwnerEng, @UserSam),
(NEWID(), @Eng, N'R002', N'Data Breach via SQLi',   N'User profile endpoint vulnerable to injection.', @CatSecurity,    @SubAppVuln,    N'Severe',      N'Possible', N'Open',   @OwnerEng, @UserMaya),
(NEWID(), @Mkt, N'R001', N'Marketing Misalignment', N'Campaign not aligned with release features.',    @CatStrategic,   @SubGTM,        N'Moderate',    N'Unlikely', N'Raised', @OwnerMkt, @UserSam),
(NEWID(), @HR,  N'R001', N'Low Morale',             N'Org changes reduced morale and productivity.',   @CatPeople,      @SubEngage,     N'Minor',       N'Possible', N'Closed', @OwnerHR,  @UserMaya);

DECLARE @RiskEngR001 UNIQUEIDENTIFIER = (SELECT TOP 1 RiskId FROM dbo.Risks WHERE RiskNo=N'R001' AND DepartmentId=@Eng);
DECLARE @RiskEngR002 UNIQUEIDENTIFIER = (SELECT TOP 1 RiskId FROM dbo.Risks WHERE RiskNo=N'R002' AND DepartmentId=@Eng);

-- Incidents
INSERT INTO dbo.Incidents (IncidentId, RiskId, DepartmentId, Summary, OccurredAtUtc, Description, MitigationSteps, CurrentStatusText, ClosedDateUtc, Status, FollowupStatus, CalledBy, CalledAtUtc, CallStatus, CallHappenedWith, CallRemarks, PhysicianStation, ServiceRequested, CreatedByUserId)
VALUES
(NEWID(), @RiskEngR001, @Eng, N'3rd party tickets held UHID details', SYSUTCDATETIME(), N'Kauvery Unit used external tool to log IT tickets.', N'Team asked to stop; requirements collected; migration planned.', N'Changes being implemented', NULL, N'Open',
 N'Pending', N'Support', DATEADD(hour, -4, SYSUTCDATETIME()), N'Positive', N'Patient Caretaker', N'No other complaints; review on 18/10.', N'--', N'No', @UserSam),
(NEWID(), @RiskEngR002, @Eng, N'SQLi test showed leakage risk', SYSUTCDATETIME(), N'Pen-test revealed union-based SQLi.', N'Param binding rollout; WAF rules tightened.', N'Hotfix tested; rollout pending', NULL, N'Open',
 N'Completed', N'Security', DATEADD(day, -2, SYSUTCDATETIME()), N'Neutral', N'Engineer', N'WAF blocked patterns; monitoring continues.', N'--', N'No', @UserMaya);


