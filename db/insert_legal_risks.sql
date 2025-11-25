-- INSERT script for Legal Risks (L001-L023) from Risk Register
-- This script will create/use Legal department and insert all 23 legal risks
--
-- NOTE: The ExistingControlInPlace and PlanOfAction fields contain summarized text.
-- If your source data has more detailed multi-point descriptions (a, b, c, etc.),
-- please update these fields with the full detailed text from your risk register.
-- Current column size is NVARCHAR(1000). If needed, alter to NVARCHAR(MAX) first.

SET NOCOUNT ON;

-- Declare variables
DECLARE @LegalDeptId UNIQUEIDENTIFIER;
DECLARE @LegalOwnerId UNIQUEIDENTIFIER;
DECLARE @LegalUserId UNIQUEIDENTIFIER;

-- Get or create Legal department
SELECT TOP 1 @LegalDeptId = DepartmentId FROM dbo.Departments WHERE Name = N'Legal';
IF @LegalDeptId IS NULL
BEGIN
    SET @LegalDeptId = NEWID();
    INSERT INTO dbo.Departments (DepartmentId, Name) VALUES (@LegalDeptId, N'Legal');
    PRINT 'Created Legal department';
END
ELSE
BEGIN
    PRINT 'Using existing Legal department';
END

-- Get or create a Legal Owner
SELECT TOP 1 @LegalOwnerId = OwnerId FROM dbo.Owners WHERE DepartmentId = @LegalDeptId;
IF @LegalOwnerId IS NULL
BEGIN
    SET @LegalOwnerId = NEWID();
    INSERT INTO dbo.Owners (OwnerId, Name, DepartmentId) VALUES (@LegalOwnerId, N'Legal Department Owner', @LegalDeptId);
    PRINT 'Created Legal Owner';
END
ELSE
BEGIN
    PRINT 'Using existing Legal Owner';
END

-- Get or create a Legal User (for CreatedByUserId)
SELECT TOP 1 @LegalUserId = UserId FROM dbo.Users WHERE DepartmentId = @LegalDeptId;
IF @LegalUserId IS NULL
BEGIN
    SET @LegalUserId = NEWID();
    INSERT INTO dbo.Users (UserId, Name, Role, DepartmentId) VALUES (@LegalUserId, N'Legal User', N'user', @LegalDeptId);
    PRINT 'Created Legal User';
END

-- Insert all 23 Legal Risks
INSERT INTO dbo.Risks (RiskId, DepartmentId, RiskNo, Description, CategoryId, Identification, RiskIndicator, ExistingControlInPlace, PlanOfAction, Impact, Likelihood, Status, OwnerId, CreatedByUserId, CreatedAtUtc, UpdatedAtUtc)
VALUES
-- Corporate Governance Risks (L001-L007)
(NEWID(), @LegalDeptId, N'L001', N'Confidentiality of UPSI information- Trading during TWCP', N'Corporate Governance', N'Residual', N'Weekly alert from RTA (Cameo)', N'Multiple existing controls in place for UPSI management and trading restrictions', N'Enhanced monitoring and compliance review', N'Significant', N'Possible', N'Open', @LegalOwnerId, @LegalUserId, SYSUTCDATETIME(), SYSUTCDATETIME()),

(NEWID(), @LegalDeptId, N'L002', N'Not obtaining AVM consent for matters', N'Corporate Governance', N'Residual', N'Timeline of sending the Agendas/information', N'Process for obtaining AVM consent in place', N'Review and strengthen consent tracking mechanism', N'Moderate', N'Very likely', N'Open', @LegalOwnerId, @LegalUserId, SYSUTCDATETIME(), SYSUTCDATETIME()),

(NEWID(), @LegalDeptId, N'L003', N'Violation of terms of SHA', N'Corporate Governance', N'Residual', N'Volody Dashboard', N'Regular monitoring of SHA compliance', N'Quarterly SHA compliance audit', N'Significant', N'Likely', N'Open', @LegalOwnerId, @LegalUserId, SYSUTCDATETIME(), SYSUTCDATETIME()),

(NEWID(), @LegalDeptId, N'L004', N'Delay in circulation of Agenda/information', N'Corporate Governance', N'Residual', N'Timeline of sending the Agendas/information', N'Process in place for timely circulation', N'Automated reminder system for agenda circulation', N'Moderate', N'Very likely', N'Open', @LegalOwnerId, @LegalUserId, SYSUTCDATETIME(), SYSUTCDATETIME()),

