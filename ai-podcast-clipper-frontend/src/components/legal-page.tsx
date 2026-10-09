import Link from "next/link";
import { BRAND } from "~/config/brand";

// Bump when a policy's substance changes; the pages show it as "Last updated".
export const LEGAL_LAST_UPDATED = "October 10, 2026";

// how long after purchase an unused credit pack can be refunded on request
export const REFUND_WINDOW_DAYS = 14;

export function LegalPage({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <Link
        href="/"
        className="text-muted-foreground text-sm underline-offset-4 hover:underline"
      >
        ← {BRAND.productName}
      </Link>
      <h1 className="mt-6 text-3xl font-bold tracking-tight">{title}</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Last updated {LEGAL_LAST_UPDATED}
      </p>
      <div className="mt-8 space-y-6 leading-7 [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-2">
        {children}
      </div>
    </main>
  );
}

export function SupportEmail() {
  return (
    <a
      href={`mailto:${BRAND.supportEmail}`}
      className="underline underline-offset-4"
    >
      {BRAND.supportEmail}
    </a>
  );
}
