# @better-media/plugin-media-processing

Media processing (image, video) plugin for the Better Media framework.

## Features

- **Image Resizing**: Resize to specific dimensions or percentages.
- **Transcoding**: Convert to WebP, AVIF, JPEG, or other formats.
- **Sharp-based**: Uses high-performance Node.js processing.
- **Background Support**: Supports enqueuing processing jobs via job adapters.

## Installation

```bash
pnpm add @better-media/plugin-media-processing sharp
```

## Usage

```ts
import { mediaProcessingPlugin } from "@better-media/plugin-media-processing";

const media = createBetterMedia({
  plugins: [
    mediaProcessingPlugin({
      outputs: [
        { suffix: "-thumbnail", width: 200 },
        { suffix: "-high-res", format: "webp" },
      ],
    }),
  ],
});
```

See the [better-media.dev/docs/plugins/media-processing](https://better-media.dev/docs/plugins/media-processing) for more configuration options.
