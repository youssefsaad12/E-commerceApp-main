import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { S3Service } from './../../common/services/s3.service';

import { CategoryRepository } from './../../DB/repository/category.repository';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CategoryDocument } from 'src/DB/models/category.model';
import { UpdateCategoryDto } from './dto/update-category.dto';

import { SearchDto } from './../../common/dtos/search.dto';

import { UserDocument } from 'src/DB/models/user.model';

import { FolderEnum } from 'src/common/enums/multer.enum';

import { Lean } from 'src/DB/repository/database.repository';
import { Types } from 'mongoose';
import { randomUUID } from 'crypto';

@Injectable()
export class CategoryService {
  constructor(
    private readonly categoryRepository: CategoryRepository,
    private readonly s3Service: S3Service,
  ) {}

  async create(
    createCategoryDto: CreateCategoryDto,
    file: Express.Multer.File,
    user: UserDocument,
  ): Promise<CategoryDocument> {
    const { name } = createCategoryDto;

    const existingCategory = await this.categoryRepository.findOne({
      filter: { name, paranoId: false },
    });

    if (existingCategory) {
      throw new ConflictException(
        existingCategory.freezedAt
          ? 'this category is freezed'
          : 'duplicated category name',
      );
    }

    let assetFolderId = randomUUID();

    const uploadedImage = await this.s3Service.uploadFile({
      file,
      path: `${FolderEnum.Category}/${assetFolderId}`,
    });

    const [createdRecord] = await this.categoryRepository.create({
      data: [
        {
          ...createCategoryDto,
          image: uploadedImage,
          assetFolderId,
          createdBy: user._id,
        },
      ],
    });

    if (!createdRecord) {
      await this.s3Service.deleteFile({ Key: uploadedImage });
      throw new BadRequestException('failed to create this category ');
    }

    return createdRecord;
  }

  async findAll(
    queryParams: SearchDto,
    archive = false,
  ): Promise<{
    docsCount?: number;
    limit?: number;
    pagesCount?: number;
    currentPage?: number | undefined;
    result: Array<CategoryDocument | Lean<CategoryDocument>>;
  }> {
    const { page, size, search } = queryParams;

    const searchResult = await this.categoryRepository.paginate({
      filter: {
        ...(search
          ? {
              $or: [
                { name: { $regex: search, $options: 'i' } },
                { slug: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
              ],
            }
          : {}),

        ...(archive ? { paranoId: false, freezedAt: { $exists: true } } : {}),
      },
      page,
      size,
    });

    return searchResult;
  }

  async findOne(
    categoryId: Types.ObjectId,
    archive = false,
  ): Promise<CategoryDocument | Lean<CategoryDocument>> {
    const fetchedCategory = await this.categoryRepository.findOne({
      filter: {
        _id: categoryId,
        ...(archive ? { paranoId: false, freezedAt: { $exists: true } } : {}),
      },
    });

    if (!fetchedCategory) {
      throw new NotFoundException('failed to find this category');
    }

    return fetchedCategory;
  }

  async findOneArchive(
    categoryId: Types.ObjectId,
    archive = false,
  ): Promise<CategoryDocument | Lean<CategoryDocument>> {
    const archivedRecord = await this.categoryRepository.findOne({
      filter: {
        _id: categoryId,
        ...(archive ? { paranoId: false, freezedAt: { $exists: true } } : {}),
      },
    });

    if (!archivedRecord) {
      throw new NotFoundException('failed to find this category');
    }

    return archivedRecord;
  }

  async update(
    categoryId: Types.ObjectId,
    updateCategoryDto: UpdateCategoryDto,
    user: UserDocument,
  ): Promise<CategoryDocument | Lean<CategoryDocument>> {
    if (
      updateCategoryDto.name &&
      (await this.categoryRepository.findOne({
        filter: { name: updateCategoryDto.name },
      }))
    ) {
      throw new ConflictException('Duplicated category name');
    }

    const updatedRecord = await this.categoryRepository.findOneAndUpdate({
      filter: { _id: categoryId },
      update: {
        ...updateCategoryDto,
        updatedBy: user._id,
      },
    });

    if (!updatedRecord) {
      throw new NotFoundException('Failed to update this category');
    }

    return updatedRecord;
  }

  async updateAttachment(
    categoryId: Types.ObjectId,
    file: Express.Multer.File,
    user: UserDocument,
  ): Promise<CategoryDocument | Lean<CategoryDocument>> {
    const currentCategory = await this.categoryRepository.findOne({
      filter: { _id: categoryId },
    });

    if (!currentCategory) {
      throw new NotFoundException('failed to update this category');
    }

    const uploadedImage = await this.s3Service.uploadFile({
      file,
      path: `${FolderEnum.Category}/${currentCategory.assetFolderId}`,
    });

    const updatedRecord = await this.categoryRepository.findOneAndUpdate({
      filter: { _id: categoryId },
      update: {
        image: uploadedImage,
        updatedBy: user._id,
      },
    });

    if (!updatedRecord) {
      await this.s3Service.deleteFile({ Key: uploadedImage });
      throw new NotFoundException('failed to update this category');
    }

    await this.s3Service.deleteFile({ Key: currentCategory.image });

    return updatedRecord;
  }

  async freeze(categoryId: Types.ObjectId, user: UserDocument): Promise<string> {
    const freezeResult = await this.categoryRepository.findOneAndUpdate({
      filter: { _id: categoryId },
      update: {
        updatedBy: user._id,
        freezedAt: new Date(),
        $unset: { restoredAt: true },
      },
    });

    if (!freezeResult) {
      throw new NotFoundException(
        'category not found or category is already freezed',
      );
    }

    return 'Done';
  }

  async delete(categoryId: Types.ObjectId): Promise<string> {
    const deletedRecord = await this.categoryRepository.findOneAndDelete({
      filter: { _id: categoryId, paranoId: false, freezedAt: { $exists: true } },
    });

    if (!deletedRecord) {
      throw new NotFoundException(
        'category not found or category must be freezed first',
      );
    }

    await this.s3Service.deleteFile({ Key: deletedRecord.image });

    return 'Done';
  }

  async restore(
    categoryId: Types.ObjectId,
    user: UserDocument,
  ): Promise<CategoryDocument | Lean<CategoryDocument>> {
    const restoredRecord = await this.categoryRepository.findOneAndUpdate({
      filter: { _id: categoryId, paranoId: false, freezedAt: { $exists: true } },
      update: {
        updatedBy: user._id,
        restoredAt: new Date(),
        $unset: { freezedAt: true },
      },
    });

    if (!restoredRecord) {
      throw new NotFoundException('category not found or category is not freezed');
    }

    return restoredRecord;
  }
}
