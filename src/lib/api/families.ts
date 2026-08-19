import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth, requireAdmin } from "@/integrations/mssql/auth-middleware";
import { FAMILY_EMAIL_DOMAIN } from "@/lib/auth-utils";
import { MEMBER_RELATIONSHIP_VALUES } from "@/lib/relationships";
import type { MemberRow } from "@/lib/api/mappers";

export type { MemberRow };

const usernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(40)
  .regex(/^[a-zA-Z0-9._-]+$/, "Username may only contain letters, numbers, dot, dash, underscore");

const passwordSchema = z.string().min(8).max(72);

export const listFamilies = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const { query } = await import("@/lib/db");
    const { mapFamily } = await import("@/lib/api/mappers");
    const rows = await query(
      `SELECT f.id, f.family_no, f.family_name, f.address, f.contact_phone, f.contact_email,
              f.family_photo_url, f.wife_user_id, f.created_by, f.created_at, f.updated_at,
              h.full_name AS head_of_family,
              (SELECT COUNT(*) FROM dbo.family_members m WHERE m.family_id = f.id) AS member_count,
              (SELECT COUNT(*) FROM dbo.family_members m WHERE m.family_id = f.id AND m.gender = N'Male') AS male_count,
              (SELECT COUNT(*) FROM dbo.family_members m WHERE m.family_id = f.id AND m.gender = N'Female') AS female_count
       FROM dbo.families f
       LEFT JOIN dbo.family_members h ON h.family_id = f.id AND h.is_head = 1
       ORDER BY f.family_no`,
    );
    return rows.map(mapFamily);
  });

export const listFamiliesLite = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const { query } = await import("@/lib/db");
    const rows = await query<{ id: string; family_no: string; family_name: string }>(
      `SELECT id, family_no, family_name FROM dbo.families ORDER BY family_no`,
    );
    return rows.map((r) => ({
      id: String(r.id),
      family_no: r.family_no,
      family_name: r.family_name,
    }));
  });

export const getFamilyById = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { assertCanAccessFamily } = await import("@/lib/api/access");
    const { queryOne } = await import("@/lib/db");
    const { mapFamily } = await import("@/lib/api/mappers");
    await assertCanAccessFamily(context.userId, context.isAdmin, data.id);
    const row = await queryOne(
      `SELECT f.id, f.family_no, f.family_name, f.address, f.contact_phone, f.contact_email,
              f.family_photo_url, f.wife_user_id, f.created_by, f.created_at, f.updated_at,
              h.full_name AS head_of_family,
              (SELECT COUNT(*) FROM dbo.family_members m WHERE m.family_id = f.id) AS member_count,
              (SELECT COUNT(*) FROM dbo.family_members m WHERE m.family_id = f.id AND m.gender = N'Male') AS male_count,
              (SELECT COUNT(*) FROM dbo.family_members m WHERE m.family_id = f.id AND m.gender = N'Female') AS female_count
       FROM dbo.families f
       LEFT JOIN dbo.family_members h ON h.family_id = f.id AND h.is_head = 1
       WHERE f.id = @id`,
      { id: data.id },
    );
    if (!row) throw new Error("Family not found");
    return mapFamily(row);
  });

const familyNoSchema = z
  .string()
  .trim()
  .min(2, "Family ID is required")
  .max(20)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, "Family ID may use letters, numbers, dot, dash, underscore")
  .transform((v) => v.toUpperCase());

/** Suggest the next unused FAM-#### id (does not consume the SQL sequence). */
export const getNextFamilyNo = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const { query } = await import("@/lib/db");
    const rows = await query<{ family_no: string }>(`SELECT family_no FROM dbo.families`);
    const used = new Set(rows.map((r) => r.family_no.toUpperCase()));

    let maxNum = 0;
    for (const no of used) {
      const m = /^FAM-(\d+)$/.exec(no);
      if (m) maxNum = Math.max(maxNum, Number(m[1]));
    }

    let n = maxNum + 1;
    let candidate = `FAM-${String(n).padStart(4, "0")}`;
    while (used.has(candidate)) {
      n += 1;
      candidate = `FAM-${String(n).padStart(4, "0")}`;
    }
    return { familyNo: candidate };
  });

