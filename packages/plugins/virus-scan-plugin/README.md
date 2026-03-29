# @better-media/plugin-virus-scan

Virus scanning plugin for the Better Media framework.

## Features

- **ClamAV Integration**: Local or remote ClamAV server scanning.
- **VirusTotal Integration**: API-based multi-engine scanning.
- **Background Execution**: Scan in the background to avoid blocking ingest.
- **Hook Integration**: Automatically blocks access to files containing malware.

## Installation

```bash
pnpm add @better-media/plugin-virus-scan
```

## Usage

```ts
import { virusScanPlugin } from "@better-media/plugin-virus-scan";

const media = createBetterMedia({
  plugins: [
    virusScanPlugin({
      strategy: "clamav",
      clamav: { host: "localhost", port: 3310 },
      failureAction: "reject",
    }),
  ],
});
```

See [better-media.dev/docs/plugins/virus-scan](https://better-media.dev/docs/plugins/virus-scan) for all strategies and options.
