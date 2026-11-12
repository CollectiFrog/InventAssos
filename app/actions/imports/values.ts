// Guessing the category, condition and location each value of an imported file stands for
// (US-0.10.1, ADR 0026). Pure: the guesses are shown, and every one can be changed before
// validating; what stays unknown falls back to « Autre » (categories) or « Non précisé ».
import { type ItemCondition, itemConditions } from '../../data/tables.ts'
import { conditionLabels } from '../../ui/labels.ts'
import { containsPhrase, fold, words } from './fold.ts'

/** How a value was matched: the owner's saved choice, a name, the vocabulary, or by default. */
export type ValueGuessSource = 'saved' | 'exact' | 'loose' | 'vocabulary' | 'fallback'

/** A category as the guess needs it. */
export interface CategoryChoice {
  id: string
  name: string
  position: number
}

/**
 * Words of the trade per seeded category, folded. A list applies only while its category still
 * exists and is still named after it (one of `canonical`): admins rename and add categories
 * (US-0.7.10), and a category renamed to something else must not inherit sound equipment.
 */
const vocabulary: Record<string, { canonical: string[]; terms: string[] }> = {
  sound: {
    canonical: ['son', 'sono', 'sonorisation', 'audio', 'sound'],
    terms: [
      'son',
      'sono',
      'sonorisation',
      'audio',
      'sound',
      'micro',
      'micros',
      'microphone',
      'microphones',
      'hf',
      'enceinte',
      'enceintes',
      'haut parleur',
      'haut parleurs',
      'hp',
      'caisson',
      'sub',
      'subwoofer',
      'retour',
      'retours',
      'wedge',
      'ampli',
      'amplificateur',
      'amplification',
      'console son',
      'table de mixage',
      'mixage',
      'mixette',
      'mixer',
      'di',
      'boite de direct',
      'platine',
      'platines',
      'dj',
      'casque',
      'casques',
      'backline',
      'instrument',
      'instruments',
      'diffusion',
      'speaker',
      'speakers',
      'enregistreur',
      'recorder',
    ],
  },
  lighting: {
    canonical: ['lumiere', 'eclairage', 'light', 'lighting'],
    terms: [
      'lumiere',
      'lumieres',
      'eclairage',
      'eclairages',
      'light',
      'lights',
      'lighting',
      'lampe',
      'lampes',
      'projecteur',
      'projecteurs',
      'projo',
      'projos',
      'par',
      'par led',
      'led',
      'leds',
      'lyre',
      'lyres',
      'gradateur',
      'gradateurs',
      'dimmer',
      'dmx',
      'console lumiere',
      'pupitre lumiere',
      'jeu d orgue',
      'stroboscope',
      'strobe',
      'decoupe',
      'decoupes',
      'fresnel',
      'poursuite',
      'guirlande',
      'guirlandes',
      'gobo',
      'laser',
      'blinder',
      'wash',
      'spot',
      'spots',
      'ampoule',
      'ampoules',
      'machine a fumee',
      'fumee',
      'brouillard',
      'hazer',
    ],
  },
  video: {
    canonical: ['video', 'image', 'visuel'],
    terms: [
      'video',
      'videos',
      'image',
      'images',
      'visuel',
      'vjing',
      'vj',
      'videoprojecteur',
      'video projecteur',
      'vp',
      'projection',
      'ecran',
      'ecrans',
      'moniteur',
      'tv',
      'tele',
      'television',
      'camera',
      'cameras',
      'camescope',
      'objectif',
      'photo',
      'appareil photo',
      'regie video',
      'melangeur video',
      'switcher',
      'cinema',
      'screen',
      'projector',
      'beamer',
      'display',
    ],
  },
  structure: {
    canonical: ['structure'],
    terms: [
      'structure',
      'structures',
      'pont',
      'ponts',
      'truss',
      'pied',
      'pieds',
      'trepied',
      'tripod',
      'stand',
      'stands',
      'praticable',
      'praticables',
      'scene',
      'estrade',
      'podium',
      'echafaudage',
      'tour',
      'totem',
      'levage',
      'palan',
      'moteur',
      'accroche',
      'accroches',
      'elingue',
      'elingues',
      'manille',
      'collier',
      'colliers',
      'crochet',
      'crochets',
      'barnum',
      'tonnelle',
      'chapiteau',
      'tente',
      'stage',
      'rigging',
      'perche',
      'lest',
      'embase',
    ],
  },
  scenery: {
    canonical: ['decor', 'deco', 'decoration', 'scenographie', 'scenery'],
    terms: [
      'decor',
      'decors',
      'deco',
      'decoration',
      'decorations',
      'scenographie',
      'sceno',
      'accessoire',
      'accessoires',
      'costume',
      'costumes',
      'mobilier',
      'meuble',
      'meubles',
      'tissu',
      'tissus',
      'rideau',
      'rideaux',
      'pendrillon',
      'pendrillons',
      'toile',
      'tapis',
      'moquette',
      'table',
      'tables',
      'chaise',
      'chaises',
      'banc',
      'bancs',
      'signaletique',
      'banderole',
      'drapeau',
      'peinture',
      'scenery',
      'set',
      'props',
      'furniture',
    ],
  },
  power: {
    canonical: ['electricite', 'electrique', 'elec', 'power', 'alimentation', 'courant'],
    terms: [
      'electricite',
      'electrique',
      'elec',
      'courant',
      'alimentation',
      'alim',
      'distribution',
      'armoire',
      'armoire electrique',
      'coffret',
      'coffret electrique',
      'tableau electrique',
      'groupe electrogene',
      'generateur',
      'generatrice',
      'onduleur',
      'batterie',
      'batteries',
      'pile',
      'piles',
      'transformateur',
      'transfo',
      'disjoncteur',
      'p17',
      'triphase',
      'power',
      'electrical',
      'electricity',
      'generator',
      'ups',
    ],
  },
  cabling: {
    canonical: ['cablage', 'cable', 'cabling', 'connectique'],
    terms: [
      'cablage',
      'cable',
      'cables',
      'cordon',
      'cordons',
      'rallonge',
      'rallonges',
      'prolongateur',
      'prolongateurs',
      'multiprise',
      'multiprises',
      'triplette',
      'enrouleur',
      'touret',
      'multipaire',
      'multipaires',
      'xlr',
      'jack',
      'speakon',
      'powercon',
      'rj45',
      'ethernet',
      'hdmi',
      'adaptateur',
      'adaptateurs',
      'connectique',
      'connecteur',
      'connecteurs',
      'fil',
      'fils',
      'gaine',
      'passe cable',
      'passe cables',
      'wiring',
      'cabling',
      'cord',
      'extension cord',
      'lead',
      'leads',
    ],
  },
  other: {
    canonical: ['autre', 'divers', 'other', 'misc'],
    terms: [
      'autre',
      'autres',
      'divers',
      'misc',
      'miscellaneous',
      'other',
      'others',
      'non classe',
      'sans categorie',
      'inconnu',
      'na',
      'aucun',
      'aucune',
      'general',
      'outil',
      'outils',
      'outillage',
      'consommable',
      'consommables',
      'transport',
      'vehicule',
      'logistique',
      'securite',
      'epi',
      'informatique',
      'bureau',
      'cuisine',
      'vaisselle',
    ],
  },
}

