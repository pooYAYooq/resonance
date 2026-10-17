"use client";

import { useCallback, useRef, useState } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { X } from "lucide-react";
import { api } from "@/convex/_generated/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * The dashboard-scoped one-time welcome.
 *
 * Presentation is the approved "Sound canvas" treatment: one borderless card
 * centred on the dashboard with the harmonic-wave artwork faded across a band
 * behind the greeting, over a blurred overlay that matches the app's
 * sheet/hamburger backdrop. The visual values are ported from the approved
 * author-page study, archived as `resonance-welcome-popup-2026-10-18` (its
 * `content/popup-styles.html`, Option 1). They are kept as literal arbitrary
 * classes rather than new global tokens.
 *
 * It is built on the app's accessible `Dialog` primitive, so it is a real modal:
 * focus is trapped inside the card, the dashboard behind it is inert, Escape
 * and an overlay click dismiss it, and focus is restored on close. The
 * primitive's overlay already matches the approved backdrop, so it is left
 * untouched.
 *
 * The dismissal is persisted on the account (see `convex/welcome.ts`), so
 * closing the popup keeps it closed across devices and sessions rather than
 * only for the current tab. It is mounted on the dashboard, so a visitor who
 * never reaches the dashboard never sees it. There is no timer: a refresh
 * before closing keeps the popup, and a failed dismissal write simply means it
 * reappears on the next load, which is recoverable.
 */

const ART_WIDTH = 360;
const ART_VIEWBOX_HEIGHT = 240;

/** Builds one polyline `d` attribute by sampling `fn` across `width`. */
function wavePath(width: number, fn: (t: number) => number): string {
  let d = "";
  for (let x = 0; x <= width; x += 4) {
    d += `${x === 0 ? "M" : "L"}${x} ${fn(x / width).toFixed(2)} `;
  }
  return d;
}

/**
 * The harmonic-wave drawing: 15 layered sine paths. The middle path (index 7)
 * is drawn slightly stronger so the band reads as a single sound.
 */
function harmonicWavePaths(width: number): string[] {
  const cycles = 1.25;
  const paths: string[] = [];
  for (let i = 0; i < 15; i++) {
    paths.push(
      wavePath(
        width,
        (t) =>
          140 +
          (i - 7) * 3 +
          Math.sin(t * Math.PI * 2 * cycles + i * 0.07) * (22 + i * 2) +
          Math.sin(t * Math.PI * 2 * (cycles + 0.75)) * 8,
      ),
    );
  }
  return paths;
}

const HARMONIC_PATHS = harmonicWavePaths(ART_WIDTH);

export function WelcomeDialog() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const dismissWelcome = useMutation(api.welcome.dismissWelcome);
  const state = useQuery(
    api.welcome.getWelcomeState,
    !isLoading && isAuthenticated ? {} : "skip",
  );
  const [closed, setClosed] = useState(false);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const open =
    !isLoading &&
    isAuthenticated &&
    state != null &&
    !state.dismissed &&
    !closed;

  /**
   * Closes the popup immediately and records the dismissal on the account.
   * The write is best effort: a failure is recoverable (the popup reappears on
   * the next load), so it must neither claim success nor surface an unhandled
   * rejection.
   */
  const close = useCallback(() => {
    setClosed(true);
    dismissWelcome({}).catch(() => {
      // Intentionally ignored; the account value is simply left unchanged.
    });
  }, [dismissWelcome]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Escape and an overlay click both surface here as `false`, so they run
        // through the same best-effort dismissal as the close button.
        if (!next) close();
      }}
    >
      <DialogContent
        showCloseButton={false}
        aria-modal="true"
        onOpenAutoFocus={() => {
          // Capture the element that had focus before the modal opened, while
          // the primitive's auto-focus has not moved it yet. Restored below.
          const active = document.activeElement;
          previouslyFocusedRef.current =
            active instanceof HTMLElement ? active : null;
        }}
        onCloseAutoFocus={(event) => {
          // The modal primitive otherwise focuses only its (absent) trigger, so
          // restore the control that was focused before the popup opened. Fall
          // back to the body when that element is gone, so focus is never lost.
          event.preventDefault();
          const target = previouslyFocusedRef.current;
          if (target && target.isConnected) {
            target.focus();
            return;
          }
          document.body.focus();
        }}
        className="grid min-h-[188px] w-[440px] max-w-full place-items-center gap-0 overflow-hidden rounded-[9px] bg-[#ffffff] p-0 text-center text-[#33261e] shadow-[0_18px_60px_#1e2a2422] ring-0 sm:max-w-[440px] dark:bg-[#30231e] dark:text-[#f1ddd0] dark:shadow-[0_18px_60px_#00000055]"
      >
        {/* Centred artwork band, faded 30% at each edge, nudged 3px below centre. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-1/2 h-[118px] w-[min(340px,90%)] text-[#ab4a22] [transform:translate(-50%,calc(-50%_+_3px))] [-webkit-mask-image:linear-gradient(90deg,transparent,#000_30%,#000_70%,transparent)] [mask-image:linear-gradient(90deg,transparent,#000_30%,#000_70%,transparent)] dark:text-[#efa471]"
        >
          <svg
            viewBox={`0 0 ${ART_WIDTH} ${ART_VIEWBOX_HEIGHT}`}
            preserveAspectRatio="none"
            aria-hidden="true"
            focusable="false"
            className="absolute inset-0 h-full w-full"
          >
            {HARMONIC_PATHS.map((d, index) => (
              <path
                key={index}
                d={d}
                fill="none"
                stroke="currentColor"
                strokeWidth={0.8}
                opacity={index === 7 ? 0.26 : 0.16}
              />
            ))}
          </svg>
        </div>
        <button
          type="button"
          aria-label="Close welcome"
          onClick={close}
          className="absolute top-[9px] right-[9px] grid size-[30px] cursor-pointer place-items-center rounded-[7px] text-[#33261e] opacity-65 hover:bg-[#00000010] hover:opacity-100 dark:text-[#f1ddd0] dark:hover:bg-[#ffffff14]"
        >
          <X className="size-[15px]" strokeWidth={1.8} />
        </button>
        <div className="relative z-1 px-[44px] py-[38px]">
          <DialogTitle className="text-[30px] leading-[1.12] font-semibold tracking-[-0.05em]">
            Welcome to RESONANCE.
          </DialogTitle>
          <DialogDescription className="mt-[10px] text-[13px] leading-[1.65] text-inherit">
            We&apos;re glad you&apos;re here.
          </DialogDescription>
        </div>
      </DialogContent>
    </Dialog>
  );
}
