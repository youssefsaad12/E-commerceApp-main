import { Injectable, NotFoundException } from '@nestjs/common';
import { UserDocument } from 'src/DB/models/user.model';
import { S3Service } from './../../common/services/s3.service';
import { TokenService } from 'src/common/utils/security/token.security';
import { StorageEnum } from 'src/common/enums/multer.enum';
import { Types } from 'mongoose';
import { UserRepository } from 'src/DB/repository/user.repository';
import {
  GenderEnum,
  ProviderEnum,
  RoleEnum,
} from 'src/common/enums/user.enum';

@Injectable()
export class UserService {
  constructor(
    private readonly s3Service: S3Service,
    private readonly tokenService: TokenService,
    private readonly userRepository: UserRepository,
  ) {}

  async logout(userId: Types.ObjectId): Promise<void> {
    await this.userRepository.findOneAndUpdate({
      filter: { _id: userId },
      update: { refreshToken: null },
    });
  }

  async profile(currentUser: UserDocument): Promise<UserDocument> {
    const foundProfile = await this.userRepository.findOne({
      filter: { _id: currentUser._id },
      options: { populate: [{ path: 'wishlist' }] },
    }) as UserDocument;

    return foundProfile;
  }

  async refreshToken(
    currentUser: UserDocument,
  ): Promise<{ access_token: string; refresh_token: string }> {
    return await this.tokenService.createLoginCredentials(currentUser);
  }

  async profileImage(
    uploadedFile: Express.Multer.File,
    currentUser: UserDocument,
  ): Promise<{ email: string; username: string; profilePicture?: string }> {
    currentUser.profilePicture = await this.s3Service.uploadFile({
      file: uploadedFile,
      storageApproach: StorageEnum.disk,
      path: `user/${currentUser._id.toString()}`,
    });

    await currentUser.save();

    const { email, username, profilePicture } = currentUser;
    return { email, username, profilePicture };
  }

  async freeze(targetUserId: Types.ObjectId, currentUser: UserDocument): Promise<string> {
    const updatedUser = await this.userRepository.findOneAndUpdate({
      filter: { _id: targetUserId },
      update: {
        updatedBy: currentUser._id,
        freezedAt: new Date(),
        $unset: { restoredAt: true },
      },
    });

    if (!updatedUser) {
      throw new NotFoundException('user not found or account is already freezed');
    }

    return 'Done';
  }

  async delete(targetUserId: Types.ObjectId): Promise<string> {
    const deletedUser = await this.userRepository.findOneAndDelete({
      filter: { _id: targetUserId, paranoId: false, freezedAt: { $exists: true } },
    });

    if (!deletedUser) {
      throw new NotFoundException('user not found or account must be freezed first');
    }

    await this.s3Service.deleteFile({ Key: deletedUser.profilePicture });

    return 'Done';
  }

  async restore(
    targetUserId: Types.ObjectId,
    currentUser: UserDocument,
  ): Promise<{
    email: string;
    username: string;
    profilePicture?: string;
    gender: GenderEnum;
    role: RoleEnum;
    provider: ProviderEnum;
  }> {
    const restoredUser = await this.userRepository.findOneAndUpdate({
      filter: { _id: targetUserId, paranoId: false, freezedAt: { $exists: true } },
      update: {
        updatedBy: currentUser._id,
        restoredAt: new Date(),
        $unset: { freezedAt: true },
      },
    });

    if (!restoredUser) {
      throw new NotFoundException('user not found or account is not freezed');
    }

    const { email, username, profilePicture, gender, role, provider } =
      restoredUser;

    return { email, username, profilePicture, gender, role, provider };
  }
}
