import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const CopyWebpackPlugin = require('copy-webpack-plugin');
const cesiumBuildDirectory = path.join(
  path.dirname(require.resolve('cesium/package.json')),
  'Build',
  'Cesium',
);
const cesiumBaseUrl = '/_next/static/cesium';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack(config, { isServer, webpack }) {
    config.plugins.push(
      new webpack.DefinePlugin({
        CESIUM_BASE_URL: JSON.stringify(cesiumBaseUrl),
      }),
    );

    if (!isServer) {
      config.plugins.push(
        new CopyWebpackPlugin({
          patterns: ['Workers', 'ThirdParty', 'Assets', 'Widgets'].map((directory) => ({
            from: path.join(cesiumBuildDirectory, directory),
            to: path.join('static', 'cesium', directory),
            info: { minimized: true },
          })),
        }),
      );
    }

    return config;
  },
};

export default nextConfig;
