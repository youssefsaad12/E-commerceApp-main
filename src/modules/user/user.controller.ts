import { TokenEnum } from 'src/common/enums/token.enum';
import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  UploadedFile,
  UseInterceptors,
  Param,
  Delete,
  Post,
} from '@nestjs/common';

import { Auth } from 'src/common/decorator/auth.decorator';
import { RoleEnum } from 'src/common/enums/user.enum';

import { UserService } from './user.service';
import { User } from 'src/common/decorator/credential.decorator';
import type { UserDocument } from 'src/DB/models/user.model';

import { FileInterceptor } from '@nestjs/platform-express';
import { fileValidation } from './../../common/utils/multer/validation.multer';
import { cloudFileUpload } from './../../common/utils/multer/cloud.multer.options';

import { StorageEnum } from 'src/common/enums/multer.enum';

import type { IUser } from 'src/common/interfaces/user.interface';
import type { IResponse } from 'src/common/interfaces/response.interface';
import { successResponse } from './../../common/utils/response';

import { UserParamsDto } from './user.dto';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Auth([RoleEnum.admin, RoleEnum.user, RoleEnum.superAdmin])
  @Get()
  async profile(@User() currentUser: UserDocument): Promise<IResponse<IUser>> {
    const fetchedProfile = await this.userService.profile(currentUser);
    return successResponse<IUser>({ data: fetchedProfile });
  }

  @Auth([RoleEnum.admin, RoleEnum.user, RoleEnum.superAdmin], TokenEnum.refresh)
  @Get('refresh-token')
  @HttpCode(HttpStatus.OK)
  async refreshToken(
    @User() currentUser: UserDocument,
  ): Promise<IResponse<{ credentials: { access_token: string; refresh_token: string } }>> {
    const refreshedTokens = await this.userService.refreshToken(currentUser);
    return successResponse<{ credentials: { access_token: string; refresh_token: string } }>({
      message: 'token refreshed successfully',
      data: { credentials: refreshedTokens },
    });
  }

  @UseInterceptors(
    FileInterceptor(
      'profileImage',
      cloudFileUpload({
        storageApproach: StorageEnum.disk,
        validation: fileValidation.image,
        fileSize: 2,
      }),
    ),
  )
  @Auth([RoleEnum.admin, RoleEnum.user, RoleEnum.superAdmin])
  @Patch('profile-image')
  async profileImage(
    @User() currentUser: UserDocument,
    @UploadedFile() uploadedImg: Express.Multer.File,
  ): Promise<IResponse<{ profile: Partial<IUser> }>> {
    const updatedProfile = await this.userService.profileImage(uploadedImg, currentUser);
    return successResponse<{ profile: Partial<IUser> }>({
      data: { profile: updatedProfile },
    });
  }

  @Auth([RoleEnum.admin, RoleEnum.superAdmin])
  @Delete(':userId/freeze')
  async freeze(
    @Param() routeParams: UserParamsDto,
    @User() adminUser: UserDocument,
  ): Promise<IResponse> {
    await this.userService.freeze(routeParams.userId, adminUser);
    return successResponse({ status: 204 });
  }

  
  @Auth([RoleEnum.admin, RoleEnum.user, RoleEnum.superAdmin])
  @Post('logout')
  @HttpCode(200)
  async logout(@User() currentUser: UserDocument): Promise<IResponse> {
    await this.userService.logout(currentUser._id);
    return successResponse({ message: 'Logged out successfully' });
  }

  @Auth([RoleEnum.admin, RoleEnum.superAdmin])
  @Delete(':userId/delete')
  async delete(@Param() routeParams: UserParamsDto): Promise<IResponse> {
    await this.userService.delete(routeParams.userId);
    return successResponse();
  }

  @Auth([RoleEnum.admin, RoleEnum.superAdmin])
  @Patch(':userId/restore')
  async restore(
    @Param() routeParams: UserParamsDto,
    @User() adminUser: UserDocument,
  ): Promise<IResponse<{ profile: Partial<IUser> }>> {
    const restoredProfile = await this.userService.restore(routeParams.userId, adminUser);
    return successResponse<{ profile: Partial<IUser> }>({
      data: { profile: restoredProfile },
    });
  }
}
