# Family Finance Hub

Below is a clean, full requirement document revised for the **single family login for the wife** structure.

## Requirement Document

### 1. Project Title

Family Payment Tracking System

### 2. Project Objective

The purpose of this system is to manage a family’s profile, payment records, voucher generation, expense tracking, approval process, and financial reporting through a secure login-based application.

### 3. System Overview

The system will be designed for one family unit consisting of:

- Husband.

- Wife.

- One daughter.

- One son.

The **wife** will be the primary login user for the family. Through her login, she can manage the details of all family members under a single family record. The admin will oversee records, approve payments, and manage expenses and reports.

### 4. User Roles

#### 4.1 Admin

The admin can:

- Create and manage family records.

- View all family details.

- Approve or reject payment entries.

- Add expenses.

- Generate financial reports.

- View credit and debit history.

#### 4.2 Family Member User

The wife will be the family member user and can:

- Log in using her own credentials.

- Add and update husband details.

- Add and update daughter details.

- Add and update son details.

- Submit payment details.

- Upload photos and payment screenshots.

- View payment status, vouchers, and family-related records.

### 5. Functional Requirements

#### 5.1 Family Account Management

- The system shall allow one login account for the wife.

- Each family shall have one unique family identification number.

- The wife shall manage a single family profile from her login.

- The family profile shall include:

  - Wife details.

  - Husband details.

  - Daughter details.

  - Son details.

- The system should allow uploading photos for family members.

#### 5.2 Family Member Details

For each family member, the system shall store:

- Full name.

- Gender.

- Relationship to wife.

- Date of birth.

- Age.

- Contact details, if applicable.

- Photo.

- Other remarks, if needed.

The wife shall be able to enter and update:

- Husband details.

- Daughter details.

- Son details.

- Any other dependent family member details, if required later.

#### 5.3 Login and Access Control

- The system shall provide separate login access for:

  - Admin.

  - Wife as family user.

- The wife shall access only her family profile.

- The admin shall access all families and all transactions.

- Role-based access control shall be applied.

#### 5.4 Payment Management

- The wife shall be able to add payment details for the family.

- Payment modes shall include:

  - Cash.

  - Online transfer.

- For each payment entry, the system shall store:

  - Amount.

  - Payment date.

  - Payment mode.

  - Remarks.

  - Transaction reference number for online transfer.

  - Screenshot upload for online transfer.

#### 5.5 Voucher Generation

- The system shall generate a voucher for each payment entry.

- Each voucher shall have a unique voucher number.

- Voucher details shall include:

  - Family identification number.

  - Family name.

  - Payment amount.

  - Payment mode.

  - Date of payment.

  - Transaction details.

  - Approval status.

#### 5.6 Admin Approval

- After a payment is submitted by the wife, the admin shall review the details.

- The admin shall be able to:

  - Approve the payment.

  - Reject the payment.

- If rejected, the admin shall provide a reason.

- The system shall update the payment status after admin action.

#### 5.7 Expense Management

- The admin shall be able to add expenses.

- Expense details shall include:

  - Expense category.

  - Amount.

  - Date.

  - Description.

  - Attachment, if any.

- All expenses shall be included in financial reports and debit calculations.

#### 5.8 Financial Reporting

- The system shall generate financial reports for each family and for the overall system.

- Reports shall include:

  - Total credit.

  - Total debit.

  - Balance.

  - Payment history.

  - Expense history.

  - Approved and pending transactions.

- Reports shall support filtering by:

  - Date range.

  - Family.

  - Payment type.

  - Approval status.

#### 5.9 Credit and Debit Tracking

- The system shall maintain credit and debit records.

- Credit shall represent approved family payments.

- Debit shall represent expenses added by the admin.

- The system shall calculate the running balance automatically.

### 6. Data Fields

#### 6.1 Family Profile

- Family ID.

- Wife name.

- Husband name.

- Daughter name.

- Son name.

- Address.

- Contact details.

- Family photo.

- Member photos.

#### 6.2 Payment Record

- Payment ID.

- Family ID.

- Paid by.

- Payment mode.

- Amount.

- Date.

- Transaction reference number.

- Screenshot.

- Status.

- Admin remarks.

#### 6.3 Expense Record

- Expense ID.

- Category.

- Amount.

- Date.

- Description.

- Attachment.

- Entered by admin.

### 7. Workflow

1. Admin creates a family record and assigns a unique family ID.

2. Wife receives login credentials.

3. Wife logs in and adds family member details.

4. Wife submits payment details with screenshot if needed.

5. System generates a voucher.

6. Admin verifies the payment and approves or rejects it.

7. Admin adds expenses when required.

8. System updates credit, debit, and balance.

9. Financial reports are generated for review.

### 8. Non-Functional Requirements

- The system shall be secure and protect user data.

- The system shall support photo and screenshot uploads.

- The system shall be simple and easy to use.

- The system shall be responsive for mobile and desktop use.

- The system shall support data backup and recovery.

- The system shall be scalable for future family records.

### 9. Expected Outputs

- Family profile records.

- Member details for husband, wife, daughter, and son.

- Payment vouchers.

- Payment approval history.

- Expense records.

- Credit and debit reports.

- Family-wise financial summary.

## Short Requirement Summary

This system will allow one family to be managed through a single wife login. She can add husband, daughter, and son details under one family ID, submit payment records, and upload supporting files. The admin will approve payments, enter expenses, and generate financial reports with credit and debit tracking.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
