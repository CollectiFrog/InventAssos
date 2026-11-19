// Writes public/landing-scene.css from the landing scene's model (ADR 0039). Run after changing it:
// `npm run landing:css`; a test fails while the committed file is out of date.
import { writeFileSync } from 'node:fs'
import { sceneStylesheet } from '../app/ui/landing-scene/model.ts'

writeFileSync(new URL('../public/landing-scene.css', import.meta.url), sceneStylesheet())
