-- INSERT script for Branding Risks (B001-B022) from Risk Register
-- This script will create/use Branding department and insert all 22 branding risks
--
-- NOTE: The ExistingControlInPlace and PlanOfAction fields contain detailed multi-point descriptions.

SET NOCOUNT ON;

-- Declare variables
DECLARE @BrandingDeptId UNIQUEIDENTIFIER;
DECLARE @BrandingOwnerId UNIQUEIDENTIFIER;
DECLARE @BrandingUserId UNIQUEIDENTIFIER = '6f36f7b5-a013-4070-8d8f-1d7aa5d33900'; -- Provided user ID

-- Get or create Branding department
SELECT TOP 1 @BrandingDeptId = DepartmentId FROM dbo.Departments WHERE Name = N'Branding';
IF @BrandingDeptId IS NULL
BEGIN
    SET @BrandingDeptId = NEWID();
    INSERT INTO dbo.Departments (DepartmentId, Name) VALUES (@BrandingDeptId, N'Branding');
    PRINT 'Created Branding department';
END
ELSE
BEGIN
    PRINT 'Using existing Branding department';
END

-- Get or create a Branding Owner
SELECT TOP 1 @BrandingOwnerId = OwnerId FROM dbo.Owners WHERE DepartmentId = @BrandingDeptId;
IF @BrandingOwnerId IS NULL
BEGIN
    SET @BrandingOwnerId = NEWID();
    INSERT INTO dbo.Owners (OwnerId, Name, DepartmentId) VALUES (@BrandingOwnerId, N'Branding Department Owner', @BrandingDeptId);
    PRINT 'Created Branding Owner';
END
ELSE
BEGIN
    PRINT 'Using existing Branding Owner';
END

-- Verify the provided user exists
IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE UserId = @BrandingUserId)
BEGIN
    PRINT 'WARNING: User with ID 6f36f7b5-a013-4070-8d8f-1d7aa5d33900 does not exist. Please create the user first.';
    PRINT 'Creating a placeholder user for this script...';
    INSERT INTO dbo.Users (UserId, Name, Role, DepartmentId) VALUES (@BrandingUserId, N'Branding User', N'user', @BrandingDeptId);
    PRINT 'Created placeholder Branding User';
END
ELSE
BEGIN
    PRINT 'Using existing user for CreatedByUserId';
END

-- Insert all 22 Branding Risks
INSERT INTO dbo.Risks (RiskId, DepartmentId, RiskNo, Description, CategoryId, Identification, RiskIndicator, ExistingControlInPlace, PlanOfAction, Impact, Likelihood, Status, OwnerId, CreatedByUserId, CreatedAtUtc, UpdatedAtUtc)
VALUES
-- Risk B001
(NEWID(), @BrandingDeptId, N'B001', N'Negative or misleading comments on social media platforms may escalate into a public relations issue,', N'Reputational/Operational', NULL, N'Through regular monitoring of social media platforms, patient feedback, and public responses to posts and campaigns.', N'Manual monitoring by the social media manager, followed by email escalation to the respective unit heads to verify the issue and coordinate resolution with reviewers.', N'', N'Severe', N'Unlikely', N'Existing', @BrandingOwnerId, @BrandingUserId, SYSUTCDATETIME(), SYSUTCDATETIME()),

