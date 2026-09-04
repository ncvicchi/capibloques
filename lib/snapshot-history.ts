export interface SnapshotHistory<T> {
  past: T[];
  present: T;
  future: T[];
  activeGroup: string | null;
  limit: number;
}

export interface CommitSnapshotOptions {
  /**
   * Consecutive changes with the same group are stored as one undo step.
   * This is useful for pointer drags, held arrow keys and text entry.
   */
  group?: string;
}

const cloneSnapshot = <T>(value: T): T => structuredClone(value);

export const snapshotsEqual = <T>(left: T, right: T) =>
  JSON.stringify(left) === JSON.stringify(right);

export const createSnapshotHistory = <T>(
  initialValue: T,
  limit = 100,
): SnapshotHistory<T> => ({
  past: [],
  present: cloneSnapshot(initialValue),
  future: [],
  activeGroup: null,
  limit: Math.max(1, Math.floor(limit)),
});

export const replacePresentSnapshot = <T>(
  history: SnapshotHistory<T>,
  value: T,
): SnapshotHistory<T> => ({
  ...history,
  present: cloneSnapshot(value),
});

export const commitSnapshot = <T>(
  history: SnapshotHistory<T>,
  value: T,
  options: CommitSnapshotOptions = {},
): SnapshotHistory<T> => {
  if (snapshotsEqual(history.present, value)) {
    return options.group === history.activeGroup
      ? history
      : { ...history, activeGroup: options.group ?? null };
  }

  const sameGroup =
    options.group !== undefined && options.group === history.activeGroup;
  return {
    ...history,
    past: sameGroup
      ? history.past
      : [...history.past, cloneSnapshot(history.present)].slice(-history.limit),
    present: cloneSnapshot(value),
    future: [],
    activeGroup: options.group ?? null,
  };
};

export const finishSnapshotGroup = <T>(
  history: SnapshotHistory<T>,
): SnapshotHistory<T> =>
  history.activeGroup === null ? history : { ...history, activeGroup: null };

export const undoSnapshot = <T>(
  history: SnapshotHistory<T>,
): SnapshotHistory<T> => {
  const previous = history.past.at(-1);
  if (previous === undefined) return finishSnapshotGroup(history);
  return {
    ...history,
    past: history.past.slice(0, -1),
    present: cloneSnapshot(previous),
    future: [cloneSnapshot(history.present), ...history.future],
    activeGroup: null,
  };
};

export const redoSnapshot = <T>(
  history: SnapshotHistory<T>,
): SnapshotHistory<T> => {
  const next = history.future[0];
  if (next === undefined) return finishSnapshotGroup(history);
  return {
    ...history,
    past: [...history.past, cloneSnapshot(history.present)].slice(
      -history.limit,
    ),
    present: cloneSnapshot(next),
    future: history.future.slice(1),
    activeGroup: null,
  };
};
