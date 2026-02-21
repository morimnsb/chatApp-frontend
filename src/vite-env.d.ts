/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CHAT_DEBUG?: string;

  readonly VITE_API_URL?: string;

  readonly VITE_API_BASE_REVERB?: string;
  readonly VITE_API_BASE_NODE?: string;
  readonly VITE_API_BASE_NEST?: string;
  readonly VITE_API_BASE_DJANGO?: string;
  readonly VITE_API_BASE_FASTAPI?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "*.png";
declare module "*.jpg";
declare module "*.jpeg";
declare module "*.svg";