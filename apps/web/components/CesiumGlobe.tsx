'use client';

import {
  Cartesian3,
  Math as CesiumMath,
  TileMapServiceImageryProvider,
  Viewer as CesiumViewer,
} from 'cesium';
import { useEffect, useMemo, useRef } from 'react';
import { ImageryLayer, Viewer } from 'resium';
import { DEFAULT_SATELLITE_GROUP, PROPAGATION_TICK_MS } from '@/lib/env';
import { useSatellitePositionPipeline } from '@/lib/propagation';

const CESIUM_BASE_URL = '/_next/static/cesium';

type ViewerRef = {
  cesiumElement?: CesiumViewer;
};

export function CesiumGlobe() {
  const viewerRef = useRef<ViewerRef | null>(null);
  const latestSceneFrame = useRef(-1);
  const latestScenePositions = useRef<Float64Array | null>(null);
  const { latestFrameRef } = useSatellitePositionPipeline(
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

    if (!viewer) {
      return;
    }

    // Cesium consumes only the newest completed worker frame. Task 3.4 plugs
    // its PointPrimitiveCollection updates into this same pre-render boundary.
    return viewer.scene.preRender.addEventListener(() => {
      const frame = latestFrameRef.current;
      if (frame && frame.sequence !== latestSceneFrame.current) {
        latestScenePositions.current = frame.positions;
        latestSceneFrame.current = frame.sequence;
      }
    });
  }, [latestFrameRef]);

  return (
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
  );
}