/** The category « Autre »: by its key, else by its name, else the last of the list. */
export function fallbackCategory(categories: readonly CategoryChoice[]): CategoryChoice | null {
  const byPosition = [...categories].sort((a, b) => a.position - b.position)
  return (
    byPosition.find((category) => category.id === 'other') ??
    byPosition.find((category) =>
      ['autre', 'autres', 'divers', 'other', 'misc'].includes(fold(category.name)),
    ) ??
    byPosition.at(-1) ??
    null
  )
}

/** Picks the best of several candidates: the longest match, then the first of the list. */
function best<candidate extends { position: number }>(
  candidates: readonly { category: candidate; length: number }[],
): candidate | undefined {
  return [...candidates].sort(
    (a, b) => b.length - a.length || a.category.position - b.category.position,
  )[0]?.category
}

/**
 * Guesses the category of one value of the file, in order: the owner's saved choice, a category
 * name (exact, then loose: plural, or all its words in the value), the vocabulary, « Autre ». A
 * category an admin added is matched by its name before any built-in word. Null only when there
 * is no category at all.
 */
export function guessCategory(
  value: string,
  categories: readonly CategoryChoice[],
  saved: Readonly<Record<string, string>> = {},
): { categoryId: string; source: ValueGuessSource } | null {
  const key = fold(value)
  const fallback = fallbackCategory(categories)
  if (fallback === null) return null
  const known = new Map(categories.map((category) => [category.id, category]))

  const remembered = saved[key]
  if (remembered !== undefined && known.has(remembered)) {
    return { categoryId: remembered, source: 'saved' }
  }
  if (key === '') return { categoryId: fallback.id, source: 'fallback' }

  const exact = categories.find((category) => fold(category.name) === key)
  if (exact) return { categoryId: exact.id, source: 'exact' }

  const valueWords = words(value)
  const loose = best(
    categories
      .map((category) => ({ category, nameWords: words(category.name) }))
      .filter(
        ({ nameWords }) =>
          nameWords.length > 0 &&
          (nameWords.join(' ') === valueWords.join(' ') ||
            nameWords.every((word) => valueWords.includes(word))),
      )
      .map(({ category, nameWords }) => ({ category, length: nameWords.join(' ').length })),
  )
  if (loose) return { categoryId: loose.id, source: 'loose' }

  const fromVocabulary = best(
    categories.flatMap((category) => {
      const list = vocabulary[category.id]
      if (!list) return []
      // Off when the category was renamed away from what it holds.
      const nameWords = words(category.name)
      if (!list.canonical.some((word) => nameWords.includes(word))) return []
      return list.terms
        .map((term) => words(term))
        .filter((termWords) => containsPhrase(valueWords, termWords))
        .map((termWords) => ({ category, length: termWords.join(' ').length }))
    }),
  )
  if (fromVocabulary) return { categoryId: fromVocabulary.id, source: 'vocabulary' }
  return { categoryId: fallback.id, source: 'fallback' }
}

