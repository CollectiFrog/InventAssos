// The client's network address, for per-client rate limits (ADR 0018).

/** Internal header carrying the address `server.ts` saw; any copy sent by a client is replaced. */
export const clientAddressHeader = 'x-inventassos-client-address'

/** A copy of the request that carries the client address, overwriting whatever the client sent. */
export function withClientAddress(request: Request, address: string): Request {
  const headers = new Headers(request.headers)
  headers.set(clientAddressHeader, address)
  return new Request(request, { headers })
}

/** The address set by `withClientAddress`, or "unknown" (tests, or a router used without it). */
export function clientAddressOf(request: Request): string {
  return request.headers.get(clientAddressHeader) || 'unknown'
}
