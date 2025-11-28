import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as express from 'express';
import path from 'path';

async function bootstrap() {
  const serverPort = process.env.PORT ?? 5000;
  const app = await NestFactory.create(AppModule);

  app.use('/uploads', express.static(path.resolve('./uploads')));

  await app.listen(serverPort, () => {
    console.log(`Server is running on port: ${serverPort}`);
  });
}

bootstrap();