/** Words for each condition, folded; the French labels and the keys themselves are added below. */
const conditionTerms: Record<ItemCondition, string[]> = {
  broken: [
    'hors service',
    'hs',
    'h s',
    'casse',
    'cassee',
    'mort',
    'morte',
    'foutu',
    'kaput',
    'ne fonctionne pas',
    'ne fonctionne plus',
    'ne marche pas',
    'ne marche plus',
    'irreparable',
    'epave',
    'pour pieces',
    'rebut',
    'a jeter',
    'broken',
    'dead',
    'out of order',
    'not working',
    'for parts',
  ],
  repair: [
    'a reparer',
    'reparation',
    'en reparation',
    'a reviser',
    'revision',
    'a verifier',
    'a tester',
    'a controler',
    'defectueux',
    'defectueuse',
    'defaut',
    'en panne',
    'panne',
    'fonctionne mal',
    'sav',
    'repair',
    'to repair',
    'needs repair',
    'to fix',
    'faulty',
    'to check',
    'maintenance',
  ],
  worn: [
    'use',
    'usee',
    'usage',
    'usagee',
    'usure',
    'etat moyen',
    'moyen',
    'moyenne',
    'passable',
    'etat d usage',
    'fatigue',
    'fatiguee',
    'vieux',
    'vieille',
    'ancien',
    'abime',
    'abimee',
    'raye',
    'rayee',
    'traces d usure',
    'vetuste',
    'mauvais',
    'mauvais etat',
    'worn',
    'used',
    'fair',
    'average',
    'scratched',
    'old',
  ],
  new: [
    'neuf',
    'neuve',
    'neufs',
    'comme neuf',
    'etat neuf',
    'quasi neuf',
    'jamais servi',
    'jamais utilise',
    'sous emballage',
    'new',
    'brand new',
    'like new',
    'mint',
    'unused',
  ],
  good: [
    'bon',
    'bonne',
    'bon etat',
    'tres bon etat',
    'tres bon',
    'tbe',
    'be',
    'bien',
    'ok',
    'correct',
    'correcte',
    'fonctionne',
    'fonctionnel',
    'fonctionnelle',
    'en etat',
    'en etat de marche',
    'marche',
    'excellent',
    'excellent etat',
    'parfait',
    'parfait etat',
    'impeccable',
    'ras',
    'rien a signaler',
    'good',
    'very good',
    'fine',
    'working',
    'works',
    'great',
  ],
}