export const createFamilyWithLogin = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((input: unknown) =>
    z
      .object({
        family_no: familyNoSchema,
        family_name: z.string().trim().min(2).max(200),
        username: usernameSchema,
        password: passwordSchema,
        address: z.string().trim().max(500).optional().nullable(),
        contact_phone: z.string().trim().max(50).optional().nullable(),
        contact_email: z.string().trim().max(320).optional().nullable(),
        family_photo_url: z.string().trim().max(1000).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { queryOne, execute } = await import("@/lib/db");
    const { createUserRecord } = await import("@/lib/api/users");

    const username = data.username.toLowerCase();
    const email = `${username}@${FAMILY_EMAIL_DOMAIN}`;
    const familyNo = data.family_no;

    const taken = await queryOne<{ id: string }>(
      `SELECT id FROM dbo.families WHERE UPPER(family_no) = @familyNo`,
      { familyNo },
    );
    if (taken) throw new Error(`Family ID ${familyNo} is already in use`);

    let family: { id: string; family_no: string } | null;
    try {
      family = await queryOne<{ id: string; family_no: string }>(
        `INSERT INTO dbo.families
           (family_no, family_name, address, contact_phone, contact_email, family_photo_url, created_by)
         OUTPUT INSERTED.id, INSERTED.family_no
         VALUES (@familyNo, @familyName, @address, @phone, @email, @photo, @createdBy)`,
        {
          familyNo,
          familyName: data.family_name,
          address: data.address || null,
          phone: data.contact_phone || null,
          email: data.contact_email || null,
          photo: data.family_photo_url || null,
          createdBy: context.userId,
        },
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/unique|duplicate|UQ_families_family_no/i.test(msg)) {
        throw new Error(`Family ID ${familyNo} is already in use`);
      }
      throw e;
    }
    if (!family?.id) throw new Error("Could not create family");

    try {
      const userId = await createUserRecord({
        email,
        username,
        fullName: data.family_name,
        password: data.password,
        appRole: "family",
      });

      await execute(`UPDATE dbo.families SET wife_user_id = @userId WHERE id = @familyId`, {
        userId,
        familyId: family.id,
      });

      // Members (including head) are added later from the family editor

      return {
        familyId: String(family.id),
        familyNo: family.family_no,
        username,
        password: data.password,
      };
    } catch (e) {
      await execute(`DELETE FROM dbo.families WHERE id = @id`, { id: family.id });
      throw e;
    }
  });

export const updateFamily = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        family_no: familyNoSchema.optional().nullable(),
        family_name: z.string().trim().min(2).max(200),
        address: z.string().trim().max(500).optional().nullable(),
        contact_phone: z.string().trim().max(50).optional().nullable(),
        contact_email: z.string().trim().max(320).optional().nullable(),
        family_photo_url: z.string().trim().max(1000).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { assertCanAccessFamily } = await import("@/lib/api/access");
    const { execute, queryOne } = await import("@/lib/db");
    await assertCanAccessFamily(context.userId, context.isAdmin, data.id);

    const familyNo = data.family_no?.trim().toUpperCase() || null;
    if (familyNo && context.isAdmin) {
      const taken = await queryOne<{ id: string }>(
        `SELECT id FROM dbo.families WHERE UPPER(family_no) = @familyNo AND id <> @id`,
        { familyNo, id: data.id },
      );
      if (taken) throw new Error(`Family ID ${familyNo} is already in use`);
    }

    if (familyNo && context.isAdmin) {
      await execute(
        `UPDATE dbo.families
         SET family_no = @familyNo,
             family_name = @familyName,
             address = @address,
             contact_phone = @phone,
             contact_email = @email,
             family_photo_url = @photo
         WHERE id = @id`,
        {
          id: data.id,
          familyNo,
          familyName: data.family_name,
          address: data.address || null,
          phone: data.contact_phone || null,
          email: data.contact_email || null,
          photo: data.family_photo_url || null,
        },
      );
    } else {
      await execute(
        `UPDATE dbo.families
         SET family_name = @familyName,
             address = @address,
             contact_phone = @phone,
             contact_email = @email,
             family_photo_url = @photo
         WHERE id = @id`,
        {
          id: data.id,
          familyName: data.family_name,
          address: data.address || null,
          phone: data.contact_phone || null,
          email: data.contact_email || null,
          photo: data.family_photo_url || null,
        },
      );
    }
    return { ok: true };
  });

