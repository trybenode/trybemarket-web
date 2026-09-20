"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ChevronRight, GraduationCap, Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import useUniversitySelection from "@/hooks/useUniversitySelection";
import useUserStore from "@/lib/userStore";
import { useUser } from "@/context/UserContext";

/**
 * Campus picker shown once, right after signup.
 *
 * The page is always in exactly one of these states, decided only from facts
 * we are sure about:
 *   loading  — we don't yet know who this is / what they've chosen
 *   picker   — signed in, store loaded, no campus chosen yet
 *   leaving  — signed out (-> login) or already has a campus (-> home)
 *   error    — their profile couldn't be loaded, so we can't tell
 * It used to infer "already selected" from isFirstTimeUser() === false, which
 * is also false while the store is still loading: a refresh on this page (or
 * reopening the installed app here) showed a red "University Already Selected"
 * card indefinitely and never the picker, and every login flashed it briefly.
 */
export default function SelectUniversityPage() {
  const router = useRouter();
  const { currentUser, loading: authLoading } = useUser() || {};
  const isInitialized = useUserStore((s) => s.isInitialized);
  const selectedUniversity = useUserStore((s) => s.selectedUniversity);
  const initError = useUserStore((s) => s.initError);

  const { universities, searchQuery, setSearchQuery, loading, error, handleSelectUniversity } =
    useUniversitySelection();

  const [phase, setPhase] = useState("loading");
  const [pending, setPending] = useState(null); // the campus being saved

  // The store is only initialised by login/signup and after sign-in, so opening
  // this page directly (refresh, installed-app relaunch) must load it itself.
  useEffect(() => {
    const store = useUserStore.getState();
    if (!store.isInitialized) store.loadUser();
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!currentUser) {
      setPhase("leaving");
      router.replace("/login");
      return;
    }
    // While the store re-initialises (it does, briefly, right after sign-in),
    // keep showing whatever we were showing — never flip to a wrong state.
    if (!isInitialized) return;
    if (initError) {
      setPhase("error");
      return;
    }
    if (selectedUniversity) {
      setPhase("leaving");
      router.replace("/");
      return;
    }
    setPhase("picker");
  }, [authLoading, currentUser, isInitialized, initError, selectedUniversity, router]);

  const onSelect = async (university) => {
    if (pending) return; // no double taps
    setPending(university);
    const saved = await handleSelectUniversity(university);
    if (!saved) setPending(null); // let them retry; on success we're navigating away
  };

  const retry = () => {
    useUserStore.getState().resetInitError();
    setPhase("loading");
    useUserStore.getState().loadUser();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8">
      <div className="w-full max-w-md rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
        <div className="relative mx-auto mb-4 h-14 w-44">
          <Image src="/assets/logo.png" alt="TrybeMarket" fill priority className="object-contain" />
        </div>

        {phase === "picker" ? (
          <>
            <div className="text-center">
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Choose your campus</h1>
              <p className="mt-1 text-sm text-slate-600">
                We'll show you what students at your university are buying and selling.
              </p>
            </div>

            <div className="relative mt-5">
              <Search className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Search universities…"
                className="h-11 rounded-full border-slate-200 pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                disabled={loading || !!pending}
                aria-label="Search Universities Input"
              />
            </div>

            <div className="mt-3 max-h-[52vh] overflow-y-auto">
              {loading ? (
                <div className="space-y-2" aria-busy="true">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-2xl" />
                  ))}
                </div>
              ) : error ? (
                <p className="rounded-2xl bg-red-50 p-4 text-center text-sm text-red-700">{error}</p>
              ) : universities.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">
                  No universities found. More are being added soon — stay tuned!
                </p>
              ) : (
                <ul className="space-y-2">
                  {universities.map((university) => {
                    const isPending = pending === university;
                    return (
                      <li key={university}>
                        <button
                          type="button"
                          onClick={() => onSelect(university)}
                          disabled={!!pending}
                          className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3.5 py-3 text-left transition hover:border-primary/40 hover:bg-blue-50/50 active:scale-[0.99] disabled:opacity-60"
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-yellow-soft text-amber-700">
                            <GraduationCap className="h-[18px] w-[18px]" />
                          </span>
                          <span className="min-w-0 flex-1 text-sm font-semibold text-slate-900">{university}</span>
                          {isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin text-primary" aria-label="Saving" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-slate-400" />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <p className="mt-4 text-center text-xs text-slate-500">
              These are the universities we're currently in. More will be added soon.
            </p>
          </>
        ) : phase === "error" ? (
          <div className="py-8 text-center">
            <h1 className="text-lg font-bold text-slate-900">We couldn't load your account</h1>
            <p className="mt-1 text-sm text-slate-600">Check your connection and try again.</p>
            <Button className="mt-5" size="lg" onClick={retry}>
              Try again
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-12 text-center" role="status" aria-live="polite">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
            <p className="text-sm text-slate-600">
              {phase === "leaving" ? "Taking you there…" : "Checking your account…"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
