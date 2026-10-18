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

import { Component, Fragment, type ReactNode } from "react";
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

  static getDerivedStateFromError(): Partial<CatalogueQueryBoundaryState> {
    return { failed: true };
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
          <Button type="button" variant="outline" onClick={this.retry}>
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
