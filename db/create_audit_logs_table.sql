-- Create AuditLogs table to track all INSERT, UPDATE, and DELETE operations
-- This table will store comprehensive audit trail for all data changes

SET NOCOUNT ON;

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'dbo.AuditLogs') AND type in (N'U'))
BEGIN
    CREATE TABLE dbo.AuditLogs (
        AuditLogId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
        TableName NVARCHAR(100) NOT NULL, -- e.g., 'Risks', 'Users', 'Incidents'
        RecordId UNIQUEIDENTIFIER NOT NULL, -- ID of the record that was changed
        Operation NVARCHAR(20) NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
        FieldName NVARCHAR(100) NULL, -- Field that was changed (for UPDATE operations)
        OldValue NVARCHAR(MAX) NULL, -- Previous value (for UPDATE/DELETE)
        NewValue NVARCHAR(MAX) NULL, -- New value (for INSERT/UPDATE)
        ChangedByUserId UNIQUEIDENTIFIER NULL, -- User who made the change
        ChangedByUserName NVARCHAR(200) NULL, -- User name (denormalized for quick access)
        ChangedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        IPAddress NVARCHAR(50) NULL, -- IP address of the user
        UserAgent NVARCHAR(500) NULL, -- Browser/client information
        AdditionalInfo NVARCHAR(MAX) NULL -- JSON or additional context
    );

    -- Create index for faster queries
    CREATE INDEX IX_AuditLogs_TableName_RecordId ON dbo.AuditLogs(TableName, RecordId);
    CREATE INDEX IX_AuditLogs_ChangedAtUtc ON dbo.AuditLogs(ChangedAtUtc DESC);
    CREATE INDEX IX_AuditLogs_ChangedByUserId ON dbo.AuditLogs(ChangedByUserId);
    CREATE INDEX IX_AuditLogs_Operation ON dbo.AuditLogs(Operation);

    PRINT 'AuditLogs table created successfully.';
END
ELSE
BEGIN
    PRINT 'AuditLogs table already exists.';
END

PRINT 'Audit logs table setup completed.';

