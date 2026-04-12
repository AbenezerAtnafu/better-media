import { Global, Module } from '@nestjs/common';
import { createBetterMedia } from '@better-media/framework';
import { FileSystemStorageAdapter } from '@better-media/adapter-storage-filesystem';
import { memoryDatabase } from '@better-media/adapter-db-memory';
import { validationPlugin } from '@better-media/plugin-validation';
import { mediaProcessingPlugin } from '@better-media/plugin-media-processing';

export const BETTER_MEDIA = 'BETTER_MEDIA';

@Global()
@Module({
  providers: [
    {
      provide: BETTER_MEDIA,
      useFactory: () => {
        const database = memoryDatabase();
        const storage = new FileSystemStorageAdapter({
          baseDir: './uploads',
        });

        return createBetterMedia({
          storage,
          database,
          plugins: [
            validationPlugin({
              executionMode: 'sync',
              allowedMimeTypes: [
                'image/jpeg',
                'application/zip',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'application/pdf',
              ],
            }),
            mediaProcessingPlugin({
              executionMode: 'sync',
            }),
          ],
        });
      },
    },
  ],
  exports: [BETTER_MEDIA],
})
export class BetterMediaModule {}
