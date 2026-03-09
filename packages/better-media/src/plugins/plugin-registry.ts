import type {
  PipelinePlugin,
  PipelineContext,
  HookName,
  MediaRuntime,
  MediaRuntimeHook,
  ValidationResult,
} from "@better-media/core";
import type { HookRegistry, TapInfo } from "./plugin.interface";

const HOOK_NAMES: HookName[] = [
  "upload:init",
  "validation:run",
  "scan:run",
  "storage:write",
  "process:run",
  "upload:complete",
];

function createEmptyRegistry(): HookRegistry {
  const reg = new Map<HookName, TapInfo[]>();
  for (const name of HOOK_NAMES) {
    reg.set(name, []);
  }
  return reg;
}

function createHook(registry: HookRegistry, hookName: HookName): MediaRuntimeHook {
  return {
    tap(
      name: string,
      fn: (ctx: PipelineContext) => Promise<void | ValidationResult>,
      options?: { mode?: "sync" | "background" }
    ) {
      const mode = options?.mode ?? "sync";
      const list = registry.get(hookName)!;
      list.push({ name, fn, mode });
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

/** Check if any handler in the registry is background mode */
export function hasBackgroundHandlers(registry: HookRegistry): boolean {
  for (const handlers of registry.values()) {
    if (handlers.some((h) => h.mode === "background")) return true;
  }
  return false;
}
