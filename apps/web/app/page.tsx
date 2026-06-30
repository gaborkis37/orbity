import { propagate, SHARED_PACKAGE_VERSION, type OmmRecord } from '@orbity/shared';

// A fixed ISS element set — demonstrates the shared SGP4 pipeline end to end.
const ISS_OMM: OmmRecord = {
  OBJECT_NAME: 'ISS (ZARYA)',
  OBJECT_ID: '1998-067A',
  EPOCH: '2024-01-01T12:00:00.000000',
  MEAN_MOTION: 15.4981535,
  ECCENTRICITY: 0.0006703,
  INCLINATION: 51.64,
  RA_OF_ASC_NODE: 208.9163,
  ARG_OF_PERICENTER: 69.9862,
  MEAN_ANOMALY: 290.1986,
  EPHEMERIS_TYPE: 0,
  CLASSIFICATION_TYPE: 'U',
  NORAD_CAT_ID: 25544,
  ELEMENT_SET_NO: 999,
  REV_AT_EPOCH: 12345,
  BSTAR: 0.0001027,
  MEAN_MOTION_DOT: 0.00016717,
  MEAN_MOTION_DDOT: 0,
};

export default function Home() {
  const iss = propagate(ISS_OMM, new Date(ISS_OMM.EPOCH));

  return (
    <main>
      <h1>Orbity</h1>
      <p>Real-time 3D satellite tracker — scaffold ready.</p>
      <p>
        ISS @ epoch (via @orbity/shared v{SHARED_PACKAGE_VERSION}):{' '}
        <strong>{iss.altKm.toFixed(1)} km</strong>, {iss.velocityKmS.toFixed(2)} km/s
      </p>
    </main>
  );
}
