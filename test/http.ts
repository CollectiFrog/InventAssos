// Helpers to build bare requests against the router in tests.
import { testOrigin } from './app.ts'

/** Builds a GET request for a path. */
export function get(path: string, headers?: HeadersInit): Request {
  return new Request(new URL(path, testOrigin), { headers })
}
