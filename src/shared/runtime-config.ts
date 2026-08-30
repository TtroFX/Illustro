export type RuntimeBuildMode = 'production' | 'development';

export interface RuntimeConfig {
  readonly buildMode: RuntimeBuildMode;
  readonly serviceWorkerUrl: string;
  readonly manifestUrl: string;
  readonly staticAssetBaseUrl: string;
}

function readBuildMode(): RuntimeBuildMode {
  const value = document.querySelector<HTMLMetaElement>('meta[name="illustro-build-mode"]')?.content;
  return value === 'development' ? 'development' : 'production';
}

export function getRuntimeConfig(): Readonly<RuntimeConfig> {
  return Object.freeze({
    buildMode: readBuildMode(),
    serviceWorkerUrl: './service-worker.js',
    manifestUrl: './manifest.webmanifest',
    staticAssetBaseUrl: './assets/',
  });
}
