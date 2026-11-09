// Route IDs come from the URL: anything that is not a UUID is simply "not found" (review F7).

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** True for a UUID; PostgreSQL would reject anything else with an error instead of no row. */
export function isUuid(value: string): boolean {
  return uuidPattern.test(value)
}
