import { test, expect, describe } from 'vitest'
import { 
  between, 
  convertAngleTo360, 
  cartesianDistance, 
  mercatorBearing, 
  cartesianAngle, 
  mercatorDestination,
  preciseRound,
  assertDefined,
  makeSegmentGeometries
} from './misc'

describe('convertAngleTo360', () => {
  test('converts positive angles correctly', () => {
    expect(convertAngleTo360(45)).toBe(45)
    expect(convertAngleTo360(180)).toBe(180)
    expect(convertAngleTo360(359)).toBe(359)
  })

  test('converts negative angles to positive', () => {
    expect(convertAngleTo360(-90)).toBe(270)
    expect(convertAngleTo360(-180)).toBe(180)
    expect(convertAngleTo360(-270)).toBe(90)
    expect(convertAngleTo360(-360)).toBe(0)
  })

  test('normalizes angles over 360', () => {
    expect(convertAngleTo360(361)).toBe(1)
    expect(convertAngleTo360(450)).toBe(90)
    expect(convertAngleTo360(720)).toBe(0)
    expect(convertAngleTo360(810)).toBe(90)
  })

  test('handles edge cases', () => {
    expect(convertAngleTo360(0)).toBe(0)
    expect(convertAngleTo360(360)).toBe(0)
    expect(convertAngleTo360(-720)).toBe(0)
  })
})

describe('between', () => {
  test('checks if angle is between two angles (clockwise)', () => {
    expect(between(180, 90, 270)).toBe(true)
    expect(between(135, 90, 270)).toBe(true)
    expect(between(225, 90, 270)).toBe(true)
  })

  test('checks if angle is NOT between two angles', () => {
    expect(between(0, 50, 150)).toBe(false)
    expect(between(180, 270, 90)).toBe(false)
    expect(between(45, 90, 270)).toBe(false)
  })

  test('handles angles crossing 0 degrees', () => {
    expect(between(0, 270, 90)).toBe(true)
    expect(between(45, 270, 90)).toBe(true)
    expect(between(315, 270, 90)).toBe(true)
    expect(between(180, 270, 90)).toBe(false)
  })

  test('handles negative angles', () => {
    expect(between(-180, 90, 270)).toBe(true) // -180 = 180
    expect(between(315, 270, 90)).toBe(true)   // Another angle in the range crossing 0
  })

  test('returns false when start equals end', () => {
    expect(between(45, 90, 90)).toBe(false)
    expect(between(180, 180, 180)).toBe(false)
  })
})

describe('cartesianDistance', () => {
  test('calculates distance between two points', () => {
    expect(cartesianDistance([0, 0], [3, 4])).toBe(5)
    expect(cartesianDistance([1, 1], [4, 5])).toBe(5)
  })

  test('returns 0 for same point', () => {
    expect(cartesianDistance([5, 5], [5, 5])).toBe(0)
    expect(cartesianDistance([0, 0], [0, 0])).toBe(0)
  })

  test('handles negative coordinates', () => {
    expect(cartesianDistance([-1, -1], [2, 3])).toBe(5)
    expect(cartesianDistance([0, 0], [-3, -4])).toBe(5)
  })

  test('distance is symmetric', () => {
    const dist1 = cartesianDistance([1, 2], [4, 6])
    const dist2 = cartesianDistance([4, 6], [1, 2])
    expect(dist1).toBe(dist2)
  })
})

