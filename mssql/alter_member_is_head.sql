/* Add head-of-family flag on family_members (idempotent). */
IF COL_LENGTH(N'dbo.family_members', N'is_head') IS NULL
BEGIN
  ALTER TABLE dbo.family_members
    ADD is_head BIT NOT NULL
      CONSTRAINT DF_family_members_is_head DEFAULT (0);
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'UQ_family_members_one_head'
    AND object_id = OBJECT_ID(N'dbo.family_members')
)
BEGIN
  CREATE UNIQUE INDEX UQ_family_members_one_head
    ON dbo.family_members (family_id)
    WHERE is_head = 1;
END
GO

/* Backfill: prefer husband, else wife, else earliest member */
;WITH ranked AS (
  SELECT
    id,
    family_id,
    ROW_NUMBER() OVER (
      PARTITION BY family_id
      ORDER BY
        CASE relationship
          WHEN N'husband' THEN 1
          WHEN N'wife' THEN 2
          ELSE 3
        END,
        created_at
    ) AS rn
  FROM dbo.family_members
  WHERE family_id NOT IN (
    SELECT family_id FROM dbo.family_members WHERE is_head = 1
  )
)
UPDATE m
SET m.is_head = 1
FROM dbo.family_members m
INNER JOIN ranked r ON r.id = m.id
WHERE r.rn = 1;
GO
