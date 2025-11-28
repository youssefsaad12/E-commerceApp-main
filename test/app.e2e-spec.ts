import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let testApp: INestApplication<App>;

  beforeEach(async () => {
    const testingModule: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    testApp = testingModule.createNestApplication();
    await testApp.init();
  });

  it('/upload/pre-signed/* (GET)', () => {
    return request(testApp.getHttpServer())
      .get('/upload/pre-signed/test')
      .expect(200);
  });
});
