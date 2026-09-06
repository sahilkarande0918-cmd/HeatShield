'use client';

import * as maplibregl from 'maplibre-gl';
import type { GeoJSONSource, MapGeoJSONFeature, MapMouseEvent } from 'maplibre-gl';
import { useEffect, useRef } from 'react';
import type { City } from '@/lib/cities';
import { heatShieldMapStyle } from '@/lib/mapStyle';
import { RISK_STOPS } from '@/lib/risk';
import 'maplibre-gl/dist/maplibre-gl.css';

export type CellProps = {
  id: number;
  risk: number;
  feelsLikeC: number;
  regionalC: number;
  vulnerability: number;
  heatProxy: number;
  buildingDensity: number;
  greenCover: number;
  waterProximity: number;
  population: number;
  lat: number;
  lng: number;
};

export type SiteMarker = { lat: number; lng: number; covered: number; rank: number };

type Props = {
  city: City;
  cells: GeoJSON.FeatureCollection | null;
  facilities: { lat: number; lng: number; kind: string; name: string | null }[];
  proposed: SiteMarker[];
  showFacilities: boolean;
  selectedId: number | null;
  onSelect: (cell: CellProps | null) => void;
  /** Bumping this value re-centres the map on the city. */
  resetToken: number;
};

const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

// See scripts/copy-maplibre-worker.mjs. Without this the worker 404s in both
// dev and production and the map renders as an empty rectangle.
maplibregl.setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');

