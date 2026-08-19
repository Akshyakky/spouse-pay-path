-- Add address to family_members
IF COL_LENGTH(N'dbo.family_members', N'address') IS NULL
BEGIN
    ALTER TABLE dbo.family_members ADD address NVARCHAR(500) NULL;
END
GO