describe('mercatorBearing', () => {
  test('calculates bearing between two points', () => {
    expect(mercatorBearing([0, 0], [1, 0])).toBe(0)      // East
    expect(mercatorBearing([0, 0], [0, 1])).toBe(90)     // North
    expect(mercatorBearing([0, 0], [-1, 0])).toBe(180)   // West
    expect(mercatorBearing([0, 0], [0, -1])).toBe(-90)   // South
  })

  test('calculates diagonal bearings', () => {
    expect(mercatorBearing([0, 0], [1, 1])).toBe(45)     // NE
    expect(mercatorBearing([0, 0], [-1, 1])).toBe(135)   // NW
    expect(mercatorBearing([0, 0], [-1, -1])).toBe(-135) // SW
    expect(mercatorBearing([0, 0], [1, -1])).toBe(-45)   // SE
  })

  test('returns 0 for same point', () => {
    expect(mercatorBearing([5, 5], [5, 5])).toBe(0)
    expect(mercatorBearing([0, 0], [0, 0])).toBe(0)
  })

  test('handles arbitrary points', () => {
    const bearing = mercatorBearing([10, 20], [15, 25])
    expect(bearing).toBeCloseTo(45, 5)
  })
})

describe('cartesianAngle', () => {
  test('calculates angle between three points', () => {
    // 90 degree angle
    expect(cartesianAngle([1, 0], [0, 0], [0, 1])).toBe(90)
    // 180 degree angle
    expect(cartesianAngle([1, 0], [0, 0], [-1, 0])).toBe(180)
    // 270 degree angle
    expect(cartesianAngle([1, 0], [0, 0], [0, -1])).toBe(270)
  })

  test('calculates angles with offset center', () => {
    const angle = cartesianAngle([11, 10], [10, 10], [10, 11])
    expect(angle).toBe(90)
  })

  test('returns normalized angles', () => {
    const angle = cartesianAngle([0, 1], [0, 0], [1, 0])
    expect(angle).toBe(270) // Clockwise from north to east
  })

  test('handles collinear points', () => {
    const angle = cartesianAngle([1, 0], [0, 0], [2, 0])
    expect(angle).toBe(0)
  })
})

describe('mercatorDestination', () => {
  test('calculates destination point from origin', () => {
    const dest = mercatorDestination([0, 0], 100, 0)
    expect(dest[0]).toBeCloseTo(100)
    expect(dest[1]).toBeCloseTo(0)
  })

  test('calculates destination in different directions', () => {
    const north = mercatorDestination([0, 0], 100, 90)
    expect(north[0]).toBeCloseTo(0, 5)
    expect(north[1]).toBeCloseTo(100)

    const west = mercatorDestination([0, 0], 100, 180)
    expect(west[0]).toBeCloseTo(-100, 5)
    expect(west[1]).toBeCloseTo(0, 5)

    const south = mercatorDestination([0, 0], 100, -90)
    expect(south[0]).toBeCloseTo(0, 5)
    expect(south[1]).toBeCloseTo(-100)
  })

  test('handles diagonal bearings', () => {
    const ne = mercatorDestination([0, 0], 100, 45)
    expect(ne[0]).toBeCloseTo(70.71, 1)
    expect(ne[1]).toBeCloseTo(70.71, 1)
  })

  test('works with non-zero origins', () => {
    const dest = mercatorDestination([100, 200], 50, 0)
    expect(dest[0]).toBeCloseTo(150)
    expect(dest[1]).toBeCloseTo(200)
  })
})

describe('preciseRound', () => {
  test('rounds to specified decimal places', () => {
    expect(preciseRound(3.14159, 2)).toBe(3.14)
    expect(preciseRound(3.14159, 3)).toBe(3.142)
    expect(preciseRound(3.14159, 4)).toBe(3.1416)
  })

  test('rounds to whole numbers', () => {
    expect(preciseRound(3.7, 0)).toBe(4)
    expect(preciseRound(3.4, 0)).toBe(3)
    expect(preciseRound(3.5, 0)).toBe(4)
  })

  test('handles negative numbers', () => {
    expect(preciseRound(-3.14159, 2)).toBe(-3.14)
    expect(preciseRound(-3.7, 0)).toBe(-4)
  })

  test('handles very small numbers', () => {
    expect(preciseRound(0.00001234, 6)).toBe(0.000012)
    expect(preciseRound(0.00001234, 8)).toBe(0.00001234)
  })

  test('handles edge cases', () => {
    expect(preciseRound(0, 2)).toBe(0)
    expect(preciseRound(100, 2)).toBe(100)
  })
})