/** Most severe first: « bon état, à réviser » is to repair, « ne fonctionne pas » is broken. */
const severity: ItemCondition[] = ['broken', 'repair', 'worn', 'new', 'good']

/** Each condition's phrases as word lists, its label and key included (so an export round-trips). */
const conditionPhrases = new Map<ItemCondition, string[][]>(
  itemConditions.map((condition) => [
    condition,
    [...conditionTerms[condition], conditionLabels[condition], condition].map((term) =>
      words(term),
    ),
  ]),
)

/**
 * Guesses a condition: the owner's saved choice, an exact phrase, then the first condition, most
 * severe first, whose phrase appears in the value. Null means « Non précisé ».
 */
export function guessCondition(
  value: string,
  saved: Readonly<Record<string, string>> = {},
): { condition: ItemCondition | null; source: ValueGuessSource } {
  const key = fold(value)
  const remembered = saved[key]
  if (remembered !== undefined && (itemConditions as readonly string[]).includes(remembered)) {
    return { condition: remembered as ItemCondition, source: 'saved' }
  }
  if (key === '') return { condition: null, source: 'fallback' }
  const valueWords = words(value)
  const joined = valueWords.join(' ')
  for (const condition of severity) {
    const phrases = conditionPhrases.get(condition) ?? []
    if (phrases.some((phrase) => phrase.join(' ') === joined)) {
      return { condition, source: 'exact' }
    }
  }
  for (const condition of severity) {
    const phrases = conditionPhrases.get(condition) ?? []
    if (phrases.some((phrase) => containsPhrase(valueWords, phrase))) {
      return { condition, source: 'vocabulary' }
    }
  }
  return { condition: null, source: 'fallback' }
}

/** For tests: every condition phrase, to check none names two conditions exactly. */
export function conditionPhraseList(): ReadonlyMap<ItemCondition, string[][]> {
  return conditionPhrases
}

/**
 * Guesses a location of the owner: the saved choice, else the one location whose name is exactly
 * the value. Null means « the import's location » (no fuzzy matching on places).
 */
export function guessLocation(
  value: string,
  locations: readonly { id: string; name: string }[],
  saved: Readonly<Record<string, string>> = {},
): { locationId: string | null; source: ValueGuessSource } {
  const key = fold(value)
  const known = new Set(locations.map((location) => location.id))
  const remembered = saved[key]
  if (remembered !== undefined && known.has(remembered)) {
    return { locationId: remembered, source: 'saved' }
  }
  if (key === '') return { locationId: null, source: 'fallback' }
  const matching = locations.filter((location) => fold(location.name) === key)
  return matching.length === 1 && matching[0]
    ? { locationId: matching[0].id, source: 'exact' }
    : { locationId: null, source: 'fallback' }
}
