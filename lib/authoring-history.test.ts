import { describe, expect, it, vi } from "vitest";
import {
  createHistoryTraversalGuard,
  getNavigationApi,
  type NavigateEventLike,
  type NavigationLike,
} from "./authoring-history";

type Listener = (event: NavigateEventLike) => void;

function fakeNavigation() {
  const listeners = new Set<Listener>();
  const traversed: string[] = [];
  let interceptCalls = 0;
  const navigation: NavigationLike = {
    addEventListener: (_type, listener) => {
      listeners.add(listener);
    },
    removeEventListener: (_type, listener) => {
      listeners.delete(listener);
    },
    traverseTo: (key) => {
      traversed.push(key);
    },
  };
  function emit(overrides: Partial<NavigateEventLike> = {}) {
    const event: NavigateEventLike = {
      canIntercept: true,
      cancelable: true,
      hashChange: false,
      downloadRequest: null,
      formData: null,
      navigationType: "traverse",
      destination: {
        key: "entry-1",
        sameDocument: true,
        url: "https://app.example/blog/post-1?x=1#top",
      },
      preventDefault: () => {
        interceptCalls += 1;
      },
      intercept: () => undefined,
      ...overrides,
    };
    for (const listener of listeners) listener(event);
    return event;
  }
  return {
    navigation,
    emit,
    traversed,
    listenerCount: () => listeners.size,
    interceptCalls: () => interceptCalls,
  };
}

