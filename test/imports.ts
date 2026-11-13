// Test helpers for the import (ADR 0026): files built in code, sent like a browser does.
import { toCsv } from '../app/csv.ts'
import { routes } from '../app/routes.ts'
import type { TestClient, TestResponse } from './app.ts'

/** A CSV file as a spreadsheet writes it, from rows of cells. */
export function csvFile(rows: string[][], name = 'inventaire.csv'): File {
  return new File([toCsv(rows)], name, { type: 'text/csv' })
}

/** Sends a file to the import's first step, into a location. */
export function uploadFile(
  client: TestClient,
  locationId: string,
  file: File,
): Promise<TestResponse> {
  const body = new FormData()
  body.set('locationId', locationId)
  body.set('fichier', file)
  return client.postForm(routes.imports.start.action.href(), body, {
    csrfFrom: routes.imports.start.index.href(),
  })
}

/** The import ID in a redirect to one of its steps. */
export function importIdOf(location: string | null): string {
  return /\/import\/([0-9a-f-]{36})\//.exec(location ?? '')?.[1] ?? ''
}
