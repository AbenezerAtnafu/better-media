# @better-media/plugin-validation

Validation plugin for the Better Media framework.

## Features

- **MIME Type Validation**: Enforce allowed file types (e.g., `image/jpeg`, `video/mp4`).
- **File Size Validation**: Enforce minimum and maximum file dimensions.
- **Header Inspection**: Inspect raw bytes to verify MIME type.

## Installation

```bash
pnpm add @better-media/plugin-validation
```

## Usage

```ts
import { validationPlugin } from "@better-media/plugin-validation";

const media = createBetterMedia({
  plugins: [
    validationPlugin({
      maxSize: "10mb",
      allowedMimeTypes: ["image/jpeg", "image/png"],
    }),
  ],
});
```

For more, visit [better-media-platform.vercel.app/docs/plugins/validation](https://better-media-platform.vercel.app/docs/plugins/validation).
