import * as turf from '@turf/turf'
import { LineString, Point } from "geojson"
import { TerraDrawAdapterStyling, TerraDrawExtend, TerraDrawKeyboardEvent, TerraDrawMouseEvent } from "terra-draw"
import { assertDefined, cartesianAngle, convertAngleTo360, makeSegmentGeometries } from "./misc"

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
type SegmentModeStyling = {};

export class TerraDrawSegmentMode extends TerraDrawExtend.TerraDrawBaseDrawMode<SegmentModeStyling> {
  mode = 'segment' as const
  dirStartId: TerraDrawExtend.FeatureId | undefined
  dirEndId: TerraDrawExtend.FeatureId | undefined
  directionId: TerraDrawExtend.FeatureId | undefined
  sectorId: TerraDrawExtend.FeatureId | undefined
  arcStartId: TerraDrawExtend.FeatureId | undefined
  arcEndId: TerraDrawExtend.FeatureId | undefined
  processSectorOnMove = false

  start(): void {
    this.setStarted()
    this.setCursor('crosshair')
  }

  stop(): void {
    this.cleanUp()
    this.setStopped()
    this.setCursor("unset")
  }

  completeFigure () {
    assertDefined(this.arcStartId)
    assertDefined(this.dirStartId)
    assertDefined(this.arcEndId)
    assertDefined(this.dirEndId)
    assertDefined(this.sectorId)

    const finishedId = this.sectorId
    this.cleanUp(true)
    this.sectorId = undefined
    this.onFinish(finishedId, { mode: this.mode, action: "draw" })
  }

  cleanUp(saveSector = false): void {
    if (this.dirStartId) {
      this.store.delete([this.dirStartId])
      this.dirStartId = undefined
    }
    if (this.dirEndId) {
      this.store.delete([this.dirEndId])
      this.dirEndId = undefined
    }
    if (this.directionId) {
      this.store.delete([this.directionId])
      this.directionId = undefined
    }
    if (this.sectorId && !saveSector) {
      this.store.delete([this.sectorId])
      this.sectorId = undefined
    }
    if (this.arcStartId) {
      this.store.delete([this.arcStartId])
      this.arcStartId = undefined
    }
    if (this.arcEndId) {
      this.store.delete([this.arcEndId])
      this.arcEndId = undefined
    }
    this.processSectorOnMove = false
    if (this.state === 'drawing') {
      this.setStarted()
    }
  }

  styleFeature(): TerraDrawAdapterStyling {
    const styles = { ...TerraDrawExtend.getDefaultStyling() }
    return styles
  }
  onClick(event: TerraDrawMouseEvent): void {
    if (!this.directionId) {
      const [startId] = this.store.create([
        {
          geometry: {
            type: "Point",
            coordinates: [event.lng, event.lat],
          },
          properties: {
            mode: this.mode, /* required by terra-draw */
          }
        },
      ])
      const [directionId] = this.store.create([
        {
          geometry: {
            type: "LineString",
            coordinates: [
              [event.lng, event.lat],
              [event.lng, event.lat],
            ],
          },
          properties: {
            mode: this.mode, /* required by terra-draw */
          }
        }
      ])
      this.store.updateProperty([{
        id: directionId,
        property: 'isCreatingStage',
        value: true
      }])
      this.dirStartId = startId
      this.directionId = directionId
      this.setDrawing()
    } else if (!this.sectorId) {
      const [endId] = this.store.create([
        {
          geometry: {
            type: "Point",
            coordinates: [event.lng, event.lat],
          },
          properties: {
            mode: this.mode, /* required by terra-draw */
          }
        },
      ])
      this.dirEndId = endId
      this.processSectorOnMove = true
    } else {
      this.completeFigure()
    }
  }
  makeSegmentGeometries (event: TerraDrawMouseEvent, directionId: TerraDrawExtend.FeatureId) {
    const dir = this.store.getGeometryCopy<LineString>(directionId)
    
    const [dirStartPos, dirEndPos] = dir.coordinates
    const cursorPos = [event.lng, event.lat]

    const mercatorDirStartPos = turf.toMercator(dirStartPos)
    const mercatorDirEndPos = turf.toMercator(dirEndPos)
    const mercatorCursorPos = turf.toMercator(cursorPos)

    const dirCursorAngle = cartesianAngle(mercatorDirEndPos, mercatorDirStartPos, mercatorCursorPos)
    let sectorAngle
    if (dirCursorAngle <= 180) {
      sectorAngle = convertAngleTo360(2 * dirCursorAngle)
    } else {
      sectorAngle = convertAngleTo360(2 * (360 - dirCursorAngle))
    }

    return makeSegmentGeometries(
      dirStartPos,
      dirEndPos,
      sectorAngle,
    )
  }
  onMouseMove(event: TerraDrawMouseEvent) {
    if (this.directionId && !this.processSectorOnMove) {
      const geometry = this.store.getGeometryCopy<LineString>(this.directionId)
      geometry.coordinates[1][0] = event.lng
      geometry.coordinates[1][1] = event.lat
      this.store.updateGeometry([
        {
          id: this.directionId,
          geometry,
        }
      ])
    } else if (this.directionId && this.processSectorOnMove) {
      const sectorGeometries = this.makeSegmentGeometries(event, this.directionId)
      if (!this.sectorId) {
        const [sectorId, arcStartId, arcEndId] = this.store.create([
          {
            geometry: sectorGeometries.sector,
            properties: {
              mode: this.mode, /* required by terra-draw */
            }
          },
          {
            geometry: sectorGeometries.arcStart,
            properties: {
              mode: this.mode, /* required by terra-draw */
            }
          },
          {
            geometry: sectorGeometries.arcEnd,
            properties: {
              mode: this.mode, /* required by terra-draw */
            }
          }
        ])
        this.sectorId = sectorId
        this.arcStartId = arcStartId
        this.arcEndId = arcEndId
      } else {
        assertDefined(this.arcStartId)
        assertDefined(this.arcEndId)
        this.store.updateGeometry([
          {
            id: this.sectorId,
            geometry: sectorGeometries.sector
          },
          {
            id: this.arcStartId,
            geometry: sectorGeometries.arcStart
          },
          {
            id: this.arcEndId,
            geometry: sectorGeometries.arcEnd
          }
        ])
      }

      assertDefined(this.dirStartId)
      assertDefined(this.dirEndId)
      const sectorAngle = cartesianAngle(
        turf.toMercator(this.store.getGeometryCopy<Point>(this.arcStartId).coordinates),
        turf.toMercator(this.store.getGeometryCopy<Point>(this.dirStartId).coordinates),
        turf.toMercator(this.store.getGeometryCopy<Point>(this.arcEndId).coordinates)
      )
      this.store.updateProperty([
        {
          id: this.sectorId,
          property: 'dirStartPos',
          value: this.store.getGeometryCopy<Point>(this.dirStartId).coordinates
        },
        {
          id: this.sectorId,
          property: 'dirEndPos',
          value: this.store.getGeometryCopy<Point>(this.dirEndId).coordinates
        },
        {
          id: this.sectorId,
          property: 'sectorAngle',
          value: sectorAngle
        },
        {
          id: this.sectorId,
          property: 'directionId',
          value: this.directionId
        }
      ])
    }
  }
  onKeyUp(event: TerraDrawKeyboardEvent): void {
    if (event.key === 'Escape') {
      this.cleanUp()
    }

    if (event.key === 'Enter') {
      this.cleanUp()
    }
  }
}