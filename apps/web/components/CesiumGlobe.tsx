'use client';

import {
  Cartesian3,
  Math as CesiumMath,
  TileMapServiceImageryProvider,
  Viewer as CesiumViewer,
} from 'cesium';
import { useEffect, useMemo, useRef } from 'react';
import { ImageryLayer, Viewer } from 'resium';

const CESIUM_BASE_URL = '/_next/static/cesium';

type ViewerRef = {
  cesiumElement?: CesiumViewer;
};

export function CesiumGlobe() {
  const viewerRef = useRef<ViewerRef | null>(null);
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
