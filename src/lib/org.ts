export const ORG = {
  name: "Andhota Ashtha Daivagala Seva Trust (R)",
  product: "Family Payment Tracking System",
  contactPerson: "Gunduri Darkaas Venuru",
  phone: "9964856036",
  phoneHref: "tel:+919964856036",
  logoSrc: "/logo.jpg",
} as const;

export function orgPageTitle(page?: string) {
  return page ? `${page} — ${ORG.name}` : ORG.name;
}

export function orgContactLine() {
  return `${ORG.contactPerson} · ${ORG.phone}`;
}
