export const writingNavigation = [
  { label: "New Post", href: "/create" },
  { label: "Drafts", href: "/dashboard/drafts" },
  { label: "My Posts", href: "/dashboard/published" },
  { label: "Analytics", href: "/dashboard/analytics" },
] as const;

export const readingNavigation = [
  { label: "Discover", href: "/blog" },
  { label: "Feed", href: "/feed" },
  { label: "Saved", href: "/saved" },
  { label: "Liked", href: "/liked" },
] as const;

export function isWorkspacePathActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
