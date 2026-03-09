import type {
  PipelinePlugin,
  PipelineContext,
  HookName,
  MediaRuntime,
  MediaRuntimeHook,
  ValidationResult,
} from "@better-media/core";

const HOOK_NAMES: HookName[] = [
  "upload:init",
  "validation:run",
  "scan:run",
  "process:run",
  "storage:write",
];

/** Single tapped handler entry */
export interface TapInfo {
  name: string;
  fn: (ctx: PipelineContext) => Promise<void | ValidationResult>;
  mode: "sync" | "background";
  stage?: number;
}

/** Registry: hook name -> ordered list of handlers */
export type HookRegistry = Map<HookName, TapInfo[]>;

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

/**
 * Build MediaRuntime with hooks that plugins tap into.
 * Legacy plugins with only execute() are auto-tapped to process:run.
 */
export function createMediaRuntime(
  plugins: PipelinePlugin[],
  registry: HookRegistry
): MediaRuntime {
  const hooks = {} as MediaRuntime["hooks"];
  for (const name of HOOK_NAMES) {
    hooks[name] = createHook(registry, name);
  }

  const runtime: MediaRuntime = { hooks };

  for (const plugin of plugins) {
    if (plugin.apply) {
      plugin.apply(runtime);
    } else if (plugin.execute) {
      const mode = plugin.executionMode ?? "sync";
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
