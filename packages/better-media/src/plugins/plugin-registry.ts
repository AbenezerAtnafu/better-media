import {
  HOOK_NAMES,
  resolveHookMode,
  type MediaPlugin,
  type PipelinePlugin,
  type PipelineContext,
  type HookName,
  type HookContext,
  type MediaRuntime,
  type MediaRuntimeHook,
  type ValidationResult,
  type JobAdapter,
} from "@better-media/core";
import { LifecycleEngine } from "../core/lifecycle-engine";
import type { HookRegistry, TapInfo } from "./plugin.interface";

function createEmptyRegistry(): HookRegistry {
  const reg = new Map<HookName, TapInfo[]>();
  for (const name of HOOK_NAMES) {
    reg.set(name, []);
  }
  return reg;
}

function clearRegistry(registry: HookRegistry): void {
  for (const [, list] of registry) {
    list.length = 0;
  }
}

function createHook(registry: HookRegistry, hookName: HookName): MediaRuntimeHook {
  return {
    tap(
      name: string,
      fn: (ctx: PipelineContext) => Promise<void | ValidationResult>,
      options?: { mode?: "sync" | "background" }
    ) {
      const requested = options?.mode ?? "sync";
      const { effective, overridden } = resolveHookMode(hookName, requested);
      if (overridden) {
        console.warn(
          `[better-media] Hook '${hookName}' does not support mode '${requested}'. Overriding to '${effective}'. Plugin: ${name}`
        );
      }
      const list = registry.get(hookName)!;
      list.push({ name, fn, mode: effective });
    },
  };
}

/** Runtime with hooks that use plugin's intensive flag for default mode */
function createPluginRuntime(registry: HookRegistry, plugin: PipelinePlugin): MediaRuntime {
  const hooks = {} as MediaRuntime["hooks"];
  for (const name of HOOK_NAMES) {
    const baseTap = createHook(registry, name).tap;
    hooks[name] = {
      tap(
        handlerName: string,
        fn: (ctx: PipelineContext) => Promise<void | ValidationResult>,
        options?: { mode?: "sync" | "background" }
      ) {
        const mode = options?.mode ?? (plugin.intensive ? "background" : "sync");
        baseTap(handlerName, fn, { ...options, mode });
      },
    };
  }
  return { hooks };
}

/**
 * Build MediaRuntime with hooks that plugins tap into.
 * Legacy plugins with only execute() are auto-tapped to process:run.
 */
export function createMediaRuntime(
  plugins: PipelinePlugin[],
  registry: HookRegistry
): MediaRuntime {
  const baseHooks = {} as MediaRuntime["hooks"];
  for (const name of HOOK_NAMES) {
    baseHooks[name] = createHook(registry, name);
  }
  const runtime: MediaRuntime = { hooks: baseHooks };

  for (const plugin of plugins) {
    if (plugin.apply) {
      const pluginRuntime = createPluginRuntime(registry, plugin);
      plugin.apply(pluginRuntime);
    } else if (plugin.execute) {
      const mode = plugin.executionMode ?? (plugin.intensive ? "background" : "sync");
      runtime.hooks["process:run"].tap(plugin.name, plugin.execute, { mode });
    }
  }

  return runtime;
}

/**
 * Build hook registry from plugins via apply pattern.
 * Bridges legacy execute()-only plugins to process:run.
 */
export function buildPluginRegistry(plugins: PipelinePlugin[]): {
  registry: HookRegistry;
  runtime: MediaRuntime;
} {
  const registry = createEmptyRegistry();
  const runtime = createMediaRuntime(plugins, registry);
  return { registry, runtime };
}

export { HOOK_NAMES };

/**
 * Validates that a plugin has required fields (name, apply or execute).
 * @throws Error if plugin is invalid
 */
export function validatePlugin(plugin: MediaPlugin): void {
  if (!plugin.name || typeof plugin.name !== "string") {
    throw new Error("Plugin must have a non-empty string name");
  }
  if (!plugin.apply && !plugin.execute) {
    throw new Error(`Plugin "${plugin.name}" must define apply() or execute()`);
  }
}

/**
 * PluginRegistry: register plugins, maintain hook maps, execute hooks.
 * Allows dynamic registration and type-safe hook execution.
 *
 * @example
 * ```ts
 * const registry = new PluginRegistry(jobAdapter);
 * registry.register(validationPlugin());
 * registry.register(thumbnailPlugin({ mode: "background" }));
 *
 * await registry.executeHook("validation:run", context);
 * ```
 */
export class PluginRegistry {
  private readonly plugins: MediaPlugin[] = [];
  private readonly registry: HookRegistry = createEmptyRegistry();
  private readonly engine: LifecycleEngine;

  constructor(jobAdapter: JobAdapter, initialPlugins: MediaPlugin[] = []) {
    this.engine = new LifecycleEngine(this.registry, jobAdapter);
    for (const plugin of initialPlugins) {
      this.register(plugin);
    }
  }

  /** Register a plugin and rebuild the hook map */
  register(plugin: MediaPlugin): void {
    validatePlugin(plugin);
    this.plugins.push(plugin);
    clearRegistry(this.registry);
    createMediaRuntime(this.plugins, this.registry);
  }

  /** Get all registered plugins (shallow copy) */
  getPlugins(): MediaPlugin[] {
    return [...this.plugins];
  }

  /**
   * Execute all handlers for a hook. Runs sync handlers in series.
   * Enqueues background handlers via JobAdapter.
   * @returns ValidationResult if validation phase aborts (valid: false)
   */
  async executeHook(hookName: HookName, context: HookContext): Promise<void | ValidationResult> {
    return this.engine.trigger(hookName, context);
  }

  /** Access the internal hook registry (for framework wiring) */
  getRegistry(): HookRegistry {
    return this.registry;
  }
}

/** Check if any handler in the registry is background mode */
export function hasBackgroundHandlers(registry: HookRegistry): boolean {
  for (const handlers of registry.values()) {
    if (handlers.some((h) => h.mode === "background")) return true;
  }
  return false;
}
