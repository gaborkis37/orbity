'use client';

import {
  Cartesian3,
  Math as CesiumMath,
  TileMapServiceImageryProvider,
  Viewer as CesiumViewer,
} from 'cesium';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ImageryLayer, Viewer } from 'resium';
import { DEFAULT_SATELLITE_GROUP, PROPAGATION_TICK_MS } from '@/lib/env';
import { useSatellitePositionPipeline } from '@/lib/propagation';
import {
  SatellitePointRenderer,
  type SatelliteFilter,
} from '@/lib/rendering/satellite-points';
import styles from './CesiumGlobe.module.css';

const CESIUM_BASE_URL = '/_next/static/cesium';

type ViewerRef = {
  cesiumElement?: CesiumViewer;
};

export function CesiumGlobe() {
  const viewerRef = useRef<ViewerRef | null>(null);
  const pointRendererRef = useRef<SatellitePointRenderer | null>(null);
  const latestSceneFrame = useRef(-1);
  const [filter, setFilter] = useState<SatelliteFilter>('all');
  const filterRef = useRef<SatelliteFilter>(filter);
  filterRef.current = filter;
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

    if (!viewer) {
      return;
    }

    viewer.scene.globe.enableLighting = true;
    if (viewer.scene.sun) {
      viewer.scene.sun.show = true;
    }
    viewer.camera.setView({
      destination: Cartesian3.fromDegrees(19, 20, 20_000_000),
      orientation: {
        heading: 0,
        pitch: CesiumMath.toRadians(-90),
        roll: 0,
      },
    });
  }, []);

  useEffect(() => {
    const viewer = viewerRef.current?.cesiumElement;
    if (!viewer || satellites.length === 0) return;

    const renderer = new SatellitePointRenderer(viewer.scene, satellites);
    renderer.setFilter(filterRef.current);
    pointRendererRef.current = renderer;
    latestSceneFrame.current = -1;

    return () => {
      if (pointRendererRef.current === renderer) pointRendererRef.current = null;
      renderer.destroy();
    };
  }, [satellites]);

  useEffect(() => {
    pointRendererRef.current?.setFilter(filter);
  }, [filter]);

  useEffect(() => {
    const viewer = viewerRef.current?.cesiumElement;

    if (!viewer) {
      return;
    }

    return viewer.scene.preRender.addEventListener(() => {
      const frame = latestFrameRef.current;
      const renderer = pointRendererRef.current;
      if (renderer && frame && frame.sequence !== latestSceneFrame.current) {
        renderer.updatePositions(frame.positions);
        latestSceneFrame.current = frame.sequence;
      }
    });
  }, [latestFrameRef]);

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
            data-active={filter === value}
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
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
