import {
  type PipelineContext,
  type PipelineContextWithVerified,
  type PluginApi,
  type TrustedMetadata,
  TrustedMetadataSchema,
} from "@better-media/core";

/** Internal context with audit log (provenance uses PipelineContextWithVerified) */
export type SecureAuditContext = PipelineContextWithVerified & {
  _auditLog?: Array<{
    timestamp: string;
    plugin: string;
    action: string;
    patch: TrustedMetadata;
  }>;
};

/**
 * Creates a Secure Context Proxy and Plugin API for a specific plugin.
 */
export function createSecureContext(
  context: PipelineContext,
  pluginName: string,
  namespace: string,
  trustLevel: string,
  capabilities: string[]
): { proxy: PipelineContext; api: PluginApi } {
  // 1. Create the API implementation
  const api: PluginApi = {
    emitMetadata(patch: Record<string, unknown>) {
      if (!capabilities.includes("metadata.write.own")) {
        console.warn(`[AUDIT] Denied metadata.write.own for plugin "${pluginName}"`);
        throw new Error(`Plugin "${pluginName}" lacks "metadata.write.own" capability`);
      }
      context.metadata[namespace] = {
        ...((context.metadata[namespace] as Record<string, unknown>) ?? {}),
        ...patch,
      };
    },
    emitProcessing(patch: Record<string, unknown>) {
      if (!capabilities.includes("processing.write.own")) {
        console.warn(`[AUDIT] Denied processing.write.own for plugin "${pluginName}"`);
        throw new Error(`Plugin "${pluginName}" lacks "processing.write.own" capability`);
      }
      context.processing[namespace] = {
        ...((context.processing[namespace] as Record<string, unknown>) ?? {}),
        ...patch,
      };
    },
    proposeTrusted(patch: TrustedMetadata) {
      if (trustLevel !== "trusted" || !capabilities.includes("trusted.propose")) {
        console.warn(
          `[AUDIT] Security Violation: Unauthorized trusted.propose from plugin "${pluginName}"`
        );
        throw new Error(`Plugin "${pluginName}" is not authorized to propose trusted metadata`);
      }

      // 1. Semantic Provenance Guard: Ensure plugin has verified data before proposing
      const secureContext = context as SecureAuditContext;
      const verified = secureContext._verifiedSources ?? new Set();
      if (!verified.has("file:content") && (patch.file || patch.checksums || patch.media)) {
        console.warn(
          `[AUDIT] Provenance Failure: Plugin "${pluginName}" attempted to propose trusted metadata without independent verification (no file content read).`
        );
        throw new Error(
          `Plugin "${pluginName}" must verify file content before proposing trusted metadata`
        );
      }

      // 2. Strict Schema Validation
      TrustedMetadataSchema.parse(patch);

      // 2. Provenance Tracking (Internal audit log)
      const auditLog = (secureContext._auditLog ??= []);
      auditLog.push({
        timestamp: new Date().toISOString(),
        plugin: pluginName,
        action: "proposeTrusted",
        patch: JSON.parse(JSON.stringify(patch)), // Snapshot the patch
      });

      console.info(
        `[AUDIT] Accepted trusted proposal from plugin "${pluginName}" for file "${context.file.key}"`
      );

      // 2. Controlled Merge (Provenance-aware)
      context.trusted = {
        ...context.trusted,
        ...patch,
        file: { ...context.trusted.file, ...patch.file },
        checksums: { ...context.trusted.checksums, ...patch.checksums },
        media: { ...context.trusted.media, ...patch.media },
      };

      // 3. Authority Sync: Authoritative metadata is mirrored to context.file
      if (patch.file) {
        if (patch.file.mimeType != null) context.file.mimeType = patch.file.mimeType;
        if (patch.file.size != null) context.file.size = patch.file.size;
        if (patch.file.originalName != null) context.file.originalName = patch.file.originalName;
        if (patch.file.extension != null) context.file.extension = patch.file.extension;
      }
      if (patch.checksums) {
        context.file.checksums = { ...context.file.checksums, ...patch.checksums };
      }
    },
  };

  // 2. Create the Proxy to block direct mutation
  const proxy = new Proxy(context, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);

      // Wrap metadata, processing, and trusted in read-only proxies
      if (prop === "metadata" || prop === "processing" || prop === "trusted" || prop === "file") {
        return new Proxy(value as object, {
          set() {
            throw new Error(
              `Direct mutation of "context.${String(prop)}" is blocked. Use PluginApi instead. (Plugin: ${pluginName})`
            );
          },
          deleteProperty() {
            throw new Error(
              `Direct deletion of "context.${String(prop)}" properties is blocked. (Plugin: ${pluginName})`
            );
          },
        });
      }

      return value;
    },
    set(target, prop) {
      throw new Error(
        `Direct mutation of "context.${String(prop)}" is blocked. (Plugin: ${pluginName})`
      );
    },
  });

  return { proxy, api };
}
