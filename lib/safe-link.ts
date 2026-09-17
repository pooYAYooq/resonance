const AUTHOR_LINK_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

export function isSafeAuthorLink(href: string): boolean {
  try {
    return AUTHOR_LINK_PROTOCOLS.has(new URL(href).protocol);
  } catch {
    return false;
  }
}
