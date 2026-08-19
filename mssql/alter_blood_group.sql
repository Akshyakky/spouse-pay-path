-- Add blood_group to family_members (run each batch separately in SSMS)
IF COL_LENGTH(N'dbo.family_members', N'blood_group') IS NULL
BEGIN
    ALTER TABLE dbo.family_members
      ADD blood_group NVARCHAR(10) NULL;
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = N'CK_family_members_blood_group'
      AND parent_object_id = OBJECT_ID(N'dbo.family_members')
)
BEGIN
    ALTER TABLE dbo.family_members
      ADD CONSTRAINT CK_family_members_blood_group
      CHECK (
        blood_group IS NULL
        OR blood_group IN (N'A+', N'A-', N'B+', N'B-', N'AB+', N'AB-', N'O+', N'O-')
      );
END
GO
