import { Module } from '@nestjs/common';

import { CategoryService } from './category.service';
import { CategoryController } from './category.controller';
import { CategoryRepository } from 'src/DB/repository/category.repository';
import { CategoryModel } from 'src/DB/models/category.model';

import { S3Service } from './../../common/services/s3.service';

@Module({
  imports: [CategoryModel],
  controllers: [CategoryController], 
  providers: [CategoryService, CategoryRepository, S3Service],
})
export class CategoryModule {}
