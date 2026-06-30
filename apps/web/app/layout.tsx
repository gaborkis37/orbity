import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Orbity — Real-time 3D satellite tracker',
    template: '%s · Orbity',
  },
  description:
    'Track the live satellite catalog on a 3D Earth. Search Starlink, fly to the ISS, and inspect any object’s live altitude, velocity, and orbit.',
  applicationName: 'Orbity',
  openGraph: {
    title: 'Orbity — Real-time 3D satellite tracker',
    description: 'Live 3D view of the satellite catalog, propagated in your browser.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#05060a',
  width: 'device-width',
  initialScale: 1,
  // The globe owns gestures; prevent the page itself from zooming.
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
