"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const sections = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/drafts", label: "Drafts" },
  { href: "/dashboard/published", label: "Published" },
  { href: "/dashboard/saved", label: "Saved" },
] as const;

function isActivePath(pathname: string, href: string) {
  return pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
}

function SectionLink({ href, label }: (typeof sections)[number]) {
  const pathname = usePathname();
  const active = isActivePath(pathname, href);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "rounded-md px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {label}
    </Link>
  );
}

export function DashboardSectionNav() {
  return (
    <nav aria-label="Dashboard sections" className="mb-8">
      <div className="hidden items-center gap-1 rounded-lg border bg-card p-1 sm:flex">
        {sections.map((section) => (
          <SectionLink key={section.href} {...section} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:hidden">
        {sections.map((section) => (
          <SectionLink key={section.href} {...section} />
        ))}
      </div>
    </nav>
  );
}
