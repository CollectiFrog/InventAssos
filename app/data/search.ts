// Helpers shared by the text searches (inventory, collectifs directory).

/** Escapes LIKE wildcards so a search for "50%" means the text "50%". */
export function likeLiteral(text: string): string {
  return text.replace(/[\\%_]/g, (char) => `\\${char}`)
}
