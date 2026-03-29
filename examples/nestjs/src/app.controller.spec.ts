import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { BETTER_MEDIA } from './better-media.module';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: BETTER_MEDIA,
          useValue: {
            upload: {
              ingest: jest.fn(),
              fromBuffer: jest.fn(),
              requestPresignedUpload: jest.fn(),
              complete: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return the API overview object', () => {
      const result = appController.getHello();
      expect(result).toHaveProperty('message', 'Better Media + NestJS');
      expect(result).toHaveProperty('endpoints');
    });
  });
});