export const listFamilyMembers = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => z.object({ familyId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { assertCanAccessFamily } = await import("@/lib/api/access");
    const { query } = await import("@/lib/db");
    const { mapMember } = await import("@/lib/api/mappers");
    await assertCanAccessFamily(context.userId, context.isAdmin, data.familyId);
    const rows = await query(
      `SELECT id, family_id, relationship, full_name, gender, date_of_birth, blood_group,
              contact, address, photo_url, remarks, id_card_type, id_card_number, is_head
       FROM dbo.family_members
       WHERE family_id = @familyId
       ORDER BY CASE WHEN is_head = 1 THEN 0 ELSE 1 END, created_at`,
      { familyId: data.familyId },
    );
    return rows.map(mapMember);
  });

const memberPayload = z.object({
  family_id: z.string().uuid(),
  relationship: z.enum(MEMBER_RELATIONSHIP_VALUES),
  full_name: z.string().trim().min(2).max(200),
  gender: z.enum(["Male", "Female", "Other"]),
  id_card_type: z.enum(["aadhaar", "pan", "epic", "dl", "ration_card"]),
  id_card_number: z.string().trim().min(3).max(50),
  date_of_birth: z.string().trim().max(20).optional().nullable(),
  blood_group: z
    .enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"])
    .optional()
    .nullable(),
  contact: z.string().trim().max(100).optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
  remarks: z.string().trim().max(1000).optional().nullable(),
  photo_url: z.string().trim().max(1000).optional().nullable(),
});

export const upsertFamilyMember = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => memberPayload.extend({ id: z.string().uuid().optional() }).parse(input))
  .handler(async ({ data, context }) => {
    const { assertCanAccessFamily } = await import("@/lib/api/access");
    const { execute } = await import("@/lib/db");
    await assertCanAccessFamily(context.userId, context.isAdmin, data.family_id);
    const dob = data.date_of_birth || null;
    const bloodGroup = data.blood_group || null;
    if (data.id) {
      await execute(
        `UPDATE dbo.family_members
         SET relationship = @relationship,
             full_name = @fullName,
             gender = @gender,
             date_of_birth = @dob,
             blood_group = @bloodGroup,
             contact = @contact,
             address = @address,
             remarks = @remarks,
             photo_url = @photo,
             id_card_type = @idCardType,
             id_card_number = @idCardNumber
         WHERE id = @id AND family_id = @familyId`,
        {
          id: data.id,
          familyId: data.family_id,
          relationship: data.relationship,
          fullName: data.full_name,
          gender: data.gender,
          dob,
          bloodGroup,
          contact: data.contact || null,
          address: data.address || null,
          remarks: data.remarks || null,
          photo: data.photo_url || null,
          idCardType: data.id_card_type,
          idCardNumber: data.id_card_number,
        },
      );
    } else {
      await execute(
        `INSERT INTO dbo.family_members
           (family_id, relationship, full_name, gender, date_of_birth, blood_group, contact, address, remarks, photo_url, id_card_type, id_card_number)
         VALUES (@familyId, @relationship, @fullName, @gender, @dob, @bloodGroup, @contact, @address, @remarks, @photo, @idCardType, @idCardNumber)`,
        {
          familyId: data.family_id,
          relationship: data.relationship,
          fullName: data.full_name,
          gender: data.gender,
          dob,
          bloodGroup,
          contact: data.contact || null,
          address: data.address || null,
          remarks: data.remarks || null,
          photo: data.photo_url || null,
          idCardType: data.id_card_type,
          idCardNumber: data.id_card_number,
        },
      );
    }
    return { ok: true };
  });

export const setFamilyHead = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) =>
    z.object({ memberId: z.string().uuid(), familyId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { assertCanAccessFamily } = await import("@/lib/api/access");
    const { execute, queryOne } = await import("@/lib/db");
    await assertCanAccessFamily(context.userId, context.isAdmin, data.familyId);

    const member = await queryOne<{ id: string }>(
      `SELECT id FROM dbo.family_members WHERE id = @id AND family_id = @familyId`,
      { id: data.memberId, familyId: data.familyId },
    );
    if (!member) throw new Error("Family member not found");

    await execute(`UPDATE dbo.family_members SET is_head = 0 WHERE family_id = @familyId AND is_head = 1`, {
      familyId: data.familyId,
    });
    await execute(
      `UPDATE dbo.family_members SET is_head = 1 WHERE id = @id AND family_id = @familyId`,
      { id: data.memberId, familyId: data.familyId },
    );
    return { ok: true };
  });

