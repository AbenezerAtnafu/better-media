import { z } from "zod";

/**
 * Zod Schema for Trusted Metadata.
 * Strictly enforced to prevent trust injection from the database.
 */
export const TrustedMetadataSchema = z
  .object({
    file: z
      .object({
        mimeType: z.string().optional(),
        size: z.number().int().nonnegative().optional(),
        originalName: z.string().optional(),
        extension: z.string().optional(),
      })
      .strict()
      .optional(),
    checksums: z
      .object({
        sha256: z.string().optional(),
        md5: z.string().optional(),
      })
      .strict()
      .optional(),
    media: z
      .object({
        width: z.number().int().nonnegative().optional(),
        height: z.number().int().nonnegative().optional(),
        duration: z.number().nonnegative().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

/** Metadata from DB/Trusted Sources (Schema validated) */
export type TrustedMetadata = z.infer<typeof TrustedMetadataSchema>;
