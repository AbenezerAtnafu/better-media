# Proposal: @better-media/adapter-upload-multer

> Draft proposal. To be implemented later.

## Problem

When using server-side uploads, apps must:

1. Install multer separately
2. Wire `storage.put(fileKey, buffer)` after multer parses
3. Wire `media.upload.multer(fileKey, metadata)` to kick off the pipeline
4. Manually map multer file info (mimetype, size, originalname) into metadata

Result: repeated boilerplate, inconsistent metadata, easy to get wrong.

---

## Solution: Separate Upload Adapter (Option A)

Create `@better-media/adapter-upload-multer` – a separate adapter that:

1. Uses multer to parse multipart and receive file bytes
2. Extracts file info (mimetype, size, originalname) → builds metadata automatically
3. Calls `storage.put` then `media.upload.multer` in one place
4. Exposes Express middleware + handler for drop-in use

---

## Proposed API

```ts
import { createMulterUploadAdapter } from "@better-media/adapter-upload-multer";

const { middleware, handler } = createMulterUploadAdapter({
  media, // BetterMediaRuntime (for storage + runPipeline)
  fieldName: "file",
  fileKeyGenerator: (req, file) => `${Date.now()}-${file.originalname}`,
  metadataFromFile: (file) => ({
    contentType: file.mimetype,
    size: file.size,
    originalName: file.originalname,
    // ... custom fields
  }),
});

app.post("/upload", middleware, handler);
```

- **middleware**: multer middleware that parses the multipart request
- **handler**: runs after multer; calls `storage.put` → `media.upload.multer` with metadata from the file

---

## Behavior

| Step | Action                                                                                    |
| ---- | ----------------------------------------------------------------------------------------- |
| 1    | Multer parses multipart, exposes `req.file` (buffer, mimetype, size, originalname, etc.)  |
| 2    | Build `metadata` from `metadataFromFile(file)` (default: contentType, size, originalName) |
| 3    | Generate `fileKey` via `fileKeyGenerator(req, file)` (default: timestamped originalname)  |
| 4    | Call storage.put(fileKey, buffer) (via media's storage)                                   |
| 5    | Call media.upload.multer(fileKey, metadata) to run the pipeline                           |

---

## Design Decisions

| Decision                        | Rationale                                                                            |
| ------------------------------- | ------------------------------------------------------------------------------------ |
| Multer as optional adapter      | Core and framework stay framework-agnostic; no multer dependency for presigned users |
| Storage via media runtime       | Same storage adapter used everywhere; no separate config                             |
| Metadata from multer by default | contentType, size, originalName map naturally; avoid manual wiring                   |
| Extensible metadataFromFile     | Apps can add custom fields (userId, tenantId, etc.)                                  |
| Express/Connect only for v1     | Other frameworks (Fastify, Hono) could get separate adapters later                   |

---

## Package Structure

```
packages/adapters/upload-multer/
  src/
    index.ts          # createMulterUploadAdapter
    types.ts          # options, config
  package.json        # deps: better-media, multer, @types/express
```

---

## Before vs After

**Before:**

```ts
const upload = multer({ storage: multer.memoryStorage() });
app.post("/upload", upload.single("file"), async (req, res) => {
  const fileKey = `${Date.now()}-${req.file.originalname}`;
  await storage.put(fileKey, req.file.buffer);
  await media.upload.multer(fileKey, {
    contentType: req.file.mimetype,
    size: req.file.size,
    originalName: req.file.originalname,
  });
  res.json({ success: true });
});
```

**After:**

```ts
const { middleware, handler } = createMulterUploadAdapter({
  media,
  fieldName: "file",
});
app.post("/upload", middleware, handler);
```

Metadata flows automatically; no manual wiring.

---

## Notes

- Object storage + presigned URLs: no multer needed; client uploads directly to S3/GCS.
- Multer adapter is only for the traditional "POST multipart to server" flow.
