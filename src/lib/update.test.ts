import { describe, expect, it } from 'vitest'
import { isNewer } from './update'

describe('isNewer', () => {
  it('compara versiones', () => {
    expect(isNewer('1.0.1', '1.0.0')).toBe(true)
    expect(isNewer('1.10.0', '1.9.9')).toBe(true)
    expect(isNewer('1.0.0', '1.0.0')).toBe(false)
    expect(isNewer('0.9.9', '1.0.0')).toBe(false)
  })
})
