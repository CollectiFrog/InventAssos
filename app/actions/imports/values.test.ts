import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import {
  type CategoryChoice,
  conditionPhraseList,
  fallbackCategory,
  guessCategory,
  guessCondition,
  guessLocation,
} from './values.ts'

const seeded: CategoryChoice[] = [
  ['sound', 'Son'],
  ['lighting', 'Lumière'],
  ['video', 'Vidéo'],
  ['structure', 'Structure'],
  ['scenery', 'Décor'],
  ['power', 'Électricité'],
  ['cabling', 'Câblage'],
  ['other', 'Autre'],
].map(([id = '', name = ''], position) => ({ id, name, position }))

const category = (value: string, categories = seeded, saved?: Record<string, string>) =>
  guessCategory(value, categories, saved)?.categoryId

describe('guessing categories, conditions and locations (ADR 0026)', () => {
  it('matches category names exactly, then loosely', () => {
    assert.equal(category('son'), 'sound')
    assert.equal(category('LUMIERES'), 'lighting')
    assert.equal(category('Matériel son'), 'sound')
    assert.equal(category('electricite'), 'power')
  })

  it('knows the words of the trade, longest first', () => {
    assert.equal(category('Projo'), 'lighting')
    assert.equal(category('Lyre DMX'), 'lighting')
    assert.equal(category('Vidéo projecteur'), 'video')
    assert.equal(category('Câble DMX'), 'cabling')
    assert.equal(category('Enceintes'), 'sound')
    assert.equal(category('Haut-parleur'), 'sound')
    assert.equal(category('Praticables'), 'structure')
    assert.equal(category('Groupe électrogène'), 'power')
  })

  it('falls back to « Autre », also for a blank cell', () => {
    assert.deepEqual(guessCategory('Bidule', seeded), { categoryId: 'other', source: 'fallback' })
    assert.deepEqual(guessCategory('', seeded), { categoryId: 'other', source: 'fallback' })
  })

  it('puts the saved choice first, unless its category is gone', () => {
    assert.equal(category('Projo', seeded, { projo: 'video' }), 'video')
    assert.equal(category('Projo', seeded, { projo: 'deleted' }), 'lighting')
  })

  it('prefers a category added by an admin to the built-in words', () => {
    const withInstruments = [...seeded, { id: 'instruments', name: 'Instruments', position: 8 }]
    assert.equal(category('Instruments', withInstruments), 'instruments')
    assert.equal(category('Instrument', withInstruments), 'instruments')
  })

  it('keeps a renamed category’s words only while its name still fits', () => {
    const renamed = seeded.map((c) => (c.id === 'video' ? { ...c, name: 'Image' } : c))
    assert.equal(category('Écran', renamed), 'video')
    const repurposed = seeded.map((c) => (c.id === 'scenery' ? { ...c, name: 'Cuisine' } : c))
    assert.equal(category('Rideau', repurposed), 'other')
  })

  it('finds « Autre » without its key, else takes the last category, else gives up', () => {
    const noOther = seeded.filter((c) => c.id !== 'other')
    assert.equal(fallbackCategory([...noOther, { id: 'x', name: 'Divers', position: 9 }])?.id, 'x')
    assert.equal(fallbackCategory(noOther)?.id, 'cabling')
    assert.equal(guessCategory('Projo', []), null)
  })

  it('reads conditions, the most severe first', () => {
    const condition = (value: string) => guessCondition(value).condition
    assert.equal(condition('TBE'), 'good')
    assert.equal(condition('bon état, à réviser'), 'repair')
    assert.equal(condition('ne fonctionne pas'), 'broken')
    assert.equal(condition('HS'), 'broken')
    assert.equal(condition('Comme neuf'), 'new')
    assert.equal(condition('À réparer'), 'repair')
    assert.equal(condition('worn'), 'worn')
    assert.equal(condition('pas d’avis'), null)
    assert.equal(condition(''), null)
    assert.equal(guessCondition('nickel', { nickel: 'new' }).condition, 'new')
  })

  it('gives no condition phrase to two conditions', () => {
    const owner = new Map<string, string>()
    for (const [condition, phrases] of conditionPhraseList()) {
      for (const phrase of phrases) {
        const key = phrase.join(' ')
        assert.ok(!owner.has(key) || owner.get(key) === condition, `« ${key} » is ambiguous`)
        owner.set(key, condition)
      }
    }
  })

  it('matches locations by exact name only, and only when one fits', () => {
    const places = [
      { id: 'a', name: 'Local' },
      { id: 'b', name: 'Cave' },
      { id: 'c', name: 'cave' },
    ]
    assert.equal(guessLocation('LOCAL', places).locationId, 'a')
    assert.equal(guessLocation('Cave', places).locationId, null)
    assert.equal(guessLocation('Loc', places).locationId, null)
    assert.equal(guessLocation('Grenier', places, { grenier: 'b' }).locationId, 'b')
  })
})
