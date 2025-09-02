import * as turf from '@turf/turf'
import { Feature, LineString, Point, Position } from "geojson"
import { TerraDrawExtend, TerraDrawSelectMode } from "terra-draw"
import { segmentMode, cartesianAngle, assertDefined, cartesianDistance, convertAngleTo360, makeSegmentGeometries, mercatorBearing, mercatorDestination, SegmentGeometries, SegmentProps } from "./misc"

type SegmentData = {
  sectorId: TerraDrawExtend.FeatureId,
  directionId: TerraDrawExtend.FeatureId,
  dirStartId: TerraDrawExtend.FeatureId,
  dirEndId: TerraDrawExtend.FeatureId,
  arcStartId: TerraDrawExtend.FeatureId,
  arcEndId: TerraDrawExtend.FeatureId,
}

export class SegmentEditing {
  static instance: SegmentEditing | undefined
  segmentData: SegmentData | undefined
  movedFeature: Feature | undefined
  constructor(
    public store: TerraDrawSelectMode['store']
  ) {
    this.store = store
    SegmentEditing.instance = this
  }

  init (featureId: TerraDrawExtend.FeatureId, props: SegmentProps) {
    this.createSegmentFeatures(featureId, props)
  }

  destroy () {
    this.cleanSegmentFeatures()
    SegmentEditing.instance = undefined
  }

  mustHandleMapMousedownEvent (feature: Feature) {
    if (['dirStart', 'dirEnd', 'arcStart', 'arcEnd'].includes(feature?.properties?.segmentControlType)) {
      this.movedFeature = feature
      return true
    } else {
      return false
    }
  }

  onMapMousemove (cursorPos: Position) {
    if (this.movedFeature) {
      const segmentControlType = this.movedFeature?.properties?.segmentControlType
      if (segmentControlType === 'dirEnd') {
        this.updateByDirEnd(cursorPos)
      } else if (segmentControlType === 'arcStart' || segmentControlType === 'arcEnd') {
        this.updateByArcStartOrEnd(cursorPos)
      }
    }
  }

  resetMoving () {
    this.movedFeature = undefined
  }

  cleanSegmentFeatures () {
    if (this.segmentData) {
      const toDelete = []
      for (const [key, featureId] of Object.entries(this.segmentData)) {
        if (key !== 'sectorId') {
          toDelete.push(featureId)
        }
      }
      this.store.delete(toDelete)
      this.segmentData = undefined
    }
  }

  createSegmentFeatures(featureId: TerraDrawExtend.FeatureId, props: SegmentProps) {
    this.segmentData = {
      sectorId: featureId
    } as SegmentData
    const segmentGeometries = makeSegmentGeometries(
      props.dirStartPos,
      props.dirEndPos,
      props.sectorAngle,
    )

    const arr: {
      geometry: Point | LineString, 
      properties: {
        mode: typeof segmentMode, 
        segmentControlType?: 'dirStart' | 'arcStart' | 'dirEnd'| 'arcEnd'
      }
    }[] = [
      {
        geometry: {
          type: 'Point',
          coordinates: segmentGeometries.dirStart.coordinates
        },
        properties: {
          mode: segmentMode,
          segmentControlType: 'dirStart',
        }
      },
      {
        geometry: {
          type: 'Point',
          coordinates: segmentGeometries.arcStart.coordinates
        },
        properties: {
          mode: segmentMode,
          segmentControlType: 'arcStart',
        }
      },
      {
        geometry: {
          type: 'Point',
          coordinates: segmentGeometries.dirEnd.coordinates
        },
        properties: {
          mode: segmentMode,
          segmentControlType: 'dirEnd',
        }
      },
      {
        geometry: {
          type: 'Point',
          coordinates: segmentGeometries.arcEnd.coordinates
        },
        properties: {
          mode: segmentMode,
          segmentControlType: 'arcEnd',
        }
      },
      {
        geometry: {
          type: 'LineString',
          coordinates: segmentGeometries.direction.coordinates
        },
        properties: {
          mode: segmentMode,
        }
      }
    ]
    const ids = this.store.create(arr)

    for (let i = 0; i < ids.length; i++) {
      const featureId = ids[i]
      const feature = arr[i]
      this.store.updateProperty([{
        id: featureId,
        property: 'terraDrawId',
        value: featureId
      }])
      if (feature.geometry.type === 'LineString') {
        this.segmentData[`directionId`] = featureId
      }
      if (feature.properties.segmentControlType) {
        this.segmentData[`${feature.properties.segmentControlType}Id`] = featureId
      }
    }
  }

