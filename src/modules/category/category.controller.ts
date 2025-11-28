import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UploadedFile,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
  Query
} from '@nestjs/common';

import { CategoryService } from './category.service';
import { CreateCategoryDto } from './dto/create-category.dto';

import { User } from 'src/common/decorator/credential.decorator';
import type { UserDocument } from 'src/DB/models/user.model';

import { successResponse } from 'src/common/utils/response';

import { IResponse } from 'src/common/interfaces/response.interface';
import { ICategory } from 'src/common/interfaces/category.interface';

import { Auth } from 'src/common/decorator/auth.decorator';

import { RoleEnum } from 'src/common/enums/user.enum';
import { UpdateCategoryDto, CategoryParamsDto } from './dto/update-category.dto';

import { FileInterceptor } from '@nestjs/platform-express';
import { cloudFileUpload } from 'src/common/utils/multer/cloud.multer.options';
import { fileValidation } from 'src/common/utils/multer/validation.multer';

import { SearchDto } from 'src/common/dtos/search.dto';
import { GetAllResponse } from 'src/common/entities/search.entity';

@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
@Controller('category')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @UseInterceptors(
    FileInterceptor('attachment', cloudFileUpload({ validation: fileValidation.image }))
  )
  @Auth([RoleEnum.admin, RoleEnum.superAdmin])
  @Post()
  async create(
    @User() userDoc: UserDocument,
    @Body() bodyData: CreateCategoryDto,
    @UploadedFile() imageFile: Express.Multer.File,
  ): Promise<IResponse<{ category: ICategory }>> {
    const createdCategory = await this.categoryService.create(bodyData, imageFile, userDoc);
    return successResponse({ status: 201, data: { category: createdCategory } });
  }

  @Auth([RoleEnum.admin, RoleEnum.superAdmin])
  @Get('archive')
  async findAllArchives(
    @Query() searchParams: SearchDto
  ): Promise<IResponse<GetAllResponse<ICategory>>> {
    const archivedCategories = await this.categoryService.findAll(searchParams, true);
    return successResponse({ data: archivedCategories });
  }

  @Get()
  async findAll(
    @Query() searchParams: SearchDto
  ): Promise<IResponse<GetAllResponse<ICategory>>> {
    const fetchedCategories = await this.categoryService.findAll(searchParams);
    return successResponse({ data: fetchedCategories });
  }

  @Auth([RoleEnum.admin, RoleEnum.superAdmin])
  @Get(':categoryId/archive')
  async findOneArchive(
    @Param() params: CategoryParamsDto
  ): Promise<IResponse<{ category: ICategory }>> {
    const archivedItem = await this.categoryService.findOne(params.categoryId, true);
    return successResponse({ data: { category: archivedItem } });
  }

  @Get(':categoryId')
  async findOne(
    @Param() params: CategoryParamsDto
  ): Promise<IResponse<{ category: ICategory }>> {
    const categoryData = await this.categoryService.findOne(params.categoryId);
    return successResponse({ data: { category: categoryData } });
  }

  @Auth([RoleEnum.admin, RoleEnum.superAdmin])
  @Patch(':categoryId')
  async update(
    @Param() params: CategoryParamsDto,
    @Body() updateData: UpdateCategoryDto,
    @User() userDoc: UserDocument,
  ): Promise<IResponse<{ updatedCategory: ICategory }>> {
    const updatedItem = await this.categoryService.update(params.categoryId, updateData, userDoc);
    return successResponse({ data: { updatedCategory: updatedItem } });
  }

  @UseInterceptors(
    FileInterceptor('attachment', cloudFileUpload({ validation: fileValidation.image }))
  )
  @Auth([RoleEnum.admin, RoleEnum.superAdmin])
  @Patch(':categoryId/attachment')
  async updateAttachment(
    @Param() params: CategoryParamsDto,
    @UploadedFile() imageFile: Express.Multer.File,
    @User() userDoc: UserDocument,
  ): Promise<IResponse<{ updatedCategory: ICategory }>> {
    const modifiedCategory = await this.categoryService.updateAttachment(
      params.categoryId,
      imageFile,
      userDoc,
    );
    return successResponse({ data: { updatedCategory: modifiedCategory } });
  }

  @Auth([RoleEnum.admin, RoleEnum.superAdmin])
  @Delete(':categoryId/freeze')
  async freeze(
    @Param() params: CategoryParamsDto,
    @User() userDoc: UserDocument,
  ): Promise<IResponse> {
    await this.categoryService.freeze(params.categoryId, userDoc);
    return successResponse();
  }

  @Auth([RoleEnum.admin, RoleEnum.superAdmin])
  @Delete(':categoryId/delete')
  async delete(@Param() params: CategoryParamsDto): Promise<IResponse> {
    await this.categoryService.delete(params.categoryId);
    return successResponse({ status: 204 });
  }

  @Auth([RoleEnum.admin, RoleEnum.superAdmin])
  @Patch(':categoryId/restore')
  async restore(
    @Param() params: CategoryParamsDto,
    @User() userDoc: UserDocument,
  ): Promise<IResponse<{ category: ICategory }>> {
    const restoredCategory = await this.categoryService.restore(params.categoryId, userDoc);
    return successResponse({ data: { category: restoredCategory } });
  }
}
