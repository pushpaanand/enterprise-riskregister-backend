-- Add Email column to dbo.Users if not exists and create (optional) unique index
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Users') AND name = 'Email')
BEGIN
  ALTER TABLE dbo.Users ADD Email NVARCHAR(256) NULL;
END

-- Optional: create a non-unique index for faster lookup (skip if you want unique constraint instead)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Users_Email' AND object_id = OBJECT_ID('dbo.Users'))
BEGIN
  CREATE INDEX IX_Users_Email ON dbo.Users(Email);
END

PRINT 'dbo.Users altered: Email column ensured.';


