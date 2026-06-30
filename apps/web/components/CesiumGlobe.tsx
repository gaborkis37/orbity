'use client';

import { normalizeOmm, propagateSatrec, type SatelliteState } from '@orbity/shared';
import {
  BoundingSphere,
  Cartesian2,
  Cartesian3,
  HeadingPitchRange,
  Math as CesiumMath,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  TileMapServiceImageryProvider,
  Viewer as CesiumViewer,
  type PointPrimitive,
} from 'cesium';
import { useEffect, useMemo, useRef } from 'react';
import { ImageryLayer, Viewer } from 'resium';
import type { SatelliteRecord } from '@/lib/api';
import { DEFAULT_SATELLITE_GROUP, PROPAGATION_TICK_MS } from '@/lib/env';
import { useSatellitePositionPipeline } from '@/lib/propagation';
import {
  SatellitePointRenderer,
  type SatelliteDisplayFilter,
  type SatelliteFilter,
} from '@/lib/rendering/satellite-points';
import { SelectedOrbitRenderer } from '@/lib/rendering/selected-orbit';
import styles from './CesiumGlobe.module.css';

const CESIUM_BASE_URL = '/_next/static/cesium';

type ViewerRef = { cesiumElement?: CesiumViewer };
type PointId = { noradId: number; satelliteIndex: number };
type PointPick = { primitive?: PointPrimitive; id?: PointId };

interface CesiumGlobeProps {
  displayFilter: SatelliteDisplayFilter;
  selectedNoradId: number | null;
  focusRequest: { noradId: number; sequence: number } | null;
  onDisplayFilterChange: (filter: SatelliteFilter) => void;
  onSatelliteSelect: (satellite: SatelliteRecord | null) => void;
  onTelemetry: (state: SatelliteState | null) => void;
}

function isPointId(value: unknown): value is PointId {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<PointId>;
  return Number.isInteger(candidate.noradId) && Number.isInteger(candidate.satelliteIndex);
}

