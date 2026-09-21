"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Download } from "lucide-react";
import BackBtn from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useUser } from "@/context/UserContext";
import { usePwa } from "@/context/PwaContext";
import { cn } from "@/lib/utils";

// Loaded on the client only, as before: the account menu reads persisted state.
const UserProfile = dynamic(() => import("@/components/UserProfile"), {
  ssr: false,
  loading: () => <Skeleton className="h-9 w-9 rounded-full" />,
});

/**
 * The right-hand side of every header: install, then either the sign-in
 * buttons or the account menu. One row on every screen size (the old header
 * wrapped onto two rows on phones). While the profile is still loading it
 * shows a placeholder instead of flashing Login / Sign Up at someone who is
 * already signed in.
 */
function HeaderAccount({ compactOnPhone = false }) {
  const { currentUser, loading } = useUser() || {};
  const { ready, installed } = usePwa();

  return (
    <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
      {ready && !installed && (
        <>
          {/* Phone-sized install icon. Skipped on inner pages (compactOnPhone) so the page
              title has room; the install action is still in the account menu there. */}
          <Button
            asChild
            variant="soft"
            size="icon"
            className={cn("h-9 w-9 rounded-full sm:hidden", compactOnPhone && "hidden")}
          >
            <Link href="/install" aria-label="Install the TrybeMarket app">
              <Download />
            </Link>
          </Button>
          <Button asChild variant="soft" size="sm" className="hidden sm:inline-flex">
            <Link href="/install">
              <Download />
              Install app
            </Link>
          </Button>
        </>
      )}

      {loading ? (
        <Skeleton className="h-9 w-9 rounded-full" />
      ) : currentUser ? (
        <UserProfile />
      ) : (
        <>
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Log in</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/signup">Sign up</Link>
          </Button>
        </>
      )}
    </div>
  );
}

/**
 * The header for every page.
 *   <AppHeader />                          logo (home-style pages)
 *   <AppHeader back title="Favorites" />   back button + title (inner pages)
 * `actions` renders just before the account area (e.g. a favorite button).
 * Sticky, with a light frosted background so content scrolls under it cleanly.
 */
export default function AppHeader({ title, back = false, actions = null, className }) {
  return (
    <header
      className={cn(
        "sticky top-0 z-40 w-full border-b border-slate-200/70 bg-white/85 backdrop-blur-md",
        className
      )}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-3 sm:h-16 sm:px-4">
        {back ? (
          <>
            <BackBtn />
            {title && (
              <h1 className="min-w-0 flex-1 truncate text-base font-semibold text-slate-900 sm:text-lg">
                {title}
              </h1>
            )}
          </>
        ) : (
          <Link href="/" aria-label="TrybeMarket home" className="flex shrink-0 items-center">
            <Image
              src="/assets/logo.png"
              alt="TrybeMarket"
              width={140}
              height={40}
              priority
              className="h-9 w-auto sm:h-10"
            />
          </Link>
        )}

        {/* pushes actions to the right when there's no title to fill the row */}
        {(!back || !title) && <div className="flex-1" />}

        {actions}
        <HeaderAccount compactOnPhone={back} />
      </div>
    </header>
  );
}
