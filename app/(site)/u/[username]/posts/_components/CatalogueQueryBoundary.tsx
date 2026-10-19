/**
 * Catalogue query boundary.
 *
 * Convex's `usePaginatedQuery` throws during render when its subscription
 * fails, so the failing subtree must sit under a React error boundary for the
 * reader to get an explanation instead of a blank page. The boundary wraps
 * only the paginated list: the server-rendered author header stays mounted
 * above it, so a query failure never costs the reader the identity and return
 * link they can still use.
 *
 * Retry bumps a generation key on the rendered subtree. The children remount
 * from scratch, which restarts the subscription at its first page rather than
 * resuming a cursor the failure may have invalidated.
 */

"use client";

import { Component, createRef, Fragment, type ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CatalogueQueryBoundaryProps {
  /** The paginated list subtree whose render errors are recovered here. */
  children: ReactNode;
}

interface CatalogueQueryBoundaryState {
  failed: boolean;
  /** Bumped on Retry so the children remount instead of resuming. */
  generation: number;
}

export class CatalogueQueryBoundary extends Component<
  CatalogueQueryBoundaryProps,
  CatalogueQueryBoundaryState
> {
  state: CatalogueQueryBoundaryState = { failed: false, generation: 0 };

  private retryButtonRef = createRef<HTMLButtonElement>();

  static getDerivedStateFromError(): Partial<CatalogueQueryBoundaryState> {
    return { failed: true };
  }

  // The failure unmounts the subtree, so a reader whose focused control lived
  // inside it now has `document.activeElement` fall back to `<body>` (or null).
  // A reader who had moved focus to an unaffected control outside the boundary
  // still has that control focused, and the committed fallback does not touch
  // it. Only claim focus when the failure actually displaced the reader, so we
  // never steal focus from a surviving control; `null`, `<body>`, or a
  // disconnected element all mean displaced. The Retry ref is null-guarded in
  // case a future render drops the button.
  componentDidCatch() {
    const active = document.activeElement;
    const displaced =
      active === null || active === document.body || !active.isConnected;

    if (displaced) {
      this.retryButtonRef.current?.focus();
    }
  }

  private retry = () => {
    this.setState((previous) => ({
      failed: false,
      generation: previous.generation + 1,
    }));
  };

  render() {
    if (this.state.failed) {
      return (
        <div
          role="alert"
          className="flex flex-col items-center gap-3 px-[25px] py-12 text-center md:px-[42px]"
        >
          <TriangleAlert
            aria-hidden="true"
            className="size-12 text-muted-foreground"
            strokeWidth={1.5}
          />
          <h2 className="text-lg font-semibold">Could not load posts</h2>
          <p className="max-w-prose text-sm text-muted-foreground">
            Something went wrong while loading these published posts. Please try
            again.
          </p>
          <Button
            ref={this.retryButtonRef}
            type="button"
            variant="outline"
            onClick={this.retry}
          >
            Retry
          </Button>
        </div>
      );
    }

    return (
      <Fragment key={this.state.generation}>{this.props.children}</Fragment>
    );
  }
}
