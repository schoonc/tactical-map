import { TerraDrawExtend, TerraDrawMouseEvent, TerraDrawSelectMode } from "terra-draw"
import { SegmentEditing } from "./segmentEditing"
import { segmentMode, SegmentProps } from "./misc"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isSegmentProps = (props: any): props is SegmentProps => {
  return props?.mode === segmentMode
}

export class CustomSelectMode extends TerraDrawSelectMode {
  cleanUp(): void {
    this.destroySegmentEditing()
    super.cleanUp()
  }
  initSegmentEditing (featureId: TerraDrawExtend.FeatureId, props: SegmentProps) {
    new SegmentEditing(this.store)
    SegmentEditing.instance!.init(featureId, props)
  }
  destroySegmentEditing () {
    SegmentEditing.instance?.destroy()
  }
  onClick(event: TerraDrawMouseEvent): void {
    const features = this.store.search({
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [event.lng, event.lat],
            [event.lng, event.lat],
            [event.lng, event.lat],
            [event.lng, event.lat],
          ]
        ]
      },
      properties: {}
    })

    const feature = features?.[0]
    const props = feature?.properties
    if (isSegmentProps(props)) {
      if (SegmentEditing.instance && SegmentEditing.instance.segmentData!.sectorId !== feature.id) {
        this.destroySegmentEditing()
      }
      if (!SegmentEditing.instance) {
        this.initSegmentEditing(feature.id!, props)
      }
    } else {
      this.destroySegmentEditing()
      return super.onClick(event)
    }
  }
}