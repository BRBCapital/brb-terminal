"use client";

import { usePathname } from "next/navigation";

// Chooses the page frame. Marketing routes (the public /strategies landing)
// render full-bleed with no TopNav / footer / width constraint; everything else
// gets the standard app chrome. The nav/footer are passed in as rendered nodes
// so a Server Component (SiteFooter) can cross this client boundary safely.
export function AppFrame({
  nav,
  footer,
  children,
}: {
  nav: React.ReactNode;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // Public, full-bleed surfaces (no internal app chrome): the marketing landing
  // and prospect portal under /strategies, and the broker execution portal.
  const bare = pathname?.startsWith("/strategies") || pathname?.startsWith("/broker");

  if (bare) return <>{children}</>;

  return (
    <>
      {nav}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      {footer}
    </>
  );
}
