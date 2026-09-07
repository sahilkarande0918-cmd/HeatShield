import type { StyleSpecification } from 'maplibre-gl';

/**
 * A deliberately quiet basemap.
 *
 * OpenFreeMap's own `dark` style is too saturated to sit under a heat ramp: a
 * normal basemap competes with the data drawn on top of it. Everything here is
 * pulled down to cool, near-neutral chrome so the risk fill is the only
 * chromatic thing on screen. Roads and water stay legible, because a ward
 * officer has to be able to recognise their own neighbourhood.
 *
 * Free, keyless, no attribution beyond OSM's licence requirement.
 */

// Chrome, so cool and desaturated to match the rest of the interface. The only
// warm colour anywhere on the map is the risk fill on top of this.
const PAPER = '#090d10';
const WATER = '#111a22';
const GREEN = '#0f151a';
const BUILDING = '#1a2129';
const ROAD = '#232b33';
const ROAD_MAJOR = '#2f3942';
const LABEL = '#8b9298';

export function heatShieldMapStyle(): StyleSpecification {
  return {
    version: 8,
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources: {
      openmaptiles: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': PAPER } },
      {
        id: 'landcover',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'landcover',
        paint: { 'fill-color': GREEN },
      },
      {
        id: 'park',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'park',
        paint: { 'fill-color': GREEN },
      },
      {
        id: 'water',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'water',
        paint: { 'fill-color': WATER },
      },
      {
        id: 'waterway',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'waterway',
        paint: { 'line-color': WATER, 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.6, 16, 3] },
      },
      {
        id: 'building',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'building',
        minzoom: 13,
        paint: { 'fill-color': BUILDING, 'fill-opacity': 0.7 },
      },
      {
        id: 'road-minor',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        filter: ['in', ['get', 'class'], ['literal', ['minor', 'service', 'path', 'track']]],
        minzoom: 12,
        paint: {
          'line-color': ROAD,
          'line-width': ['interpolate', ['linear'], ['zoom'], 12, 0.4, 18, 4],
        },
      },
      {
        id: 'road-major',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        filter: [
          'in',
          ['get', 'class'],
          ['literal', ['motorway', 'trunk', 'primary', 'secondary', 'tertiary']],
        ],
        paint: {
          'line-color': ROAD_MAJOR,
          'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.6, 18, 9],
        },
      },
      {
        id: 'place-label',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'place',
        filter: ['in', ['get', 'class'], ['literal', ['city', 'town', 'suburb', 'neighbourhood']]],
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Noto Sans Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 9, 10, 15, 14],
          'text-letter-spacing': 0.06,
          'text-max-width': 8,
        },
        paint: {
          'text-color': LABEL,
          'text-halo-color': PAPER,
          'text-halo-width': 1.4,
        },
      },
    ],
  };
}
