import {
  Controller,
  Get,
  Post,
  UploadedFile,
  UseInterceptors,
  Inject,
  Req,
  BadRequestException,
  InternalServerErrorException,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { BETTER_MEDIA } from './better-media.module';
import {
  BetterMediaRuntime,
  type MediaMetadata,
} from '@better-media/framework';

@Controller()
export class AppController {
  constructor(
    @Inject(BETTER_MEDIA) private readonly media: BetterMediaRuntime,
  ) {}

  @Get()
  getHello() {
    return {
      message: 'Better Media + NestJS',
      endpoints: {
        'POST /upload/multipart': 'Upload file via multipart/form-data',
        'POST /upload/binary': 'Upload raw binary file',
        'POST /upload/presign': 'Generate presigned URL',
        'POST /upload/complete': 'Complete presigned upload',
      },
    };
  }

  @Post('upload/multipart')
  @UseInterceptors(FileInterceptor('file'))
  async uploadMultipart(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    try {
      const result = await this.media.upload.ingest({
        file: { path: file.path },
        metadata: {
          filename: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
        },
      });

      return {
        success: true,
        ...result,
        message: 'File ingested from Multer and processed successfully.',
      };
    } catch (err) {
      throw new InternalServerErrorException(
        err instanceof Error ? err.message : 'Unknown error',
      );
    }
  }

  @Post('upload/binary')
  async uploadBinary(@Req() req: Request & { rawBody?: Buffer }) {
    const contentType =
      req.headers['content-type'] || 'application/octet-stream';
    const fileKey =
      (req.headers['x-file-key'] as string) || `file-${Date.now()}`;

    const body = req.rawBody || req.body;

    if (!Buffer.isBuffer(body) || body.length === 0) {
      throw new BadRequestException(
        'Body must be binary data. Ensure raw body parsing is enabled.',
      );
    }

    try {
      const result = await this.media.upload.fromBuffer(body, {
        key: fileKey,
        metadata: { mimeType: contentType },
      });

      return {
        success: true,
        ...result,
        message: 'Buffer directly ingested and processed successfully.',
      };
    } catch (err) {
      throw new InternalServerErrorException(
        err instanceof Error ? err.message : 'Unknown error',
      );
    }
  }

  @Post('upload/presign')
  async uploadPresign(
    @Body()
    body: {
      fileKey?: string;
      contentType?: string;
      method?: 'PUT' | 'POST';
      maxSizeBytes?: number;
    },
  ) {
    try {
      const fileKey = body.fileKey || `file-${Date.now()}`;
      const contentType = body.contentType || 'application/octet-stream';

      const result = await this.media.upload.requestPresignedUpload(fileKey, {
        method: body.method ?? 'PUT',
        contentType,
        maxSizeBytes: body.maxSizeBytes,
      });

      return {
        success: true,
        fileKey,
        ...result,
        message:
          result.method === 'PUT'
            ? 'Use this URL to upload the file directly via an HTTP PUT request with the specified headers.'
            : 'Use this URL and form fields to upload via a multipart/form-data POST request.',
      };
    } catch (err) {
      throw new InternalServerErrorException(
        err instanceof Error ? err.message : 'Unknown error',
      );
    }
  }

  @Post('upload/complete')
  async uploadComplete(
    @Body() body: { fileKey: string; metadata?: MediaMetadata },
  ) {
    if (!body.fileKey) {
      throw new BadRequestException('fileKey is required');
    }

    try {
      const result = await this.media.upload.complete(
        body.fileKey,
        body.metadata || {},
      );

      return {
        success: true,
        ...result,
        message: 'File processing pipeline completed successfully.',
      };
    } catch (err) {
      throw new InternalServerErrorException(
        err instanceof Error ? err.message : 'Unknown error',
      );
    }
  }
}