(NEWID(), @LegalDeptId, N'L005', N'Appropriate composition of the Board', N'Corporate Governance', N'Inherent', N'Board composition reports', N'Regular review of board composition against regulatory requirements', N'Annual board composition review and gap analysis', N'Significant', N'Possible', N'Open', @LegalOwnerId, @LegalUserId, SYSUTCDATETIME(), SYSUTCDATETIME()),

(NEWID(), @LegalDeptId, N'L006', N'Breaching the limit of loans, investments, guarantees & securities as approved by Board & Shareholders', N'Corporate Governance', N'Residual', N'Monitoring reports', N'Approval process and limits tracking in place', N'Enhanced monitoring and real-time alert system', N'Severe', N'Possible', N'Open', @LegalOwnerId, @LegalUserId, SYSUTCDATETIME(), SYSUTCDATETIME()),

(NEWID(), @LegalDeptId, N'L007', N'Restrictions on transactions with related parties (managing RPTs)', N'Corporate Governance', N'Residual', N'RPT tracking dashboard', N'RPT policy and approval process in place', N'(a) Mapping/highlighting all related parties (b) Ensuring all RPTs are identified and approved (c) Periodic review of RPT transactions', N'Significant', N'Likely', N'Open', @LegalOwnerId, @LegalUserId, SYSUTCDATETIME(), SYSUTCDATETIME()),

-- Contractual Risk (L008-L011)
(NEWID(), @LegalDeptId, N'L008', N'Tracking of Contracts approved and executed', N'Contractual Risk', N'Residual', N'Contract tracking system', N'Contract management process in place', N'Enhanced contract tracking and monitoring system', N'Moderate', N'Very likely', N'Open', @LegalOwnerId, @LegalUserId, SYSUTCDATETIME(), SYSUTCDATETIME()),

(NEWID(), @LegalDeptId, N'L009', N'Having Valid contracts in place', N'Contractual Risk', N'Residual', N'Contract validity reports', N'(a) Contract review process (b) Expiry tracking (c) Renewal reminders (d) Legal review of terms (e) Execution tracking', N'(a) Periodic contract audit (b) Automated renewal alerts (c) Standard contract templates (d) Training on contract management', N'Significant', N'Likely', N'Open', @LegalOwnerId, @LegalUserId, SYSUTCDATETIME(), SYSUTCDATETIME()),

(NEWID(), @LegalDeptId, N'L010', N'Unauthorized signing & Executing contracts', N'Contractual Risk', N'Residual', N'Authorization tracking', N'Delegation of authority framework in place', N'Strengthen authorization matrix and approval workflow', N'Severe', N'Possible', N'Open', @LegalOwnerId, @LegalUserId, SYSUTCDATETIME(), SYSUTCDATETIME()),

(NEWID(), @LegalDeptId, N'L011', N'Incorrect amount paid to vendors', N'Contractual Risk', N'Residual', N'Payment audit reports', N'Payment verification process in place', N'Enhanced payment verification and approval process', N'Moderate', N'Very likely', N'Open', @LegalOwnerId, @LegalUserId, SYSUTCDATETIME(), SYSUTCDATETIME()),

-- M&A Risk (L012)
(NEWID(), @LegalDeptId, N'L012', N'(a) Legal due diligence (b) Ensuring consistency in the terms finalized and approved during various stages of closure of transaction with the final transaction documents, to avoid any material deviations adversely impacting Kauvery (commercially & legally)', N'M&A Risk', N'Residual', N'Due diligence reports', N'M&A process and due diligence framework in place', N'(a) Comprehensive legal due diligence checklist (b) Document version control (c) Final document review process', N'Severe', N'Possible', N'Open', @LegalOwnerId, @LegalUserId, SYSUTCDATETIME(), SYSUTCDATETIME()),

-- Regulatory & Compliance risk (L013-L016)
(NEWID(), @LegalDeptId, N'L013', N'Changes in laws & regulations', N'Regulatory & Compliance risk', N'Residual', N'Regulatory change alerts', N'Regulatory monitoring process in place', N'Enhanced regulatory tracking and impact assessment process', N'Significant', N'Very likely', N'Open', @LegalOwnerId, @LegalUserId, SYSUTCDATETIME(), SYSUTCDATETIME()),

(NEWID(), @LegalDeptId, N'L014', N'Necessary reporting with MCA & other secretarial compliance', N'Regulatory & Compliance risk', N'Residual', N'Compliance calendar', N'Secretarial compliance tracking system', N'Automated compliance calendar and reminder system', N'Severe', N'Likely', N'Open', @LegalOwnerId, @LegalUserId, SYSUTCDATETIME(), SYSUTCDATETIME()),

