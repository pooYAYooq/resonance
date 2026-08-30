export const DASHBOARD_PATH = "/dashboard";

export function getSafeReturnTo(returnTo: string | null | undefined): string {
  if (!returnTo) {
    return DASHBOARD_PATH;
  }

  try {
    const decodedReturnTo = decodeURIComponent(returnTo);

    for (const value of [returnTo, decodedReturnTo]) {
      if (
        !value.startsWith("/") ||
        value.startsWith("//") ||
        value.startsWith("/auth/") ||
        value.includes("\\")
      ) {
        return DASHBOARD_PATH;
      }
    }
  } catch {
    return DASHBOARD_PATH;
  }

  return returnTo;
}

export function buildAuthHref(authPath: string, returnTo: string): string {
  return `${authPath}?returnTo=${encodeURIComponent(returnTo)}`;
}

/** Only call from browser event handlers or effects, never during render. */
export function getCurrentReturnTo(): string {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}
