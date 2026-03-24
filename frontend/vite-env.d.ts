/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MAPBOX_TOKEN: string;
  readonly VITE_API_URL: string;
  readonly VITE_WS_URL: string;
  // Add any other VITE_ variables you use here
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}