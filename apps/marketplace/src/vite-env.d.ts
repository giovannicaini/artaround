/// <reference types="vite/client" />

// Dichiarazione esplicita, non solo affidata a vite/client: se quel
// riferimento non viene risolto (es. node_modules non ancora installato,
// versione di TypeScript diversa), l'import di un'immagine resta comunque
// tipizzato invece di dare "Cannot find module".
declare module '*.png' {
  const src: string;
  export default src;
}
declare module '*.jpg' {
  const src: string;
  export default src;
}
declare module '*.jpeg' {
  const src: string;
  export default src;
}
declare module '*.svg' {
  const src: string;
  export default src;
}

interface ImportMetaEnv {
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly MODE: string;
  readonly BASE_URL: string;
  readonly SSR: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
