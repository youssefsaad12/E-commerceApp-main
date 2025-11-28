import { ICategory } from 'src/common/interfaces/category.interface';
import {MaxLength, MinLength, IsString, IsOptional} from 'class-validator';

export class CreateCategoryDto implements Partial<ICategory> {
  @MaxLength(25)
  @MinLength(2)
  @IsString()
  name: string;

  @MaxLength(5000)
  @MinLength(2)
  @IsString()
  @IsOptional()
  description: string;
}
