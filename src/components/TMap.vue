<template>
  <div ref="mapEl" />
</template>

<script setup lang="ts">
import maplibregl from 'maplibre-gl';
import { onBeforeUnmount, onMounted, ref } from "vue";

import * as turf from "@turf/turf";
import '@watergis/maplibre-gl-terradraw/dist/maplibre-gl-terradraw.css';
import { throttle } from 'lodash';
import 'maplibre-gl/dist/maplibre-gl.css';
import { CustomMaplibreTerradrawControl } from './customMaplibreTerradrawControl';
import { CustomSelectMode } from './customSelectMode';
import { cartesianDistance, preciseRound } from './misc';
import { SegmentEditing } from './segmentEditing';
import { TerraDrawSegmentMode } from './terraDrawSegmentMode';

const showData = throttle(() => {
  const td = control.getTerraDrawInstance()
  const features = td.getSnapshot()
  
  const handled = new Map()
  for (const feature of features) {
    if (feature.geometry.type === 'LineString' && feature.properties.mode === 'segment' && feature.properties.isCreatingStage) {
      const merkatorDirStartPos = turf.toMercator(feature.geometry.coordinates[0])
      const merkatorCursorPos = turf.toMercator(feature.geometry.coordinates[1])

      const radius = preciseRound(cartesianDistance(merkatorDirStartPos, merkatorCursorPos), 0)
      const textData = {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: feature.geometry.coordinates[0]
        },
        properties: {
          text: `Radius: ${radius} m\n` +
            `Angle: ${preciseRound(0, 2)} °`,
        }
      }
      handled.set(feature.id, textData)
    }
  }
  for (const feature of features) {
    if (feature.geometry.type === 'Polygon' && feature.properties.mode === 'segment' && feature.properties.directionId) {
      handled.delete(feature.properties.directionId)
      const merkatorDirStartPos = turf.toMercator(feature.properties.dirStartPos as [number, number])
      const merkatorCursorPos = turf.toMercator(feature.properties.dirEndPos as [number, number])

      const radius = preciseRound(cartesianDistance(merkatorDirStartPos, merkatorCursorPos), 0)
      const textData = {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: feature.properties.dirStartPos
        },
        properties: {
          text: `Radius: ${radius} m\n` +
            `Angle: ${preciseRound(feature.properties.sectorAngle as number, 2)} °`,
        }
      }
      handled.set(feature.properties.directionId, textData)
    }
  }

  if (!map.getSource('segment-texts')) {
    map.addSource('segment-texts', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [...handled.values()]
      }
    })
    
    map.addLayer({
      id: 'polygon-area-labels',
      type: 'symbol',
      source: 'segment-texts',
      layout: {
        'text-field': ['get', 'text'],
        'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
        'text-size': 14,
        'text-anchor': 'center',
        'text-allow-overlap': true
      },
      paint: {
        'text-color': '#000000',
        'text-halo-color': '#ffffff',
        'text-halo-width': 2
      }
    })
  } else {
    const source = map.getSource('segment-texts') as maplibregl.GeoJSONSource | undefined
    source?.setData({
      type: 'FeatureCollection',
      features: [...handled.values()]
    })
  }
}, 50)

const mapEl = ref();
let map: maplibregl.Map
let control: CustomMaplibreTerradrawControl
let tid: ReturnType<typeof setTimeout>
onMounted(() => {
  map = new maplibregl.Map({
    container: mapEl.value, // container
    // style: 'https://demotiles.maplibre.org/globe.json', // style URL
    style: 'https://demotiles.maplibre.org/style.json', // style URL
    center: [0, 0], // starting position [lng, lat]
    zoom: 1, // starting zoom,
    renderWorldCopies: false
  });

  control = new CustomMaplibreTerradrawControl({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      modes: ['render','point','linestring','polygon','rectangle','circle','freehand','freehand-linestring','angled-rectangle','sensor','sector', 'segment', 'select','delete-selection','delete','download'] as any,
      open: true,
      modeOptions: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        segment: new TerraDrawSegmentMode() as any,
        select: new CustomSelectMode()
      },
  }, () => {
    showData()
  }, () => {
    tid = setTimeout(showData, 100)
  });
  map.addControl(control, 'top-left');
  map.on('mousedown', (ev) => {
    const features = map.queryRenderedFeatures(ev.point)
    const feature = features?.[0]
    if (SegmentEditing.instance && SegmentEditing.instance.mustHandleMapMousedownEvent(feature)) {
      ev.preventDefault()
    }
  })
  map.on('mouseup', () => {
    if (SegmentEditing.instance) {
      SegmentEditing.instance.resetMoving()
    }
  })
  map.on('mousemove', (ev) => {
    if (SegmentEditing.instance) {
      SegmentEditing.instance.onMapMousemove(ev.lngLat.toArray())
    }
  })
})
onBeforeUnmount(() => {
  clearTimeout(tid)
  map?.remove()
})
</script>

<style>
.maplibregl-map {
  height: 100%;
}
.maplibregl-terradraw-add-segment-button {
  background: url("data:image/svg+xml;charset=utf-8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' fill='%235f6368' viewBox='0 -960 960 960'><path d='M720-160q0-116-44-218T556-556 378-676t-218-44v-80q132 0 248.5 50.5T612-612t137.5 203.5T800-160z'/><path d='M160.376-731.677h81.356v564.897h-81.356z' style='stroke-width:39.5568'/><path d='M160.457-237.664H731.6v77.288H160.457Z' style='stroke-width:40.058'/><path d='M160-160 L560-560' stroke='%235f6368' stroke-width='40' fill='none'/></svg>");
  background-position: 50%;
  background-repeat: no-repeat;
  background-size: 100%;
}
</style>

