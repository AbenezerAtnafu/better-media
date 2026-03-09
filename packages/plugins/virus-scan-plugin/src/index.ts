import type { PipelinePlugin, MediaRuntime } from "@better-media/core";

export function virusScanPlugin(): PipelinePlugin {
  return {
    name: "virus-scan",
    apply(runtime: MediaRuntime) {
      runtime.hooks["scan:run"].tap("virus-scan", async (context) => {
        console.log(`Scanning file ${context.fileKey} for viruses...`);
      });
    },
  };
}
