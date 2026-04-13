# @better-media/plugin-media-processing

Image processing for the Better Media pipeline: thumbnails, dimensions in `emitProcessing`, and optional `media_versions` rows.

## Installation

`sharp` is an **optional peer** (native module). Install it in your app when you want thumbnails:

```bash
pnpm add @better-media/plugin-media-processing sharp
```

If `sharp` is missing, `process:run` no-ops with `emitMetadata({ skipped: "sharp-not-installed", ... })`.

Some pnpm setups require allowing Sharp’s install script:

```bash
pnpm approve-builds
```

## Usage

```ts
import { mediaProcessingPlugin } from "@better-media/plugin-media-processing";

const plugins = [
  mediaProcessingPlugin({
    executionMode: "background",
    thumbnailPresets: [
      { name: "sm", width: 320, format: "webp" },
      { name: "md", width: 640, format: "webp", quality: 85 },
    ],
    derivativePrefix: "versions",
    persistMediaVersions: true,
    skipExistingDerivatives: true,
    maxInputBytes: 25 * 1024 * 1024,
  }),
];
```

### Options (summary)

| Option                    | Default                                          | Description                                                                                                                                         |
| ------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `executionMode`           | `"background"`                                   | Sync or background `process:run`.                                                                                                                   |
| `thumbnails`              | `true`                                           | Turn off all thumbnail work.                                                                                                                        |
| `thumbnailPresets`        | `[{ name: "sm", width: 320, format: "webp" }]`   | Ordered resize/format presets. Each preset may set Sharp `fit`: `cover` \| `contain` \| `fill` \| `inside` \| `outside` (default `inside`).         |
| `resolveThumbnailPreset`  | —                                                | Optional `(context, preset, index) => preset` to merge server-validated client hints (e.g. from `context.metadata`) into each preset before resize. |
| `allowedMimeTypes`        | Raster images (jpeg, png, webp, gif, tiff, avif) | Skip others.                                                                                                                                        |
| `maxInputBytes`           | 25 MiB                                           | Skip larger inputs.                                                                                                                                 |
| `derivativePrefix`        | `"versions"`                                     | Storage key prefix: `{prefix}/{recordId}/thumb-{name}.{ext}`.                                                                                       |
| `persistMediaVersions`    | `true`                                           | Insert `media_versions` after each `storage.put`.                                                                                                   |
| `skipExistingDerivatives` | `true`                                           | If key exists, skip upload and DB insert.                                                                                                           |
| `timeoutMs`               | `120_000`                                        | Bound for read + Sharp work.                                                                                                                        |

### Outputs

- **`emitProcessing`** (under plugin namespace): `dimensions` (from Sharp metadata) and `thumbnails.default` as `ThumbnailResult[]`.
- **`emitMetadata`**: `skipped` / `error` reasons (reference URL, MIME, no bytes, sharp missing, timeouts, storage/DB failures).

Video/audio and external providers are not in scope for this package.
