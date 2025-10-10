

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_FRONTEND_URL: string
  readonly VITE_LOG_LEVEL?: string
  readonly VITE_OLLAMA_BASE_URL?: string
  readonly DEV: boolean
  readonly PROD: boolean
  readonly MODE: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}