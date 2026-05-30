import { ulid } from 'ulid';

/** Wrapped so tests can stub a deterministic id via Deps if needed. */
export function newId(): string {
  return ulid();
}
