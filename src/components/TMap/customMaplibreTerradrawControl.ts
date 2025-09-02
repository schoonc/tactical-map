import { MaplibreTerradrawControl, TerradrawControlOptions } from "@watergis/maplibre-gl-terradraw"

export class CustomMaplibreTerradrawControl extends MaplibreTerradrawControl {
  constructor(
    options?: TerradrawControlOptions, 
    public onChange?: () => void, 
    public onReady?: () => void,
    public onFeatureDeleted?: () => void
  ) {
    super(options)
    this.onChange = onChange
    this.onReady = onReady
    this.onFeatureDeleted = onFeatureDeleted
  }
  onAdd(map: maplibregl.Map): HTMLElement {
    const result = super.onAdd(map)
    const td = this.getTerraDrawInstance()
    td.on('change', () => {
      this.onChange?.()
    })
    this.on('feature-deleted', () => {
      this.onFeatureDeleted?.()
    })
    
    td.on('ready', () => {
      this.onReady?.()
    })
    return result
  }
}