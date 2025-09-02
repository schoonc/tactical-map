import * as turf from "@turf/turf"
import { LineString, Point, Polygon, Position } from "geojson"

type CartesianPoint = number[];
export type SegmentProps = {
  mode: typeof segmentMode,
  dirStartPos: Position,
  dirEndPos: Position,
  sectorAngle: number,
}
export type SegmentGeometries = {
  sector: Polygon
  direction: LineString
  dirStart: Point
  dirEnd: Point
  arcStart: Point
  arcEnd: Point
}

const sectorsCount = 64
export const segmentMode = 'segment'

export function assertDefined<T>(value: T | undefined): asserts value is T {
  if (!value) {
    throw new Error("Value must be defined")
  }
}

export function convertAngleTo360(alpha: number) {
  let beta = alpha % 360
  if (beta < 0) {
    beta += 360
  }
  return Math.abs(beta) /* beta may be -0 */
}

export function between(target: number, start: number, end: number) {
  target = convertAngleTo360(target)
  start = convertAngleTo360(start)
  end = convertAngleTo360(end)
  if (end > start) {
    return target > start && target < end
  } else if (end < start) {
    return !(target >= end && target <= start)
  } else {
    return false
  }
}

export function mercatorDestination(
  [x, y]: CartesianPoint,
  distance: number,
  bearing: number,
) {
  // Convert origin to Web Mercator
  const bearingRad = turf.degreesToRadians(bearing)

  // Calculate the destination coordinates
  const deltaX = distance * Math.cos(bearingRad)
  const deltaY = distance * Math.sin(bearingRad)

  const newX = x + deltaX
  const newY = y + deltaY

  return [newX, newY]
}

export function cartesianDistance (
  pointOne: CartesianPoint,
  pointTwo: CartesianPoint,
) {
  const [x1, y1] = pointOne
  const [x2, y2] = pointTwo
  const y = x2 - x1
  const x = y2 - y1
  return Math.sqrt(x * x + y * y)
};

export function mercatorBearing(
  [x1, y1]: CartesianPoint,
  [x2, y2]: CartesianPoint,
): number {
  const deltaX = x2 - x1
  const deltaY = y2 - y1

  if (deltaX === 0 && deltaY === 0) {
    return 0 // No movement
  }

  // Calculate the angle in radians
  let angle = Math.atan2(deltaY, deltaX)

  // Convert the angle to degrees
  angle = angle * (180 / Math.PI)

  // Normalize to -180 to 180
  if (angle > 180) {
    angle -= 360
  } else if (angle < -180) {
    angle += 360
  }

  return angle
}

export function cartesianAngle(p1: CartesianPoint, center: CartesianPoint, p2: CartesianPoint) {
  const v1 = [p1[0] - center[0], p1[1] - center[1]] 
  const v2 = [p2[0] - center[0], p2[1] - center[1]]
  // Measure clockwise angle from p1 to p2
  const angle = Math.atan2(v2[1], v2[0]) - Math.atan2(v1[1], v1[0])
  return convertAngleTo360(angle * (180 / Math.PI))
}

export function makeSegmentGeometries (
  dirStartPos: Position, 
  dirEndPos: Position, 
  sectorAngle: number,
): SegmentGeometries {
  const merkatorDirStartPos = turf.toMercator(dirStartPos)
  const merkatorDirEndPos = turf.toMercator(dirEndPos)
    
  const dirAzimuth = turf.bearingToAzimuth(mercatorBearing(
    merkatorDirStartPos,
    merkatorDirEndPos
  ))
  const radius = cartesianDistance(merkatorDirStartPos, merkatorDirEndPos)
  const arcStartAzimuth = convertAngleTo360(dirAzimuth - sectorAngle / 2)
  const arcStartPos = turf.toWgs84(mercatorDestination(merkatorDirStartPos, radius, turf.azimuthToBearing(arcStartAzimuth)))
  const arcEndAzimuth = convertAngleTo360(dirAzimuth + sectorAngle / 2)
  const arcEndPos = turf.toWgs84(mercatorDestination(merkatorDirStartPos, radius, turf.azimuthToBearing(arcEndAzimuth)))
  const sector: Polygon = {
    type: 'Polygon',
    coordinates: [
      [
        arcStartPos,
        dirStartPos,
        arcEndPos,
      ]
    ]
  }
  const stepAngle = sectorAngle / sectorsCount
  let sectorNumber = 0
  while (true) {
    sectorNumber++
    if (sectorNumber > sectorsCount) {
      break
    }
    const azimuth = convertAngleTo360(arcEndAzimuth - stepAngle * sectorNumber)
    if (between(azimuth, arcStartAzimuth, arcEndAzimuth)) {
      const pos = turf.toWgs84(mercatorDestination(merkatorDirStartPos, radius, turf.azimuthToBearing(azimuth)))
      sector.coordinates[0].push(pos)
    }
  }
  sector.coordinates[0].push(arcStartPos)

  const direction: LineString = {
    type: 'LineString',
    coordinates: [dirStartPos, dirEndPos]
  }

  const dirStart: Point = {
    type: 'Point',
    coordinates: dirStartPos
  }

  const dirEnd: Point = {
    type: 'Point',
    coordinates: dirEndPos
  }

  const arcStart: Point = {
    type: 'Point',
    coordinates: arcStartPos,
  }

  const arcEnd: Point = {
    type: 'Point',
    coordinates: arcEndPos
  }

  return {
    sector,
    direction,
    dirStart,
    dirEnd,
    arcStart,
    arcEnd,
  }
}

export function preciseRound(number: number, decimals: number) {
  const factor = Math.pow(10, decimals)
  return Math.round((number + Number.EPSILON) * factor) / factor
}