describe("createHistoryTraversalGuard", () => {
  it("asks about cancelable same-document traversals and cancels when told to", () => {
    const { navigation, emit, interceptCalls } = fakeNavigation();
    const onTraverse = vi.fn(() => true);
    createHistoryTraversalGuard({ navigation, onTraverse });

    emit();

    expect(onTraverse).toHaveBeenCalledWith({
      key: "entry-1",
      href: "/blog/post-1?x=1#top",
    });
    expect(interceptCalls()).toBe(1);
  });

  it("asks the provider to flush instead of pretending to cancel an uncancelable traversal", () => {
    const { navigation, emit, interceptCalls } = fakeNavigation();
    const onTraverse = vi.fn(() => true);
    const onUncancelableTraverse = vi.fn();
    createHistoryTraversalGuard({
      navigation,
      onTraverse,
      onUncancelableTraverse,
    });

    emit({ cancelable: false });

    expect(onTraverse).not.toHaveBeenCalled();
    expect(onUncancelableTraverse).toHaveBeenCalledTimes(1);
    expect(interceptCalls()).toBe(0);
  });

  it("leaves the traversal alone when the callback allows it", () => {
    const { navigation, emit, interceptCalls } = fakeNavigation();
    const onTraverse = vi.fn(() => false);
    createHistoryTraversalGuard({ navigation, onTraverse });

    emit();

    expect(onTraverse).toHaveBeenCalledTimes(1);
    expect(interceptCalls()).toBe(0);
  });

  it.each([
    ["a push", { navigationType: "push" }],
    ["a reload", { navigationType: "reload" }],
    ["a non-interceptable traversal", { canIntercept: false }],
    [
      "a cross-document destination",
      {
        destination: {
          key: "k",
          sameDocument: false,
          url: "https://app.example/x",
        },
      },
    ],
    ["a hash-only change", { hashChange: true }],
    ["a download", { downloadRequest: "file.pdf" }],
    ["a form submission", { formData: new FormData() }],
    [
      "an empty destination key",
      {
        destination: {
          key: "",
          sameDocument: true,
          url: "https://app.example/x",
        },
      },
    ],
  ])("ignores %s", (_label, overrides) => {
    const { navigation, emit, interceptCalls } = fakeNavigation();
    const onTraverse = vi.fn(() => true);
    createHistoryTraversalGuard({ navigation, onTraverse });

    emit(overrides as Partial<NavigateEventLike>);

    expect(onTraverse).not.toHaveBeenCalled();
    expect(interceptCalls()).toBe(0);
  });

  it("does not crash when preventDefault throws", () => {
    const { navigation, emit } = fakeNavigation();
    createHistoryTraversalGuard({
      navigation,
      onTraverse: () => true,
    });

    expect(() =>
      emit({
        preventDefault: () => {
          throw new Error("already handled");
        },
      }),
    ).not.toThrow();
  });

  it("replays an exact entry once and re-arms afterwards", () => {
    const { navigation, emit, traversed, interceptCalls } = fakeNavigation();
    const onTraverse = vi.fn(() => true);
    const guard = createHistoryTraversalGuard({ navigation, onTraverse });

    expect(guard.replay("entry-7")).toBe(true);
    expect(traversed).toEqual(["entry-7"]);

    emit({
      destination: {
        key: "entry-7",
        sameDocument: true,
        url: "https://app.example/back",
      },
    });
    expect(onTraverse).not.toHaveBeenCalled();
    expect(interceptCalls()).toBe(0);

    emit({
      destination: {
        key: "entry-7",
        sameDocument: true,
        url: "https://app.example/back",
      },
    });
    expect(onTraverse).toHaveBeenCalledTimes(1);
    expect(interceptCalls()).toBe(1);
  });

  it("does not consume the bypass for a different destination", () => {
    const { navigation, emit } = fakeNavigation();
    const onTraverse = vi.fn(() => false);
    const guard = createHistoryTraversalGuard({ navigation, onTraverse });

    guard.replay("entry-7");
    emit({
      destination: {
        key: "entry-9",
        sameDocument: true,
        url: "https://app.example/other",
      },
    });

    expect(onTraverse).toHaveBeenCalledWith({ key: "entry-9", href: "/other" });

    emit({
      destination: {
        key: "entry-7",
        sameDocument: true,
        url: "https://app.example/back",
      },
    });
    expect(onTraverse).toHaveBeenCalledTimes(2);
  });

  it("reports traversal failure instead of pretending to replay", () => {
    const { navigation } = fakeNavigation();
    navigation.traverseTo = () => {
      throw new Error("stale key");
    };
    const guard = createHistoryTraversalGuard({
      navigation,
      onTraverse: () => true,
    });

    expect(guard.replay("entry-gone")).toBe(false);
  });

  it("stops listening after dispose", () => {
    const { navigation, emit, listenerCount } = fakeNavigation();
    const onTraverse = vi.fn(() => true);
    const guard = createHistoryTraversalGuard({ navigation, onTraverse });
    expect(listenerCount()).toBe(1);

    guard.dispose();
    emit();

    expect(listenerCount()).toBe(0);
    expect(onTraverse).not.toHaveBeenCalled();
  });

  it("drops destinations without a usable href", () => {
    const { navigation, emit, interceptCalls } = fakeNavigation();
    const onTraverse = vi.fn(() => true);
    createHistoryTraversalGuard({ navigation, onTraverse });

    emit({
      destination: { key: "k", sameDocument: true, url: "not a url" },
    });

    expect(onTraverse).not.toHaveBeenCalled();
    expect(interceptCalls()).toBe(0);
  });
});

describe("getNavigationApi", () => {
  it("returns null when the Navigation API is unavailable", () => {
    expect(getNavigationApi()).toBeNull();
  });

  it("returns the navigation object when it looks usable", () => {
    const { navigation } = fakeNavigation();
    (globalThis as { navigation?: unknown }).navigation = navigation;
    try {
      expect(getNavigationApi()).toBe(navigation);
    } finally {
      delete (globalThis as { navigation?: unknown }).navigation;
    }
  });

  it("rejects an incomplete navigation object", () => {
    (globalThis as { navigation?: unknown }).navigation = {
      addEventListener: () => undefined,
    };
    try {
      expect(getNavigationApi()).toBeNull();
    } finally {
      delete (globalThis as { navigation?: unknown }).navigation;
    }
  });
});