export function CesiumGlobe({
  displayFilter,
  selectedNoradId,
  focusRequest,
  onDisplayFilterChange,
  onSatelliteSelect,
  onTelemetry,
}: CesiumGlobeProps) {
  const viewerRef = useRef<ViewerRef | null>(null);
  const pointRendererRef = useRef<SatellitePointRenderer | null>(null);
  const latestSceneFrame = useRef(-1);
  const displayFilterRef = useRef(displayFilter);
  const selectedNoradIdRef = useRef(selectedNoradId);
  const selectedSatrecRef = useRef<ReturnType<typeof normalizeOmm>['satrec'] | null>(null);
  const orbitRendererRef = useRef<SelectedOrbitRenderer | null>(null);
  const pendingFocusRef = useRef(focusRequest);
  const onSatelliteSelectRef = useRef(onSatelliteSelect);
  const onTelemetryRef = useRef(onTelemetry);
  displayFilterRef.current = displayFilter;
  selectedNoradIdRef.current = selectedNoradId;
  onSatelliteSelectRef.current = onSatelliteSelect;
  onTelemetryRef.current = onTelemetry;

  const { error, latestFrameRef, phase, satellites } = useSatellitePositionPipeline(
    DEFAULT_SATELLITE_GROUP,
    PROPAGATION_TICK_MS,
  );
  const baseImagery = useMemo(
    () =>
      TileMapServiceImageryProvider.fromUrl(`${CESIUM_BASE_URL}/Assets/Textures/NaturalEarthII`),
    [],
  );

  useEffect(() => {
    const viewer = viewerRef.current?.cesiumElement;
    if (!viewer) return;

    viewer.scene.globe.enableLighting = true;
    if (viewer.scene.sun) viewer.scene.sun.show = true;
    viewer.camera.setView({
      destination: Cartesian3.fromDegrees(19, 20, 20_000_000),
      orientation: { heading: 0, pitch: CesiumMath.toRadians(-90), roll: 0 },
    });
  }, []);

  useEffect(() => {
    const viewer = viewerRef.current?.cesiumElement;
    if (!viewer || satellites.length === 0) return;

    const renderer = new SatellitePointRenderer(viewer.scene, satellites);
    renderer.setFilter(displayFilterRef.current);
    renderer.setSelected(selectedNoradIdRef.current);
    pointRendererRef.current = renderer;
    latestSceneFrame.current = -1;

    return () => {
      if (pointRendererRef.current === renderer) pointRendererRef.current = null;
      renderer.destroy();
    };
  }, [satellites]);

  useEffect(() => {
    pointRendererRef.current?.setFilter(displayFilter);
  }, [displayFilter]);

  useEffect(() => {
    pointRendererRef.current?.setSelected(selectedNoradId);
    const selected = satellites.find((item) => item.meta.noradId === selectedNoradId);
    selectedSatrecRef.current = selected ? normalizeOmm(selected.omm).satrec : null;
    if (!selected) onTelemetryRef.current(null);

    const viewer = viewerRef.current?.cesiumElement;
    if (!viewer || !selected) return;
    const orbit = new SelectedOrbitRenderer(viewer.scene, selected);
    orbitRendererRef.current = orbit;
    return () => {
      if (orbitRendererRef.current === orbit) orbitRendererRef.current = null;
      orbit.destroy(viewer.scene);
    };
  }, [satellites, selectedNoradId]);

  useEffect(() => {
    pendingFocusRef.current = focusRequest;
  }, [focusRequest]);

  useEffect(() => {
    const viewer = viewerRef.current?.cesiumElement;
    if (!viewer) return;

    const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((event: { position: Cartesian2 }) => {
      const picks = viewer.scene.drillPick(event.position, 16, 16) as PointPick[];
      const nearest = picks
        .filter((pick) => pick.primitive && isPointId(pick.id ?? pick.primitive.id))
        .map((pick) => ({
          id: (pick.id ?? pick.primitive?.id) as PointId,
          distance: Cartesian3.distance(viewer.camera.positionWC, pick.primitive!.position),
        }))
        .sort((left, right) => left.distance - right.distance)[0];

      if (nearest) {
        const satellite = satellites[nearest.id.satelliteIndex];
        if (satellite?.meta.noradId === nearest.id.noradId) {
          onSatelliteSelectRef.current(satellite);
        }
      }
    }, ScreenSpaceEventType.LEFT_CLICK);

    return () => handler.destroy();
  }, [satellites]);

  useEffect(() => {
    const viewer = viewerRef.current?.cesiumElement;
    if (!viewer) return;

    return viewer.scene.preRender.addEventListener(() => {
      const frame = latestFrameRef.current;
      const renderer = pointRendererRef.current;
      if (!renderer || !frame || frame.sequence === latestSceneFrame.current) return;

      renderer.updatePositions(frame.positions);
      latestSceneFrame.current = frame.sequence;

      const focus = pendingFocusRef.current;
      if (focus) {
        const index = satellites.findIndex((item) => item.meta.noradId === focus.noradId);
        if (index >= 0) {
          const point = renderer.collection.get(index);
          if (point.show) {
            viewer.camera.flyToBoundingSphere(new BoundingSphere(point.position, 350_000), {
              duration: 1.4,
              offset: new HeadingPitchRange(0, CesiumMath.toRadians(-28), 1_250_000),
            });
            pendingFocusRef.current = null;
            onSatelliteSelectRef.current(satellites[index]);
          }
        } else {
          pendingFocusRef.current = null;
        }
      }

      const satrec = selectedSatrecRef.current;
      if (satrec) {
        try {
          onTelemetryRef.current(propagateSatrec(satrec, new Date(frame.timestamp)));
          orbitRendererRef.current?.update(frame.timestamp);
        } catch {
          onTelemetryRef.current(null);
        }
      }
    });
  }, [latestFrameRef, satellites]);

  return (
    <>
      <Viewer
        ref={viewerRef}
        full
        baseLayer={false}
        animation={false}
        baseLayerPicker={false}
        fullscreenButton={false}
        geocoder={false}
        homeButton={false}
        infoBox={false}
        navigationHelpButton={false}
        projectionPicker={false}
        sceneModePicker={false}
        selectionIndicator={false}
        timeline={false}
        vrButton={false}
        scene3DOnly
        shouldAnimate
        targetFrameRate={60}
      >
        <ImageryLayer imageryProvider={baseImagery} />
      </Viewer>
      <div className={styles.catalogControl} aria-label="Satellite display filter">
        {(['all', 'starlink'] as const).map((value) => (
          <button
            key={value}
            type="button"
            className={styles.filterButton}
            data-active={displayFilter === value}
            aria-pressed={displayFilter === value}
            onClick={() => onDisplayFilterChange(value)}
          >
            {value === 'all' ? 'All objects' : 'Starlink'}
          </button>
        ))}
        <span
          className={styles.catalogStatus}
          data-error={phase === 'error'}
          role="status"
          aria-live="polite"
        >
          {phase === 'running'
            ? `${satellites.length.toLocaleString()} loaded`
            : phase === 'error'
              ? error
              : 'Loading catalog…'}
        </span>
      </div>
    </>
  );
}
