/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE: string;   // << add this
  readonly VITE_FROM_POOL: string;  // << and this if you use it
  // existing keys…
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
