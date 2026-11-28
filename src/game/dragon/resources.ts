/**
 * GPU resource ownership for Dragon Lab (TB-2 rule "S2"): whoever creates a geometry, material or
 * texture outside JSX owns it and must dispose it when its component unmounts. Leaving and
 * returning to the page must not leave GPU objects behind.
 *
 * The tracker is deliberately free of three.js imports so it can be unit-tested in Node; anything
 * with a dispose() method can be tracked.
 */

export type Disposable = { dispose: () => void };

export type ResourceTracker = {
  /** Registers a resource and returns it, so creation and tracking read as one expression. */
  track: <T extends Disposable>(resource: T) => T;
  /** Disposes every tracked resource exactly once, newest first, and empties the tracker. */
  disposeAll: () => void;
  /** Number of resources currently owned. */
  readonly size: number;
};

export function createResourceTracker(): ResourceTracker {
  const owned: Disposable[] = [];
  return {
    track(resource) {
      if (!owned.includes(resource)) owned.push(resource);
      return resource;
    },
    disposeAll() {
      // Dispose in reverse creation order; keep going even if one throws, then report it.
      let firstError: unknown;
      while (owned.length) {
        const r = owned.pop()!;
        try {
          r.dispose();
        } catch (e) {
          firstError ??= e;
        }
      }
      if (firstError) throw firstError;
    },
    get size() {
      return owned.length;
    },
  };
}

/** Live count of resources created by Dragon Lab and not yet disposed (shown in the debug panel). */
export const liveResources = { count: 0 };

/** Wraps a tracker so the global live count follows it (used by the repeated-visit check). */
export function createCountedTracker(): ResourceTracker {
  const inner = createResourceTracker();
  return {
    track(resource) {
      const before = inner.size;
      inner.track(resource);
      liveResources.count += inner.size - before;
      return resource;
    },
    disposeAll() {
      const n = inner.size;
      try {
        inner.disposeAll();
      } finally {
        liveResources.count -= n;
      }
    },
    get size() {
      return inner.size;
    },
  };
}
