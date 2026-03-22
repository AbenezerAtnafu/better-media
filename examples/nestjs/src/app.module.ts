import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { BetterMediaModule } from './better-media.module';

@Module({
  imports: [BetterMediaModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