export const deleteFamilyMember = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), familyId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { assertCanAccessFamily } = await import("@/lib/api/access");
    const { execute, queryOne } = await import("@/lib/db");
    await assertCanAccessFamily(context.userId, context.isAdmin, data.familyId);

    const removing = await queryOne<{ is_head: boolean }>(
      `SELECT is_head FROM dbo.family_members WHERE id = @id AND family_id = @familyId`,
      { id: data.id, familyId: data.familyId },
    );

    await execute(`DELETE FROM dbo.family_members WHERE id = @id AND family_id = @familyId`, {
      id: data.id,
      familyId: data.familyId,
    });

    if (removing?.is_head) {
      await execute(
        `;WITH next_head AS (
           SELECT TOP 1 id
           FROM dbo.family_members
           WHERE family_id = @familyId
           ORDER BY
             CASE relationship
               WHEN N'husband' THEN 1
               WHEN N'wife' THEN 2
               ELSE 3
             END,
             created_at
         )
         UPDATE m SET m.is_head = 1
         FROM dbo.family_members m
         INNER JOIN next_head n ON n.id = m.id`,
        { familyId: data.familyId },
      );
    }
    return { ok: true };
  });

export const createFamilyLogin = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((input: unknown) =>
    z
      .object({
        familyId: z.string().uuid(),
        username: usernameSchema,
        password: passwordSchema,
        fullName: z.string().trim().max(120).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { execute } = await import("@/lib/db");
    const { createUserRecord } = await import("@/lib/api/users");
    const username = data.username.toLowerCase();
    const email = `${username}@${FAMILY_EMAIL_DOMAIN}`;
    const userId = await createUserRecord({
      email,
      username,
      fullName: data.fullName ?? "",
      password: data.password,
      appRole: "family",
    });
    await execute(`UPDATE dbo.families SET wife_user_id = @userId WHERE id = @familyId`, {
      userId,
      familyId: data.familyId,
    });
    return { userId, username };
  });

export const resetFamilyPassword = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((input: unknown) =>
    z.object({ userId: z.string().uuid(), password: passwordSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    const bcrypt = (await import("bcryptjs")).default;
    const { execute } = await import("@/lib/db");
    const passwordHash = await bcrypt.hash(data.password, 10);
    const n = await execute(`UPDATE dbo.users SET password_hash = @hash WHERE id = @userId`, {
      hash: passwordHash,
      userId: data.userId,
    });
    if (!n) throw new Error("User not found");
    return { ok: true };
  });

export const createAdminLogin = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((input: unknown) =>
    z
      .object({
        email: z.string().trim().email().max(255),
        password: passwordSchema,
        fullName: z.string().trim().max(120).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { execute } = await import("@/lib/db");
    const { createUserRecord } = await import("@/lib/api/users");
    const userId = await createUserRecord({
      email: data.email.toLowerCase(),
      username: data.email.split("@")[0] ?? null,
      fullName: data.fullName ?? "",
      password: data.password,
      appRole: "admin",
    });
    await execute(`DELETE FROM dbo.user_roles WHERE user_id = @userId`, { userId });
    await execute(`INSERT INTO dbo.user_roles (user_id, role) VALUES (@userId, N'admin')`, {
      userId,
    });
    return { userId };
  });

export const listAdmins = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const { query } = await import("@/lib/db");
    const roles = await query<{ user_id: string; created_at: string }>(
      `SELECT user_id, created_at FROM dbo.user_roles WHERE role = N'admin' ORDER BY created_at`,
    );
    if (roles.length === 0) return [];
    const profiles = await query<{ id: string; username: string | null; full_name: string | null }>(
      `SELECT id, username, full_name FROM dbo.profiles`,
    );
    const byId = new Map(profiles.map((p) => [String(p.id), p]));
    return roles.map((r) => ({
      user_id: String(r.user_id),
      created_at: String(r.created_at),
      profile: byId.get(String(r.user_id))
        ? {
            id: String(byId.get(String(r.user_id))!.id),
            username: byId.get(String(r.user_id))!.username,
            full_name: byId.get(String(r.user_id))!.full_name,
          }
        : null,
    }));
  });

export const deleteFamily = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { execute, queryOne } = await import("@/lib/db");
    const family = await queryOne<{ id: string; family_name: string }>(
      `SELECT id, family_name FROM dbo.families WHERE id = @id`,
      { id: data.id },
    );
    if (!family) throw new Error("Family not found");

    // Members and payments cascade; expenses are set null by FK
    await execute(`DELETE FROM dbo.families WHERE id = @id`, { id: data.id });
    return { ok: true, family_name: family.family_name };
  });
