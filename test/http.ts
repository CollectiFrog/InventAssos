// Helpers to build requests against the router in tests.

/** Origin used for every test request. */
export const testOrigin = 'http://inventassos.test'

/** Builds a GET request for a path. */
export function get(path: string, headers?: HeadersInit): Request {
  return new Request(new URL(path, testOrigin), { headers })
}