(NEWID(), @LegalDeptId, N'L015', N'Identifying who are related parties', N'Regulatory & Compliance risk', N'Residual', N'Related party database', N'Related party identification process', N'Comprehensive related party identification and tracking system', N'Moderate', N'Very likely', N'Open', @LegalOwnerId, @LegalUserId, SYSUTCDATETIME(), SYSUTCDATETIME()),

(NEWID(), @LegalDeptId, N'L016', N'Non-compliance with Laws & Regulations for hospitals', N'Regulatory & Compliance risk', N'Residual', N'Compliance audit reports', N'Hospital compliance monitoring framework', N'Regular compliance audits and training programs', N'Severe', N'Likely', N'Open', @LegalOwnerId, @LegalUserId, SYSUTCDATETIME(), SYSUTCDATETIME()),

-- Litigation Risk (L017-L019)
(NEWID(), @LegalDeptId, N'L017', N'Complaints from patients & Medico-legal cases filed', N'Litigation Risk', N'Residual', N'Legal Notices received', N'Patient complaint handling and legal case management process', N'Enhanced patient complaint resolution and legal case tracking system', N'Severe', N'Very likely', N'Open', @LegalOwnerId, @LegalUserId, SYSUTCDATETIME(), SYSUTCDATETIME()),

(NEWID(), @LegalDeptId, N'L018', N'High-profile litigations risking the business and reputation by other stakeholders (excluding patients)', N'Litigation Risk', N'Residual', N'Notice received', N'Litigation tracking and management system', N'Proactive litigation risk assessment and management framework', N'Severe', N'Possible', N'Open', @LegalOwnerId, @LegalUserId, SYSUTCDATETIME(), SYSUTCDATETIME()),

(NEWID(), @LegalDeptId, N'L019', N'Handling of legal dispute at unit level, underestimating legal implications or liabilities', N'Litigation Risk', N'Residual', N'Unit-level dispute reports', N'Unit-level legal dispute escalation process', N'(a) Training on legal implications (b) Escalation matrix (c) Legal review requirement for disputes (d) Regular unit-level legal audits', N'Significant', N'Likely', N'Open', @LegalOwnerId, @LegalUserId, SYSUTCDATETIME(), SYSUTCDATETIME()),

-- Repository risk (L020)
(NEWID(), @LegalDeptId, N'L020', N'Risk of security of documents, proper backup or failure to retrieve', N'Repository risk', N'Residual', N'Document backup reports', N'Document management and backup system in place', N'Enhanced document security and backup procedures with regular testing', N'Significant', N'Possible', N'Open', @LegalOwnerId, @LegalUserId, SYSUTCDATETIME(), SYSUTCDATETIME()),

-- IPR Risk (L021-L022)
(NEWID(), @LegalDeptId, N'L021', N'IP infringement by third parties', N'IPR Risk', N'Inherent', N'IP monitoring alerts', N'IP monitoring and protection process', N'Proactive IP monitoring and enforcement strategy', N'Moderate', N'Possible', N'Open', @LegalOwnerId, @LegalUserId, SYSUTCDATETIME(), SYSUTCDATETIME()),

(NEWID(), @LegalDeptId, N'L022', N'IP renewal or expiry', N'IPR Risk', N'Residual', N'IP expiry calendar', N'IP renewal tracking system', N'Automated IP renewal calendar and reminder system', N'Moderate', N'Likely', N'Open', @LegalOwnerId, @LegalUserId, SYSUTCDATETIME(), SYSUTCDATETIME()),

-- Reputation & Legal Risk (L023)
(NEWID(), @LegalDeptId, N'L023', N'Delayed reporting or no reporting of incidents which may cause media/ police attention', N'Reputation & Legal Risk', N'Inherent', N'Incident reporting dashboard', N'Incident reporting framework and escalation process', N'(a) Mandatory incident reporting within specified timeframe (b) Media management protocol (c) Regular incident reporting training (d) Incident tracking system', N'Severe', N'Possible', N'Open', @LegalOwnerId, @LegalUserId, SYSUTCDATETIME(), SYSUTCDATETIME());

PRINT 'Successfully inserted 23 Legal Risks (L001-L023)';

-- Verify insertion
SELECT COUNT(*) AS TotalRisks, DepartmentId FROM dbo.Risks WHERE DepartmentId = @LegalDeptId GROUP BY DepartmentId;