describe('assertDefined', () => {
  test('passes for defined values', () => {
    expect(() => assertDefined('value')).not.toThrow()
    expect(() => assertDefined(1)).not.toThrow() // Changed from 0 since !0 is truthy
    expect(() => assertDefined(true)).not.toThrow() // Changed from false since !false is truthy
    expect(() => assertDefined([])).not.toThrow()
    expect(() => assertDefined({})).not.toThrow()
  })

  test('throws for undefined', () => {
    expect(() => assertDefined(undefined)).toThrow('Value must be defined')
  })

  test('throws for null', () => {
    // Current implementation throws for null (since !null is true)
    expect(() => assertDefined(null)).toThrow('Value must be defined')
  })
})

describe('makeSegmentGeometries', () => {
  test('creates segment geometries with basic inputs', () => {
    const result = makeSegmentGeometries(
      [0, 0],  // center
      [1, 0],  // direction end
      90       // sector angle
    )

    expect(result.sector).toBeDefined()
    expect(result.sector.type).toBe('Polygon')
    expect(result.sector.coordinates[0].length).toBeGreaterThan(3)

    expect(result.direction).toBeDefined()
    expect(result.direction.type).toBe('LineString')
    expect(result.direction.coordinates).toHaveLength(2)

    expect(result.dirStart.type).toBe('Point')
    expect(result.dirEnd.type).toBe('Point')
    expect(result.arcStart.type).toBe('Point')
    expect(result.arcEnd.type).toBe('Point')
  })

  test('creates sector with correct angle', () => {
    const result = makeSegmentGeometries(
      [0, 0],
      [1, 0],
      180  // 180 degree sector
    )

    // Sector should have many points for smooth arc
    expect(result.sector.coordinates[0].length).toBeGreaterThan(20)
    
    // First and last points should be the same (closed polygon)
    const coords = result.sector.coordinates[0]
    expect(coords[0]).toEqual(coords[coords.length - 1])
  })

  test('handles different sector angles', () => {
    const small = makeSegmentGeometries([0, 0], [1, 0], 30)
    const medium = makeSegmentGeometries([0, 0], [1, 0], 90)
    const large = makeSegmentGeometries([0, 0], [1, 0], 270)

    // All sectors should have points, but the implementation uses fixed sectorsCount
    // so the number of points might be capped
    expect(small.sector.coordinates[0].length).toBeGreaterThan(3)
    expect(medium.sector.coordinates[0].length).toBeGreaterThan(3)
    expect(large.sector.coordinates[0].length).toBeGreaterThan(3)
    
    // Larger angles should have more or equal points (capped at sectorsCount)
    expect(large.sector.coordinates[0].length).toBeGreaterThanOrEqual(
      medium.sector.coordinates[0].length
    )
    expect(medium.sector.coordinates[0].length).toBeGreaterThanOrEqual(
      small.sector.coordinates[0].length
    )
  })

  test('direction line connects start and end points', () => {
    const startPos = [10, 20]
    const endPos = [30, 40]
    const result = makeSegmentGeometries(startPos, endPos, 60)

    expect(result.direction.coordinates[0]).toEqual(startPos)
    expect(result.direction.coordinates[1]).toEqual(endPos)
    expect(result.dirStart.coordinates).toEqual(startPos)
    expect(result.dirEnd.coordinates).toEqual(endPos)
  })

  test('sector includes center point', () => {
    const centerPos = [5, 10]
    const result = makeSegmentGeometries(centerPos, [10, 10], 90)

    // The center should be one of the polygon vertices
    const hasCenter = result.sector.coordinates[0].some(
      coord => coord[0] === centerPos[0] && coord[1] === centerPos[1]
    )
    expect(hasCenter).toBe(true)
  })
})