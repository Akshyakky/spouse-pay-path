import type { MemberRelationship } from "@/lib/relationships";
import { toDateString, toIsoString } from "@/lib/db-utils";

export function mapFamily(row: Record<string, unknown>) {
  return {
    id: String(row["id"]),
    family_no: String(row["family_no"]),
    family_name: String(row["family_name"]),
    head_of_family: (row["head_of_family"] as string | null) ?? null,
    member_count: Number(row["member_count"] ?? 0),
    male_count: Number(row["male_count"] ?? 0),
    female_count: Number(row["female_count"] ?? 0),
    address: (row["address"] as string | null) ?? null,
    contact_phone: (row["contact_phone"] as string | null) ?? null,
    contact_email: (row["contact_email"] as string | null) ?? null,
    family_photo_url: (row["family_photo_url"] as string | null) ?? null,
    wife_user_id: row["wife_user_id"] ? String(row["wife_user_id"]) : null,
    created_by: row["created_by"] ? String(row["created_by"]) : null,
    created_at: row["created_at"] ? String(row["created_at"]) : "",
    updated_at: row["updated_at"] ? String(row["updated_at"]) : "",
  };
}

export type IdCardType = "aadhaar" | "pan" | "epic" | "dl" | "ration_card";

export type MemberRow = {
  id: string;
  family_id: string;
  relationship: MemberRelationship;
  full_name: string;
  gender: string | null;
  date_of_birth: string | null;
  blood_group: string | null;
  contact: string | null;
  address: string | null;
  photo_url: string | null;
  remarks: string | null;
  id_card_type: IdCardType | null;
  id_card_number: string | null;
  is_head: boolean;
  is_deceased: boolean;
};

export function mapMember(row: Record<string, unknown>): MemberRow {
  return {
    id: String(row["id"]),
    family_id: String(row["family_id"]),
    relationship: row["relationship"] as MemberRow["relationship"],
    full_name: String(row["full_name"]),
    gender: (row["gender"] as string | null) ?? null,
    date_of_birth: toDateString(row["date_of_birth"]),
    blood_group: (row["blood_group"] as string | null) ?? null,
    contact: (row["contact"] as string | null) ?? null,
    address: (row["address"] as string | null) ?? null,
    photo_url: (row["photo_url"] as string | null) ?? null,
    remarks: (row["remarks"] as string | null) ?? null,
    id_card_type: (row["id_card_type"] as IdCardType | null) ?? null,
    id_card_number: (row["id_card_number"] as string | null) ?? null,
    is_head: Boolean(row["is_head"]),
    is_deceased: Boolean(row["is_deceased"]),
  };
}

export type PaymentRow = {
  id: string;
  voucher_no: string;
  family_id: string;
  family_due_id: string | null;
  paid_by: string | null;
  mode: "cash" | "online";
  amount: number;
  payment_date: string;
  txn_ref: string | null;
  screenshot_url: string | null;
  remarks: string | null;
  status: "pending" | "approved" | "rejected";
  admin_remarks: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_by: string | null;
  created_at: string;
};

export function mapPayment(row: Record<string, unknown>): PaymentRow {
  return {
    id: String(row["id"]),
    voucher_no: String(row["voucher_no"]),
    family_id: String(row["family_id"]),
    family_due_id: row["family_due_id"] ? String(row["family_due_id"]) : null,
    paid_by: (row["paid_by"] as string | null) ?? null,
    mode: row["mode"] as PaymentRow["mode"],
    amount: Number(row["amount"]),
    payment_date: toDateString(row["payment_date"]) ?? "",
    txn_ref: (row["txn_ref"] as string | null) ?? null,
    screenshot_url: (row["screenshot_url"] as string | null) ?? null,
    remarks: (row["remarks"] as string | null) ?? null,
    status: row["status"] as PaymentRow["status"],
    admin_remarks: (row["admin_remarks"] as string | null) ?? null,
    approved_by: row["approved_by"] ? String(row["approved_by"]) : null,
    approved_at: toIsoString(row["approved_at"]),
    created_by: row["created_by"] ? String(row["created_by"]) : null,
    created_at: toIsoString(row["created_at"]) ?? "",
  };
}

export type ExpenseRow = {
  id: string;
  category: string;
  amount: number;
  expense_date: string;
  description: string | null;
  attachment_url: string | null;
  family_id: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
};

export function mapExpense(row: Record<string, unknown>): ExpenseRow {
  return {
    id: String(row["id"]),
    category: String(row["category"]),
    amount: Number(row["amount"]),
    expense_date: toDateString(row["expense_date"]) ?? "",
    description: (row["description"] as string | null) ?? null,
    attachment_url: (row["attachment_url"] as string | null) ?? null,
    family_id: row["family_id"] ? String(row["family_id"]) : null,
    created_by: row["created_by"] ? String(row["created_by"]) : null,
    created_by_name: (row["created_by_name"] as string | null) ?? null,
    created_at: row["created_at"] ? String(row["created_at"]) : "",
  };
}
