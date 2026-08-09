import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, ReceiptText, Wallet, BarChart3, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Family Payment Tracking System — Vouchers, Approvals & Reports" },
      {
        name: "description",
        content:
          "One secure place to manage a family profile, submit payments with screenshots, generate vouchers, approve payments and track credit, debit and balance.",
      },
      { property: "og:title", content: "Family Payment Tracking System" },
      {
        property: "og:description",
        content:
          "Family profiles, payment vouchers, admin approvals, expense entry and credit/debit financial reports in one login-based app.",
      },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    icon: Users,
    title: "One family, one login",
    body: "The wife manages the whole family profile — husband, daughter, son and photos — under a single family ID.",
  },
  {
    icon: ReceiptText,
    title: "Payments & vouchers",
    body: "Submit cash or online payments with transaction reference and screenshot. Every entry gets a unique voucher number.",
  },
  {
    icon: ShieldCheck,
    title: "Admin approval",
    body: "Admins review each payment and approve or reject it with a reason. Status updates instantly.",
  },
  {
    icon: Wallet,
    title: "Expense entry",
    body: "Admins record expenses with category, date, description and attachment — counted as debit.",
  },
  {
    icon: BarChart3,
    title: "Credit, debit, balance",
    body: "Approved payments are credit, expenses are debit, and the running balance is calculated automatically.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen">
      <header className="hero-gradient text-primary-foreground">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <span className="font-display text-base font-semibold">Family Payments</span>
          <Button asChild variant="secondary" size="sm">
            <Link to="/auth">Sign in</Link>
          </Button>
        </div>
        <div className="mx-auto max-w-6xl px-6 pb-20 pt-10 sm:pb-28">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            Secure family finance
          </p>
          <h1 className="mt-4 max-w-2xl text-4xl font-semibold leading-tight sm:text-5xl">
            Family Payment Tracking System
          </h1>
          <p className="mt-5 max-w-xl text-base text-primary-foreground/80">
            Manage the family profile, submit payments with proof, generate vouchers, get admin
            approval and see credit, debit and balance in clear reports.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/auth">Sign in to your account</Link>
            </Button>
          </div>

        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-2xl font-semibold">What the system does</h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <article key={f.title} className="surface p-6">
              <span className="inline-flex size-10 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                <f.icon className="size-5" />
              </span>
              <h3 className="mt-4 text-base font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="surface p-8">
          <h2 className="text-xl font-semibold">How it works</h2>
          <ol className="mt-5 grid gap-4 text-sm text-muted-foreground sm:grid-cols-2">
            <li>1. Admin creates the family record and its unique family ID.</li>
            <li>2. Admin issues the wife a username and temporary password.</li>
            <li>3. The wife adds husband, daughter and son details with photos.</li>
            <li>4. She submits payment details and uploads the screenshot.</li>
            <li>5. The system generates the voucher automatically.</li>
            <li>6. Admin approves or rejects, adds expenses, and reviews reports.</li>
          </ol>
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        Family Payment Tracking System
      </footer>
    </div>
  );
}
