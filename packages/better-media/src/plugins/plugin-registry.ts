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
  type PluginManifest,
  type PluginApi,
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

function createHook(
  registry: HookRegistry,
  hookName: HookName,
  manifest: PluginManifest
): MediaRuntimeHook {
  return {
    tap(
      name: string,
      fn: (ctx: PipelineContext, api: PluginApi) => Promise<void | ValidationResult>,
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
      list.push({ name, fn, mode: effective, manifest });
    },
  };
}

/** Runtime with hooks that use plugin's intensive flag for default mode */
function createPluginRuntime(registry: HookRegistry, plugin: PipelinePlugin): MediaRuntime {
  const hooks = {} as MediaRuntime["hooks"];
  for (const name of HOOK_NAMES) {
    const baseTap = createHook(registry, name, plugin.runtimeManifest).tap;
    hooks[name] = {
      tap(
        handlerName: string,
        fn: (ctx: PipelineContext, api: PluginApi) => Promise<void | ValidationResult>,
        options?: { mode?: "sync" | "background" }
      ) {
        const mode = options?.mode ?? (plugin.intensive ? "background" : "sync");
        baseTap(handlerName, fn, { ...options, mode });
      },
    };
  }
  return { hooks };
}

/** Manifest for the global framework-level runtime */
const SYSTEM_MANIFEST: PluginManifest = {
  id: "better-media-system",
  version: "1.0.0",
  trustLevel: "trusted",
  capabilities: ["file.read", "metadata.write.own", "processing.write.own", "trusted.propose"],
  namespace: "system",
};

/**
 * Build MediaRuntime with hooks that plugins tap into.
 * Legacy plugins with only execute() are auto-tapped to process:run.
 */
export function createMediaRuntime(
  plugins: PipelinePlugin[],
  registry: HookRegistry
): MediaRuntime {
  // Use a system manifest to initialize the global runtime, ensuring it's not "empty"
  const runtime = createPluginRuntime(registry, {
    name: "system",
    runtimeManifest: SYSTEM_MANIFEST,
  } as PipelinePlugin);

  for (const plugin of plugins) {
    // Every plugin (apply or execute) gets a dedicated runtime bound to its manifest
    const pluginRuntime = createPluginRuntime(registry, plugin);

    if (plugin.apply) {
      plugin.apply(pluginRuntime);
    } else if (plugin.execute) {
      const mode = plugin.executionMode ?? (plugin.intensive ? "background" : "sync");
      const wrappedExecute = (ctx: PipelineContext, _api: PluginApi) => plugin.execute!(ctx);

      pluginRuntime.hooks["process:run"].tap(plugin.name, wrappedExecute, { mode });
    }
  }

  return runtime;
}

/**
 * Policy gate for explicitly authorizing trusted plugins.
 * Prevents unauthorized plugins from claiming "trusted" status.
 */
export interface TrustedPluginPolicy {
  isAuthorized(pluginId: string, namespace: string): boolean;
}

/** Default policy: allows only a hardcoded list of internal plugins to be trusted */
const DEFAULT_TRUSTED_POLICY: TrustedPluginPolicy = {
  isAuthorized(id) {
    // In a real app, this might check against a signed allowlist or config
    const allowed = ["better-media-validation"];
    return allowed.includes(id);
  },
};

/**
 * Build hook registry from plugins via apply pattern.
 */
export function buildPluginRegistry(
  plugins: PipelinePlugin[],
  policy: TrustedPluginPolicy = DEFAULT_TRUSTED_POLICY
): {
  registry: HookRegistry;
  runtime: MediaRuntime;
} {
  // 1. Validate all plugins first
  const seenIds = new Set<string>();
  const seenNamespaces = new Set<string>();

  for (const plugin of plugins) {
    validatePlugin(plugin);

    const { id, namespace, trustLevel } = plugin.runtimeManifest;

    // Policy Gate: Block unauthorized trusted plugins
    if (trustLevel === "trusted" && !policy.isAuthorized(id, namespace)) {
      throw new Error(
        `Security Violation: Plugin "${plugin.name}" (${id}) is not authorized for "trusted" status.`
      );
    }

    if (seenIds.has(id)) {
      throw new Error(`Duplicate plugin ID detected: ${id} (Plugin: ${plugin.name})`);
    }
    if (seenNamespaces.has(namespace)) {
      throw new Error(`Duplicate namespace detected: ${namespace} (Plugin: ${plugin.name})`);
    }
    seenIds.add(id);
    seenNamespaces.add(namespace);
  }

  const registry = createEmptyRegistry();
  const runtime = createMediaRuntime(plugins, registry);
  return { registry, runtime };
}

export { HOOK_NAMES };

/**
 * Validates that a plugin has required fields (name, apply or execute)
 * and a valid runtimeManifest.
 * @throws Error if plugin is invalid
 */
export function validatePlugin(plugin: PipelinePlugin): void {
  if (!plugin.name || typeof plugin.name !== "string") {
    throw new Error("Plugin must have a non-empty string name");
  }
  if (!plugin.apply && !plugin.execute) {
    throw new Error(`Plugin "${plugin.name}" must define apply() or execute()`);
  }

  if (!plugin.runtimeManifest) {
    throw new Error(
      `Plugin "${plugin.name}" is missing runtimeManifest. V1 Secure Model requires manifests.`
    );
  }

  const { id, version, trustLevel, capabilities, namespace } = plugin.runtimeManifest;

  if (!id || !version || !namespace) {
    throw new Error(
      `Plugin "${plugin.name}" manifest is missing required fields (id, version, namespace)`
    );
  }

  if (!["untrusted", "trusted"].includes(trustLevel)) {
    throw new Error(`Plugin "${plugin.name}" has invalid trustLevel: ${trustLevel}`);
  }

  if (!Array.isArray(capabilities)) {
    throw new Error(`Plugin "${plugin.name}" capabilities must be an array`);
  }

  // Hard rule: untrusted plugins cannot have trusted.propose capability
  if (trustLevel === "untrusted" && capabilities.includes("trusted.propose")) {
    throw new Error(
      `Untrusted plugin "${plugin.name}" cannot request "trusted.propose" capability`
    );
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