export default function RiskMap({
  city,
  cells,
  facilities,
  proposed,
  showFacilities,
  selectedId,
  onSelect,
  resetToken,
}: Props) {
  const holder = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const ready = useRef(false);
  // Handlers change every render; keep them behind a ref so the map is built
  // exactly once instead of being torn down on every parent update.
  // Handlers and data are mirrored into refs so the map is built exactly once
  // instead of being torn down on every parent update, and so the style-load
  // handler can see data that arrived before the style did. Assigned in an
  // effect rather than during render; the `load` event always fires after
  // effects have flushed, so it never reads a stale value.
  const onSelectRef = useRef(onSelect);
  const latest = useRef({ cells, facilities, proposed, showFacilities });
  useEffect(() => {
    onSelectRef.current = onSelect;
    latest.current = { cells, facilities, proposed, showFacilities };
  });

  useEffect(() => {
    if (!holder.current || map.current) return;

    const m = new maplibregl.Map({
      container: holder.current,
      style: heatShieldMapStyle(),
      center: city.center,
      zoom: city.initialZoom,
      attributionControl: false,
      // Judges will drag. Keep them inside the seeded area, where the data is.
      maxBounds: [
        [city.bbox[0] - 0.12, city.bbox[1] - 0.12],
        [city.bbox[2] + 0.12, city.bbox[3] + 0.12],
      ],
    });
    map.current = m;
    (window as unknown as { __hsMap?: unknown }).__hsMap = m;
    m.on('error', (e) => console.error('[maplibre]', e.error?.message ?? e));

    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
    m.addControl(
      new maplibregl.AttributionControl({
        compact: true,
        customAttribution: '© OpenStreetMap · OpenFreeMap · Open-Meteo',
      }),
      'bottom-left',
    );

    m.on('load', () => {
      m.addSource('cells', { type: 'geojson', data: EMPTY, promoteId: 'id' });
      m.addSource('facilities', { type: 'geojson', data: EMPTY });
      m.addSource('proposed', { type: 'geojson', data: EMPTY });

      m.addLayer({
        id: 'cells-fill',
        type: 'fill',
        source: 'cells',
        paint: {
          'fill-color': ['interpolate', ['linear'], ['get', 'risk'], ...RISK_STOPS],
          // Low-risk cells nearly disappear so the eye goes to the pockets
          // that matter instead of a wall of uniform colour.
          'fill-opacity': [
            'interpolate',
            ['linear'],
            ['get', 'risk'],
            0,
            0.12,
            40,
            0.42,
            100,
            0.78,
          ],
        },
      });

      m.addLayer({
        id: 'cells-selected',
        type: 'line',
        source: 'cells',
        filter: ['==', ['get', 'id'], -1],
        paint: { 'line-color': '#f5f1ec', 'line-width': 2 },
      });

      m.addLayer({
        id: 'facilities-dots',
        type: 'circle',
        source: 'facilities',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 2.2, 15, 5],
          'circle-color': '#f5f1ec',
          'circle-opacity': 0.55,
          'circle-stroke-width': 0.5,
          'circle-stroke-color': '#120805',
        },
      });

      m.addLayer({
        id: 'proposed-ring',
        type: 'circle',
        source: 'proposed',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 8, 15, 22],
          'circle-color': '#4bd6ff',
          'circle-opacity': 0.18,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#4bd6ff',
        },
      });
      m.addLayer({
        id: 'proposed-label',
        type: 'symbol',
        source: 'proposed',
        layout: {
          'text-field': ['get', 'rank'],
          'text-font': ['Noto Sans Regular'],
          'text-size': 12,
          'text-allow-overlap': true,
        },
        paint: { 'text-color': '#04141a', 'text-halo-color': '#4bd6ff', 'text-halo-width': 1.6 },
      });

      m.on('click', 'cells-fill', (e: MapMouseEvent & { features?: MapGeoJSONFeature[] }) => {
        const f = e.features?.[0] as MapGeoJSONFeature | undefined;
        if (f) onSelectRef.current(f.properties as unknown as CellProps);
      });
      m.on('click', (e: MapMouseEvent) => {
        if (m.queryRenderedFeatures(e.point, { layers: ['cells-fill'] }).length === 0) {
          onSelectRef.current(null);
        }
      });
      m.on('mouseenter', 'cells-fill', () => (m.getCanvas().style.cursor = 'pointer'));
      m.on('mouseleave', 'cells-fill', () => (m.getCanvas().style.cursor = ''));

      ready.current = true;
      const now = latest.current;
      setData(m, 'cells', now.cells ?? EMPTY);
      setData(m, 'facilities', facilityCollection(now.facilities, now.showFacilities));
      setData(m, 'proposed', proposedCollection(now.proposed));
    });

    return () => {
      m.remove();
      map.current = null;
      ready.current = false;
    };
    // Rebuilt only when the city changes — a new city is a genuinely new map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city.key]);

  useEffect(() => {
    if (map.current && ready.current) setData(map.current, 'cells', cells ?? EMPTY);
  }, [cells]);

  useEffect(() => {
    if (!map.current || !ready.current) return;
    setData(map.current, 'facilities', facilityCollection(facilities, showFacilities));
  }, [facilities, showFacilities]);

  useEffect(() => {
    if (!map.current || !ready.current) return;
    setData(map.current, 'proposed', proposedCollection(proposed));
  }, [proposed]);

  useEffect(() => {
    if (!map.current || !ready.current) return;
    map.current.setFilter('cells-selected', ['==', ['get', 'id'], selectedId ?? -1]);
  }, [selectedId]);

  useEffect(() => {
    if (!map.current || resetToken === 0) return;
    map.current.easeTo({ center: city.center, zoom: city.initialZoom, duration: 700 });
  }, [resetToken, city]);

  // h-full, not `absolute inset-0`: maplibre-gl.css sets `.maplibregl-map
  // { position: relative }` on this same node and wins on specificity, which
  // collapses an inset-positioned container to zero height.
  return <div ref={holder} className="h-full w-full" />;
}

function facilityCollection(
  facilities: Props['facilities'],
  show: boolean,
): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: show
      ? facilities.map((f) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [f.lng, f.lat] },
          properties: { kind: f.kind, name: f.name },
        }))
      : [],
  };
}

function proposedCollection(proposed: SiteMarker[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: proposed.map((p) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      properties: { rank: String(p.rank), covered: p.covered },
    })),
  };
}

function setData(m: maplibregl.Map, id: string, data: GeoJSON.FeatureCollection) {
  const src = m.getSource(id) as GeoJSONSource | undefined;
  if (src) src.setData(data);
}