  update (segmentGeometries: SegmentGeometries, sectorAngle: number) {
    assertDefined(this.segmentData)
    this.store.updateGeometry([
      {
        id: this.segmentData.sectorId,
        geometry: segmentGeometries.sector
      },
      {
        id: this.segmentData.directionId,
        geometry: segmentGeometries.direction
      },
      {
        id: this.segmentData.dirStartId,
        geometry: segmentGeometries.dirStart
      },
      {
        id: this.segmentData.dirEndId,
        geometry: segmentGeometries.dirEnd
      },
      {
        id: this.segmentData.arcStartId,
        geometry: segmentGeometries.arcStart
      },
      {
        id: this.segmentData.arcEndId,
        geometry: segmentGeometries.arcEnd
      },
    ])
    
    this.store.updateProperty([
      {
        id: this.segmentData.sectorId,
        property: 'sectorAngle',
        value: sectorAngle
      },
      {
        id: this.segmentData.sectorId,
        property: 'dirStartPos',
        value: segmentGeometries.dirStart.coordinates
      },
      {
        id: this.segmentData.sectorId,
        property: 'dirEndPos',
        value: segmentGeometries.dirEnd.coordinates
      },
    ])
  }

  updateByArcStartOrEnd (cursorPos: Position) {
    assertDefined(this.segmentData)
    const dirGeometry = this.store.getGeometryCopy<LineString>(this.segmentData.directionId)

    const [dirStartPos, dirEndPos] = dirGeometry.coordinates

    const mercatorDirStartPos = turf.toMercator(dirStartPos)
    const mercatorCursorPos = turf.toMercator(cursorPos)
    const mercatorDirEndPos = turf.toMercator(dirEndPos)

    const dirCursorAngle = cartesianAngle(mercatorDirEndPos, mercatorDirStartPos, mercatorCursorPos)
    let sectorAngle
    if (dirCursorAngle <= 180) {
      sectorAngle = convertAngleTo360(2 * dirCursorAngle)
    } else {
      sectorAngle = convertAngleTo360(2 * (360 - dirCursorAngle))
    }

    const segmentGeometries = makeSegmentGeometries(
      dirStartPos,
      dirEndPos,
      sectorAngle
    )
  
    this.update(segmentGeometries, sectorAngle)
  }

  updateByDirEnd (cursorPos: Position) {
    assertDefined(this.segmentData)
    const dirGeometry = this.store.getGeometryCopy<LineString>(this.segmentData.directionId)
    const sectorProperties = this.store.getPropertiesCopy(this.segmentData.sectorId) as SegmentProps

    const [dirStartPos] = dirGeometry.coordinates

    const mercatorDirStartPos = turf.toMercator(dirStartPos)
    const mercatorCursorPos = turf.toMercator(cursorPos)

    const radius = cartesianDistance(mercatorDirStartPos, mercatorCursorPos)
    const cursorAzimuth = turf.bearingToAzimuth(mercatorBearing(
      mercatorDirStartPos,
      mercatorCursorPos
    ))
    const cursorOnArcPos = turf.toWgs84(mercatorDestination(mercatorDirStartPos, radius, turf.azimuthToBearing(cursorAzimuth)))
    const currentSectorAngle = sectorProperties.sectorAngle

    const segmentGeometries = makeSegmentGeometries(
      dirStartPos,
      cursorOnArcPos,
      currentSectorAngle
    )

    this.update(segmentGeometries, currentSectorAngle)
  }
}