-- Add ID card type + number to family_members
IF COL_LENGTH(N'dbo.family_members', N'id_card_type') IS NULL
BEGIN
    ALTER TABLE dbo.family_members ADD id_card_type NVARCHAR(30) NULL;
END
GO

IF COL_LENGTH(N'dbo.family_members', N'id_card_number') IS NULL
BEGIN
    ALTER TABLE dbo.family_members ADD id_card_number NVARCHAR(50) NULL;
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = N'CK_family_members_id_card_type'
      AND parent_object_id = OBJECT_ID(N'dbo.family_members')
)
BEGIN
    ALTER TABLE dbo.family_members
      ADD CONSTRAINT CK_family_members_id_card_type
      CHECK (
        id_card_type IS NULL
        OR id_card_type IN (N'aadhaar', N'pan', N'epic', N'dl', N'ration_card')
      );
END
GO
