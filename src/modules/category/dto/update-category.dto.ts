import { PartialType } from '@nestjs/mapped-types';
import { CreateCategoryDto } from './create-category.dto';
import { containField } from 'src/common/decorator/update.decorator';
import { IsMongoId, IsOptional } from 'class-validator';
import { Types } from 'mongoose';

@containField()
export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}
export class CategoryParamsDto {
  @IsMongoId()
  categoryId: Types.ObjectId;
}
