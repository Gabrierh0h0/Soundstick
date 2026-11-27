import { describe, expect, it } from 'vitest'
import { dict } from './i18n'

const keys = (o: object) => Object.keys(o).sort()
const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',')

describe('textos', () => {
  it('español e inglés tienen las mismas claves', () => {
    expect(keys(dict.en)).toEqual(keys(dict.es))
  })
  it('los marcadores {x} coinciden en ambos idiomas', () => {
    for (const k of Object.keys(dict.es) as (keyof typeof dict.es)[]) {
      expect(placeholders(dict.en[k]), k).toBe(placeholders(dict.es[k]))
    }
  })
  it('no hay textos vacíos', () => {
    for (const lang of [dict.es, dict.en]) for (const [k, v] of Object.entries(lang)) expect(v.trim(), k).not.toBe('')
  })
})
