import type { CloudProject } from './project-library';

export type ReviewVersion = {
  revision: number;
  title: string;
  createdAt: string;
  pinned: boolean;
  current: boolean;
  bytes: number;
  kind: string;
};
export type Feedback = {
  id: string;
  revision: number;
  author: { displayName: string; alias: string } | null;
  text: string;
  reply: string;
  resolved: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
};
export type ReviewStatus = {
  project: CloudProject;
  owner: { displayName: string; alias: string };
  versions: ReviewVersion[];
  feedback: Feedback[];
  isOwner: boolean;
  canComment: boolean;
  canRespond: boolean;
  csrfToken: string;
};
export type ReviewRequest = <T>(
  path: string,
  options?: RequestInit,
) => Promise<T>;

export class ReviewError extends Error {
  constructor(
    message: string,
    readonly status = 0,
  ) {
    super(message);
  }
}

export const reviewUrl = (
  id: string,
  course?: string | null,
  revision?: number,
) =>
  `/revision/?${new URLSearchParams({ project: id, ...(course ? { course } : {}), ...(revision ? { version: String(revision) } : {}) })}`;
