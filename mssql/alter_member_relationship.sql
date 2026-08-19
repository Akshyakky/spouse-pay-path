/* Expand family_members.relationship for later generations (idempotent). */
IF COL_LENGTH(N'dbo.family_members', N'relationship') IS NOT NULL
  AND COL_LENGTH(N'dbo.family_members', N'relationship') < 40
BEGIN
  ALTER TABLE dbo.family_members
    ALTER COLUMN relationship NVARCHAR(40) NOT NULL;
END
GO

IF EXISTS (
  SELECT 1 FROM sys.check_constraints
  WHERE name = N'CK_family_members_relationship'
    AND parent_object_id = OBJECT_ID(N'dbo.family_members')
)
BEGIN
  ALTER TABLE dbo.family_members
    DROP CONSTRAINT CK_family_members_relationship;
END
GO

ALTER TABLE dbo.family_members
  ADD CONSTRAINT CK_family_members_relationship
  CHECK (
    relationship IN (
      N'wife', N'husband',
      N'daughter', N'son',
      N'daughter_in_law', N'son_in_law',
      N'granddaughter', N'grandson',
      N'great_granddaughter', N'great_grandson',
      N'other'
    )
  );
GO
