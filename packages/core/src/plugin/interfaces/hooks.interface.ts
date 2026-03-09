/** Plugin lifecycle hooks (extensible) */
export interface PluginHooks {
  /** Hook names → handlers. Structure for future use. */
  [key: string]: (...args: unknown[]) => Promise<void>;
}
