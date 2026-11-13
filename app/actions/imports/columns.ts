// Guessing which item field each column of an imported file holds (US-0.10.1, ADR 0026). Pure:
// the guess is always shown, and the person can change every choice before validating.
import { fold, singular } from './fold.ts'
import { type InventoryField, inventoryHeaders } from './format.ts'

/**
 * The key a column title is compared by: « N° de série » and « numéro série » give the same key.
 * Number signs and units are spelled out, brackets dropped, short words removed, words made
 * singular, common abbreviations expanded.
 */
export function headerKey(header: string): string {
  // A title is never long; cutting it first keeps every step linear on a hostile file.
  const spelled = header
    .slice(0, 200)
    .replace(/n\s*[°º]|\bno\.|#/gi, ' numero ')
    .replace(/\b(?:s\/n|n\/s)\b/gi, ' serie ')
    .replaceAll('€', ' euro ')
    .replace(/\([^()]*\)/g, ' ')
  const folded = fold(spelled)
  if (folded === '') return ''
  return folded
    .split(' ')
    .map((word) => (Object.hasOwn(aliases, word) ? (aliases[word] ?? word) : word))
    .filter((word) => !stopWords.has(word))
    .map(singular)
    .join(' ')
}

const aliases: Record<string, string> = {
  num: 'numero',
  nb: 'nombre',
  nbre: 'nombre',
  ref: 'reference',
  refs: 'reference',
  qte: 'quantite',
  qt: 'quantite',
  qty: 'quantite',
  cat: 'categorie',
}

const stopWords = new Set('de du des d la le les l un une en a au aux et the of in'.split(' '))

/** Words that make a « contains » match wrong: « Prix de location », « Nom du propriétaire ». */
const blockingWords = new Set(
  (
    'proprietaire owner fournisseur supplier vendeur contact responsable emprunteur date annee ' +
    'facture garantie achat location caution poids dimension taille longueur photo lien url ' +
    'total totale prete famille'
  ).split(' '),
)

/** Titles that name a field exactly, and words that are enough when no exact title matches. */
const synonyms: Record<InventoryField, { exact: string[]; contains: string[] }> = {
  ref: {
    exact: [
      'référence',
      'réf',
      'réf.',
      'référence interne',
      'code',
      'code article',
      'code interne',
      'code-barres',
      'n° inventaire',
      "numéro d'inventaire",
      'n°',
      'numéro',
      'étiquette',
      'sku',
      'reference',
      'asset tag',
      'tag',
      'inventory number',
      'item number',
    ],
    contains: ['référence', 'inventaire numéro', 'asset tag'],
  },
  name: {
    exact: [
      'nom',
      'désignation',
      'libellé',
      'intitulé',
      'article',
      'objet',
      'matériel',
      'équipement',
      'produit',
      'appareil',
      'titre',
      'nom du matériel',
      "nom de l'objet",
      'nom article',
      'name',
      'item',
      'item name',
      'title',
      'equipment',
      'product',
      'label',
    ],
    contains: ['nom', 'désignation', 'libellé', 'intitulé', 'name'],
  },
  category: {
    exact: [
      'catégorie',
      'cat.',
      'type',
      'famille',
      'rubrique',
      'domaine',
      'classe',
      'genre',
      'groupe',
      'type de matériel',
      'category',
      'kind',
      'family',
      'group',
    ],
    contains: ['catégorie', 'category', 'famille', 'type'],
  },
  quantity: {
    exact: [
      'quantité',
      'qté',
      'nombre',
      'nb',
      'exemplaires',
      'unités',
      'stock',
      'combien',
      'quantity',
      'qty',
      'count',
      'units',
      'number',
    ],
    contains: ['quantité', 'nombre', 'quantity'],
  },
  brand: {
    exact: ['marque', 'fabricant', 'constructeur', 'brand', 'make', 'manufacturer', 'maker'],
    contains: ['marque', 'fabricant', 'brand', 'manufacturer'],
  },
  model: {
    exact: [
      'modèle',
      'référence constructeur',
      'référence fabricant',
      'réf fabricant',
      'version',
      'model',
      'model name',
      'model number',
    ],
    contains: ['modèle', 'model'],
  },
  serialNumber: {
    exact: [
      'numéro de série',
      'n° de série',
      'n° série',
      'série',
      's/n',
      'sn',
      'serial',
      'serial number',
      'serial no',
    ],
    contains: ['série', 'serial'],
  },
  condition: {
    exact: ['état', 'état général', 'état du matériel', 'usure', 'condition', 'state'],
    contains: ['état', 'condition'],
  },
  estimatedValue: {
    exact: [
      'valeur',
      'valeur estimée',
      'valeur estimée (€)',
      "valeur d'achat",
      'valeur à neuf',
      'valeur de remplacement',
      'valeur unitaire',
      'prix',
      "prix d'achat",
      'prix unitaire',
      'prix neuf',
      'prix estimé',
      'coût',
      'montant',
      'estimation',
      '€',
      'euros',
      'value',
      'estimated value',
      'price',
      'unit price',
      'purchase price',
      'cost',
      'replacement value',
    ],
    contains: ['valeur', 'prix', 'coût', 'value', 'price'],
  },
  description: {
    exact: [
      'description',
      'descriptif',
      'détails',
      'commentaire',
      'commentaires',
      'remarque',
      'remarques',
      'note',
      'notes',
      'observation',
      'observations',
      'précisions',
      'infos',
      'informations',
      'caractéristiques',
      'comments',
      'details',
      'remarks',
    ],
    contains: ['description', 'commentaire', 'remarque', 'note', 'observation'],
  },
  location: {
    exact: [
      'lieu',
      'lieu de stockage',
      'lieu de rangement',
      'nom du lieu',
      'rangé à',
      'rangé dans',
      'rangement',
      'emplacement',
      'stockage',
      'localisation',
      'local',
      'dépôt',
      'entrepôt',
      'salle',
      'où',
      'location',
      'place',
      'storage',
      'storage location',
      'room',
      'where',
    ],
    contains: ['lieu', 'emplacement', 'rangement', 'stockage', 'storage'],
  },
  id: { exact: ['identifiant', 'identifiant inventassos', 'id', 'uuid'], contains: [] },
}

/** Field order, to break ties the same way every time. */
const fieldOrder = Object.keys(synonyms) as InventoryField[]

/** Exact keys and « contains » word lists, computed once with `headerKey`. */
const exactKeys = new Map<string, InventoryField>()
const containsWords: { field: InventoryField; words: string[] }[] = []
for (const field of fieldOrder) {
  for (const title of synonyms[field].exact) {
    const key = headerKey(title)
    const owner = exactKeys.get(key)
    if (owner !== undefined && owner !== field) {
      throw new Error(`Import synonym « ${title} » names both ${owner} and ${field}`)
    }
    exactKeys.set(key, field)
  }
  for (const term of synonyms[field].contains) {
    containsWords.push({ field, words: headerKey(term).split(' ') })
  }
}

/** The exact keys, for tests: every synonym survives `headerKey` and names one field. */
export function exactSynonymKeys(): ReadonlyMap<string, InventoryField> {
  return exactKeys
}

/** Our own export's titles: an exact match on one of them beats any other synonym. */
const ownTitles = new Map<string, InventoryField>(
  (Object.entries(inventoryHeaders) as [InventoryField, string][]).map(([field, title]) => [
    headerKey(title),
    field,
  ]),
)

/**
 * How sure a column guess is: saved by this owner, our own title, another exact title, or a word
 * in the title.
 */
export type ColumnGuessSource = 'saved' | 'own' | 'exact' | 'contains'

/** The field guessed for a column, or null for « Ne pas importer ». */
export interface ColumnGuess {
  field: InventoryField | null
  source: ColumnGuessSource | null
}

/**
 * Guesses a field for each column, each field used once. Candidates are scored (the owner's saved
 * choice, then an exact title, then a title containing the words of a field), then assigned from
 * the surest, left to right. `saved` maps header keys to the fields this owner chose before.
 */
export function guessColumns(
  headers: readonly string[],
  saved: Readonly<Record<string, string>> = {},
): ColumnGuess[] {
  const scores = { saved: 5, own: 4, exact: 3, contains: 2 } as const
  const candidates: { column: number; field: InventoryField; source: ColumnGuessSource }[] = []
  const ignored = new Set<number>()
  headers.forEach((header, column) => {
    const key = headerKey(header)
    if (key === '') return
    const remembered = Object.hasOwn(saved, key) ? saved[key] : undefined
    // The owner chose « Ne pas importer » for this title before: nothing is guessed for it.
    if (remembered === '') {
      ignored.add(column)
      return
    }
    if (remembered !== undefined && (fieldOrder as string[]).includes(remembered)) {
      candidates.push({ column, field: remembered as InventoryField, source: 'saved' })
    }
    const own = ownTitles.get(key)
    if (own !== undefined) candidates.push({ column, field: own, source: 'own' })
    const exact = exactKeys.get(key)
    if (exact !== undefined && exact !== own) {
      candidates.push({ column, field: exact, source: 'exact' })
    }
    const tokens = key.split(' ')
    if (tokens.some((word) => blockingWords.has(word))) return
    for (const { field, words } of containsWords) {
      if (words.every((word) => tokens.includes(word))) {
        candidates.push({ column, field, source: 'contains' })
      }
    }
  })
  candidates.sort(
    (a, b) =>
      scores[b.source] - scores[a.source] ||
      a.column - b.column ||
      fieldOrder.indexOf(a.field) - fieldOrder.indexOf(b.field),
  )
  const guesses: ColumnGuess[] = headers.map((_, column) => ({
    field: null,
    source: ignored.has(column) ? 'saved' : null,
  }))
  const taken = new Set<InventoryField>()
  for (const { column, field, source } of candidates) {
    const guess = guesses[column]
    if (guess === undefined || guess.field !== null || taken.has(field)) continue
    guesses[column] = { field, source }
    taken.add(field)
  }
  return guesses
}
