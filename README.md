# What is it?

Tactical map based on:
- [Maplibre](https://maplibre.org/) - map rendering
- [Terra draw](https://terradraw.io/) - shape drawing
- [Maplibre GL Terra Draw](https://terradraw.water-gis.com/) - ready-to-use drawing controls

In addition to built-in shapes, a custom `Segment` shape is implemented. Similar to the built-in `Sector`, but:
- Radius and angle are specified during creation
- Only key parameters (radius and angle) are editable. Unlike built-in shapes,
  where any shape points can be moved
- Displays angle and radius measurements

# How to run dev?

1. `npm i`
1. `npm run dev`