-- Risk B002
(NEWID(), @BrandingDeptId, N'B002', N'Errors by vendors such as printing mistakes, colour mismatches, or delayed delivery of branding materials', N'Operational', NULL, N'Identified during vendor coordination, proof approvals, production stages, and delivery timelines.', N'1. Approved vendor list
2. Clear timelines shared with vendors
3. Follow-ups by Branding team
4. Standard event-production guidelines', N'1. Periodic vendor performance evaluation based on quality and delivery timelines
2. Conduct regular reviews and audits of vendor deliverables', N'Significant', N'Likely', N'Existing', @BrandingOwnerId, @BrandingUserId, SYSUTCDATETIME(), SYSUTCDATETIME()),

-- Risk B003
(NEWID(), @BrandingDeptId, N'B003', N'Fire hazards, physical accidents, injuries, or unforeseen incidents during branding events or promotional activations', N'Operational', NULL, N'Identified during planning and execution of branding events, site visits, and on-ground activations.', N'1. Basic safety checks at event venues
2. Coordination with event vendors and venue teams
3. Supervision by Branding team during events
4. Conduct fire safety assessments at event venues prior to activation
5. Availability of fire extinguishers and emergency exits at event locations', N'1. Implement a pre-event safety checklist
2. Ensure electrical and basic structural safety checks at the venue
3. Arrange on-site first aid support and display emergency contact details
4. Coordinate with hospital safety officers before and during events', N'Severe', N'Very Unlikely', N'Existing', @BrandingOwnerId, @BrandingUserId, SYSUTCDATETIME(), SYSUTCDATETIME()),

-- Risk B004
(NEWID(), @BrandingDeptId, N'B004', N'Unverified or negative media coverage across online forums, websites, or during live interactions.', N'Reputational', NULL, N'Identified through media monitoring, social listening tools, online forums, news mentions, and feedback from on-ground interactions or events.', N'1. Regular monitoring through social listening tools.
2. Media coverage tracking and review.
3. Coordination with PR and Communications teams.
4. Specific SPOCs for media responses.', N'1. Establish a crisis communication SOP.
2. Set up a rapid internal verification process.
3. Follow a structured media response protocol for timely communication.', N'Severe', N'Unlikely', N'Existing', @BrandingOwnerId, @BrandingUserId, SYSUTCDATETIME(), SYSUTCDATETIME()),

-- Risk B005
(NEWID(), @BrandingDeptId, N'B005', N'Multiple rounds of discussions and approvals between internal units and the corporate office may delay branding decisions and affect campaign timelines.', N'Operational', NULL, N'Identified through delayed approvals, repeated clarifications, and extended coordination during branding initiatives.', N'1. Defined approval hierarchy for branding activities.
2. Regular coordination calls and follow-ups.
3. Use of standard forms along with emails for documentation and approvals.
4. Mediation and decision support by Branding Head, when required.', N'1. Establish unified communication protocols across units.
2. Define a clear approval workflow for branding activities.
3. Conduct periodic inter-unit review meetings to align objectives and resolve issues early.', N'Moderate', N'Possible', N'Existing', @BrandingOwnerId, @BrandingUserId, SYSUTCDATETIME(), SYSUTCDATETIME()),

-- Risk B006
(NEWID(), @BrandingDeptId, N'B006', N'Deviation from approved brand tone or ethical guidelines in branding communication.', N'Operational/Compliance', NULL, N'Identified through internal reviews and monitoring of published branding content.', N'1. Approved Brand Guidelines book containing all branding and ethical standards.
2. Multi-level content review and approval process.
3. Internal feedback and correction mechanism for any deviations.', N'1. Reinforce adherence to approved brand and ethical guidelines.
2. Conduct periodic reviews of branding content.
3. Correct deviations promptly and document learnings.', N'Minor', N'Possible', N'Existing', @BrandingOwnerId, @BrandingUserId, SYSUTCDATETIME(), SYSUTCDATETIME()),

-- Risk B007
(NEWID(), @BrandingDeptId, N'B007', N'Campaign or project timelines may be delayed due to late approvals.', N'Operational', NULL, N'Identified through monitoring approval timelines and tracking delays in decision-making required to initiate a project or campaign.', N'Follow-up through email reminders and escalation if approvals are delayed.', N'1. Use project tracker sheets to monitor approval timelines and progress.
2. Set and communicate fixed approval deadlines.
3. Regularly review project status to ensure timely approvals.', N'Minor', N'Possible', N'Existing', @BrandingOwnerId, @BrandingUserId, SYSUTCDATETIME(), SYSUTCDATETIME()),

-- Risk B008
(NEWID(), @BrandingDeptId, N'B008', N'Using copyrighted or unlicensed materials, such as images, videos, music, or graphics, in branding campaigns.', N'Operational/Compliance', NULL, N'Identified through internal content review, licensing checks, and validation of assets used in campaigns.', N'1. Use of licensed stock image/video services.
2. Maintain a list of approved sources for multimedia materials.
3. Regular checks and audits to ensure proper licensing.', N'1. Ensure all materials are sourced from licensed providers or internally created.
2. Keep a database of approved assets with licensing information.
3. Conduct regular audits to verify the licensing of content used in campaigns.
4. Provide training to the team on copyright and licensing laws.', N'Significant', N'Likely', N'Existing', @BrandingOwnerId, @BrandingUserId, SYSUTCDATETIME(), SYSUTCDATETIME()),

-- Risk B009
(NEWID(), @BrandingDeptId, N'B009', N'Unauthorized use of patient images, stories, or testimonials in branding materials without proper consent or approvals', N'Reputational/Compliance', NULL, N'Identified through content review processes', N'1. Ensure all content used in campaigns complies with brand guidelines
2. Maintain a database of consented content
3. Use of licensed and original content for all branding materials', N'1. Enforce the use of Google Forms for all content approvals and submissions
2. Maintain centralized approval sheets to track and document all content-related approvals
3. Ensure adherence to overall digital branding guidelines for all online and digital campaigns', N'Significant', N'Possible', N'Existing', @BrandingOwnerId, @BrandingUserId, SYSUTCDATETIME(), SYSUTCDATETIME()),

-- Risk B010
(NEWID(), @BrandingDeptId, N'B010', N'Non-licensed music played during events, along with plagiarism or imitation in creative assets', N'Reputational/Compliance', NULL, N'Identified through content review, event planning checks, and audits to ensure all materials used (including music) are licensed or authorized for use.', N'1. Manual review of creative concepts before approval, vetted by 3-4 team heads
2. Maintain documentation of content creation process, including sources and licenses
3. Contracts with event vendors to ensure compliance with music licensing regulations
4. Documentation of music licenses and permissions before any public use', N'1. Enforce originality declarations from agencies
2. Use plagiarism detection tools for written and visual content before publication
3. Conduct periodic creative audits to ensure content originality and adherence to brand guidelines
4. Ensure all vendors and third-party agencies are aware of licensing requirements
5. Set up a process to verify music licenses before event execution', N'Significant', N'Possible', N'Existing', @BrandingOwnerId, @BrandingUserId, SYSUTCDATETIME(), SYSUTCDATETIME()),

-- Risk B011
(NEWID(), @BrandingDeptId, N'B011', N'Incorrect or unverified doctor and medical details on the hospital website', N'Reputational/Compliance', NULL, N'Identified through regular website reviews, verification of doctor credentials, and audits of medical information published on the site.', N'1. Website change requests captured through Google Forms
2. Each submission reviewed by Digital team and Unit SPOCS
3. Approval from respective doctors and Medical Admin (included in CC) before content upload', N'1. Establish a formal data verification checklist for all doctor and medical details on the website
2. Conduct quarterly content audits with Medical Admin to ensure the accuracy of published information', N'Minor', N'Very likely', N'Existing', @BrandingOwnerId, @BrandingUserId, SYSUTCDATETIME(), SYSUTCDATETIME()),

-- Risk B012
(NEWID(), @BrandingDeptId, N'B012', N'Unclear or incomplete contract terms with vendors may lead to disputes, accountability gaps, and delays in deliverables', N'Operational', NULL, N'Identified through vendor performance issues, contract disputes, and feedback from both vendors and internal teams regarding clarity.', N'Standard PO and quotation + agreement-based approvals through Volody app', N'', N'Minor', N'Unlikely', N'Existing', @BrandingOwnerId, @BrandingUserId, SYSUTCDATETIME(), SYSUTCDATETIME()),

-- Risk B013
(NEWID(), @BrandingDeptId, N'B013', N'Delays in vendor payments', N'Operational', NULL, N'Identified through feedback from vendors & monitoring payment schedules.', N'1. Established payment terms in contracts with vendors
2. Regular tracking of payment schedules and vendor invoices
3. Coordination between finance teams to ensure timely payments', N'Implement the work order process through the HMS Portal to ensure timely vendor payments', N'Significant', N'Likely', N'Existing', @BrandingOwnerId, @BrandingUserId, SYSUTCDATETIME(), SYSUTCDATETIME()),

-- Risk B014
(NEWID(), @BrandingDeptId, N'B014', N'Vendor reliability and quality issues may lead to rework, delays in project timelines, and additional costs.', N'Operational/Compliance', NULL, N'Identified through performance reviews, feedback from internal teams, and vendor delivery audits.', N'1. Clear vendor selection criteria and approved vendor list
2. Established quality checks at different stages of production or delivery
3. Regular communication and follow-up with vendors to address any issues', N'1. Create and maintain an approved vendor database with performance ratings
2. Define a quality assurance checklist to ensure vendors meet required standards
3. Conduct quarterly performance reviews to assess vendor reliability and quality
4. Implement a formal process for addressing vendor performance issues and resolving them promptly', N'Minor', N'Possible', N'Existing', @BrandingOwnerId, @BrandingUserId, SYSUTCDATETIME(), SYSUTCDATETIME()),

-- Risk B015
(NEWID(), @BrandingDeptId, N'B015', N'Ad-hoc requests that deviate from approved brand SOPs', N'Operational/Compliance', NULL, N'Identified through irregular requests, deviations from established SOPs, and feedback from internal teams regarding non-standard requests.', N'1. Brand guidelines for all branding activities
2. Defined approval workflow for any new requests or deviations from SOPs', N'1. Enforce adherence to approved brand SOPs for all brand-related requests
2. Implement a formal process for reviewing and approving ad-hoc requests', N'Minor', N'Likely', N'Existing', @BrandingOwnerId, @BrandingUserId, SYSUTCDATETIME(), SYSUTCDATETIME()),

-- Risk B016
(NEWID(), @BrandingDeptId, N'B016', N'Budget overruns on campaigns due to unplanned requirements or scope changes', N'Operational/Financial', NULL, N'Identified through tracking of campaign expenses, scope changes reported by project managers, and budget variance analysis.', N'1. Clear scope definition and approval at the start of each campaign
2. Regular monitoring of campaign budgets and expenditure
3. Approval process for any scope changes or additional requirements
4. Communication of budget constraints to all teams involved in campaign planning and execution', N'1. Introduce pre-approved contingency budgets for unexpected scope changes
2. Maintain a cost tracker to monitor campaign expenses in real-time
3. Obtain email or form-based approval for any scope expansion or additional costs', N'Significant', N'Possible', N'Existing', @BrandingOwnerId, @BrandingUserId, SYSUTCDATETIME(), SYSUTCDATETIME()),

-- Risk B017
(NEWID(), @BrandingDeptId, N'B017', N'Digital system failures or data loss affecting creative assets and timelines', N'Operational/Security', NULL, N'Identified through system monitoring, incident reports, and feedback from the IT department regarding technical failures or data issues.', N'Use of cloud-based storage solutions for easy access and recovery of assets', N'1. Regular website and platform security audits
2. Use of secure passwords and multi-factor authentication (MFA) for all platform accounts
3. Implementation of website security protocols such as HTTPS and firewalls
4. Regular updates and patches for all platform software', N'Severe', N'Very Unlikely', N'Existing', @BrandingOwnerId, @BrandingUserId, SYSUTCDATETIME(), SYSUTCDATETIME()),

-- Risk B018
(NEWID(), @BrandingDeptId, N'B018', N'A website, Meta platform, or Google platform hack may result in unauthorized access, data breaches due to compromised online security.', N'Security', NULL, N'Identified through security monitoring, vulnerability scans, reports from external security audits, and alerts from the platforms.', N'', N'1. Conduct monthly security audits of the website, Meta, and Google platforms to identify vulnerabilities
2. Implement regular password and access management reviews, with MFA for critical accounts
3. Establish an emergency response plan with IT and security teams in case of a breach', N'Severe', N'Very Unlikely', N'Existing', @BrandingOwnerId, @BrandingUserId, SYSUTCDATETIME(), SYSUTCDATETIME()),

-- Risk B019
(NEWID(), @BrandingDeptId, N'B019', N'Any deviation from the approved Brand Book may lead to inconsistent brand messaging, misalignment with core values', N'Operational/Reputational', NULL, N'Identified through content reviews, feedback from internal teams, and audits of branding materials.', N'1. Clear and approved Brand Book that defines brand guidelines and usage rules
2. Centralized review process to ensure all materials adhere to the Brand Book
3. Regular communication with internal teams and vendors about brand standards', N'Perform regular audits to identify any deviations and address them immediately', N'Severe', N'Unlikely', N'Existing', @BrandingOwnerId, @BrandingUserId, SYSUTCDATETIME(), SYSUTCDATETIME()),

-- Risk B020
(NEWID(), @BrandingDeptId, N'B020', N'Employees contributing to or engaging in controversial topics, either publicly or on social media', N'Reputational', NULL, N'Identified through monitoring of social media platforms & internal feedback', N'1. Clear social media guidelines for all employees, outlining acceptable conduct and public statements
2. Regular training on professional conduct, especially in online forums and social media
3. Immediate escalation and resolution process for any controversial statements made by employees', N'1. Create an SOP for employee conduct on controversial topics
2. Train employees on strict policies regarding public statements, social media conduct, and alignment with company values', N'Significant', N'Unlikely', N'Existing', @BrandingOwnerId, @BrandingUserId, SYSUTCDATETIME(), SYSUTCDATETIME()),

-- Risk B021
(NEWID(), @BrandingDeptId, N'B021', N'A doctor giving incorrect or misleading information during a press meet', N'Reputational/Compliance', NULL, N'Identified through media monitoring, feedback from press and attendees, and post-event review of statements made by doctors during press interactions.', N'1. Pre-briefing of doctors and spokespeople before press meets to ensure accurate and consistent messaging
2. Approval process for key talking points and statements shared by doctors in public forums
3. Coordination with the PR team to verify information before it is communicated to the press
4. Clear guidelines on handling sensitive or complex information in the media', N'1. Create a press interaction SOP for doctors to ensure all information provided is accurate and vetted before any public statement
2. Ensure PR team involvement in all press meetings to review and approve key messages
3. Set up a post-event review process to identify and correct any inaccuracies promptly, and address any media concerns', N'Significant', N'Unlikely', N'Existing', @BrandingOwnerId, @BrandingUserId, SYSUTCDATETIME(), SYSUTCDATETIME()),

-- Risk B022
(NEWID(), @BrandingDeptId, N'B022', N'Incorrect or misleading information in a press release', N'Reputational/Compliance', NULL, N'Identified through media monitoring and post-release reviews that highlight inaccuracies or miscommunications in the press release.', N'1. Approval process for all press releases by the Unit Head and Medical Admin to ensure accuracy and alignment with hospital policies
2. Fact-checking procedures in collaboration with subject matter experts (SMEs) to verify all information before release
3. Use of templates and standardized formats to maintain consistency and accuracy in press releases', N'1. Implement a standardized review process for press releases involving cross-departmental checks for accuracy
2. Set up a post-release review process to quickly identify and correct any inaccuracies and issue clarifications if necessary', N'Significant', N'Unlikely', N'Existing', @BrandingOwnerId, @BrandingUserId, SYSUTCDATETIME(), SYSUTCDATETIME());

PRINT 'Successfully inserted 22 Branding Risks (B001-B022)';

-- Verify insertion
SELECT COUNT(*) AS TotalRisks, DepartmentId FROM dbo.Risks WHERE DepartmentId = @BrandingDeptId GROUP BY DepartmentId;

-- Display inserted risks
SELECT RiskNo, Description, Impact, Likelihood, Status FROM dbo.Risks WHERE DepartmentId = @BrandingDeptId ORDER BY RiskNo;

