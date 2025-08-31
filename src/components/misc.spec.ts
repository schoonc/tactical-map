import { test, expect } from 'vitest'
import { between } from './misc'

test('1', () => {
    expect(between(180, 90, 270)).toBe(true)
    expect(between(0, 50, 150)).toBe(false)
    expect(between(0, 270, 90)).toBe(true)
    expect(between(180, 270, 90)).toBe(false)
})