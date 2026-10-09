import Link from "next/link";
import { BRAND } from "~/config/brand";

export const FOOTER_LINKS = [
  { href: "/pricing", label: "Pricing" },
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/refunds", label: "Refunds" },
] as const;

export function SiteFooter() {
  return (
    <footer className="text-muted-foreground border-t px-4 py-6 text-sm">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 sm:flex-row">
        <p>
          © {new Date().getFullYear()} {BRAND.companyName}. {BRAND.productName}{" "}
          is a {BRAND.companyName} product.
        </p>
        <nav className="flex flex-wrap items-center gap-4">
          {FOOTER_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="hover:text-foreground underline-offset-4 hover:underline"
            >
              {link.label}
            </Link>
          ))}
          <a
            href={`mailto:${BRAND.supportEmail}`}
            className="hover:text-foreground underline-offset-4 hover:underline"
          >
            Support
          </a>
        </nav>
      </div>
    </footer>
  );
}
