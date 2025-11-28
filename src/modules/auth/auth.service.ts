import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { UserRepository } from 'src/DB/repository/user.repository';
import { OtpRepository } from './../../DB/repository/otp.repository';
import { OtpEnum } from 'src/common/enums/otp.enum';
import { generateOtpNumber } from './../../common/utils/otp';
import { Types } from 'mongoose';

import {
  SendEmailDto,
  SignupBodyDto,
  ConfirmEmailDto,
  LoginBodyDto,
  SignupWithGmailDto,
  ConfirmResetPasswordDto,
} from './dto/auth.dto';

import { compareHash, generateHash } from 'src/common/utils/security/hash.security';
import { TokenService } from 'src/common/utils/security/token.security';
import { ProviderEnum } from 'src/common/enums/user.enum';
import { UserDocument } from 'src/DB/models/user.model';
import { OAuth2Client, type TokenPayload } from 'google-auth-library';

@Injectable()
export class AuthenticationService {
  private readonly AUTO_CONFIRM = process.env.NODE_ENV !== 'production';

  constructor(
    private readonly userRepository: UserRepository,
    private readonly otpRepository: OtpRepository,
    private readonly tokenService: TokenService,
  ) {}

  private async createConfirmOtp(userId: Types.ObjectId, otpType: OtpEnum): Promise<string> {
    const plain = generateOtpNumber();
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000);

    await this.otpRepository.create({
      data: [
        {
          otp: plain,
          expiresAt,
          createdBy: userId,
          type: otpType,
        },
      ],
    });

    return plain;
  }

  private async verifyGmailAccount(idToken: string): Promise<TokenPayload> {
    const client = new OAuth2Client();
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.WEB_CLIENT_ID?.split(',') || [],
    });
    const payload = ticket.getPayload();
    if (!payload?.email_verified) {
      throw new BadRequestException('failed to verify this google account');
    }
    return payload;
  }

  private async getUserForConfirmation(email: string, type: OtpEnum) {
    return this.userRepository.findOne({
      filter: { email, confirmedAt: { $exists: false } },
      options: {
        populate: [{ path: 'otp', match: { type } }],
      },
    });
  }

  async signup(data: SignupBodyDto): Promise<string> {
    const { email, password, username } = data;

    const existing = await this.userRepository.findOne({ filter: { email } });
    if (existing) throw new ConflictException('User already exist');

    const nameParts = (username || '').trim().split(/\s+/);
    const firstName = nameParts[0] || username;
    const lastName = nameParts.slice(1).join(' ') || username;

    const [user] = await this.userRepository.create({
      data: [
        {
          firstName,
          lastName,
          email,
          password,
          ...(this.AUTO_CONFIRM ? { confirmedAt: new Date() } : {}),
        },
      ],
    });

    if (!user) throw new BadRequestException('failed to signup');

    if (!this.AUTO_CONFIRM) {
      await this.createConfirmOtp(user._id, OtpEnum.confirmEmail);
    }

    return this.AUTO_CONFIRM
      ? ' user signup successfully (auto-confirmed in development mode)'
      : ' user signup successfully (please check your email to confirm)';
  }

  async loginWithGmail(
    data: SignupWithGmailDto,
  ): Promise<{ access_token: string; refresh_token: string }> {
    const { idToken } = data;
    const { email } = await this.verifyGmailAccount(idToken);

    const user = await this.userRepository.findOne({
      filter: { email, provider: ProviderEnum.google },
    });

    if (!user) {
      throw new NotFoundException('not registered account or registered with another provider');
    }

    return this.tokenService.createLoginCredentials(user as UserDocument);
  }

  async signupWithGmail(
    data: SignupWithGmailDto,
  ): Promise<{ access_token: string; refresh_token: string }> {
    const { idToken } = data;
    const { email, family_name, given_name, picture } = await this.verifyGmailAccount(idToken);

    const found = await this.userRepository.findOne({ filter: { email } });
    if (found) {
      if (found.provider === ProviderEnum.google) return this.loginWithGmail(data);
      throw new ConflictException('Email exist');
    }

    const [newUser] = (await this.userRepository.create({
      data: [
        {
          email: email as string,
          firstName: given_name as string,
          lastName: family_name as string,
          profilePicture: picture as string,
          confirmedAt: new Date(),
          provider: ProviderEnum.google,
        },
      ],
    })) || [];

    if (!newUser) throw new BadRequestException('failed to create user with gmail');

    return this.tokenService.createLoginCredentials(newUser as UserDocument);
  }

  async resendConfirmEmail(data: SendEmailDto): Promise<string> {
    const { email } = data;
    const user = await this.getUserForConfirmation(email, OtpEnum.confirmEmail);

    if (!user) {
      throw new NotFoundException('User does not exist or user is already confirmed');
    }

    if (user.otp?.length) {
      throw new ConflictException(
        `we can not send you otp until the existing one expires please try again after ${user.otp[0].expiresAt}`,
      );
    }

    await this.createConfirmOtp(user._id, OtpEnum.confirmEmail);
    return ' done ';
  }

  async confirmEmail(data: ConfirmEmailDto): Promise<string> {
    const { email, otp } = data;
    const user = await this.getUserForConfirmation(email, OtpEnum.confirmEmail);

    if (!user) {
      throw new NotFoundException('User does not exist or user is already confirmed');
    }

    if (!(user.otp?.length && (await compareHash(otp, user.otp[0].otp)))) {
      throw new BadRequestException('invalid otp');
    }

    user.confirmedAt = new Date();
    await user.save();
    await this.otpRepository.deleteOne({ filter: { _id: user.otp[0]._id } });

    return ' user confirmed successfully ';
  }

  async login(
    data: LoginBodyDto,
  ): Promise<{ access_token: string; refresh_token: string }> {
    const { email, password } = data;

    const confirmationFilter = this.AUTO_CONFIRM ? {} : { confirmedAt: { $exists: true } };

    const user = await this.userRepository.findOne({
      filter: {
        email,
        ...confirmationFilter,
        provider: ProviderEnum.system,
      },
    });

    if (!user) {
      throw new NotFoundException('failed to find matching account or user is not confirmed');
    }

    if (!(await compareHash(password, user.password))) {
      throw new NotFoundException('failed to find matching account');
    }

    if (this.AUTO_CONFIRM && !user.confirmedAt) {
      try {
        const updatedUser = await this.userRepository.findOneAndUpdate({
          filter: { _id: user._id },
          update: { $set: { confirmedAt: new Date() } },
        });
        if (updatedUser) return this.tokenService.createLoginCredentials(updatedUser as UserDocument);
      } catch (err) {
        console.error('Failed to auto-confirm user:', err);
      }
    }

    return this.tokenService.createLoginCredentials(user as UserDocument);
  }

  async sendResetPasswordCode(data: SendEmailDto): Promise<string> {
    const { email } = data;
    const user = await this.userRepository.findOne({
      filter: {
        email,
        provider: ProviderEnum.system,
        confirmedAt: { $exists: true },
      },
      options: {
        populate: [{ path: 'otp', match: { type: OtpEnum.resetPassword } }],
      },
    });

    if (!user) {
      throw new NotFoundException('User does not exist or user is not confirmed');
    }

    if (user.otp?.length) {
      throw new ConflictException(
        `we can not send you otp until the existing one expires please try again after ${user.otp[0].expiresAt}`,
      );
    }

    const plain = await this.createConfirmOtp(user._id, OtpEnum.resetPassword);

    const result = await this.userRepository.updateOne({
      filter: { email },
      update: { resetPasswordOtp: await generateHash(String(plain)) },
    });

    if (!result.matchedCount) throw new BadRequestException('failed to send code');

    return ' code sent ';
  }

  async resetPassword(data: ConfirmResetPasswordDto): Promise<string> {
    const { email, otp, password } = data;

    const user = await this.userRepository.findOne({
      filter: {
        email,
        provider: ProviderEnum.system,
        resetPasswordOtp: { $exists: true },
      },
      options: {
        populate: [{ path: 'otp', match: { type: OtpEnum.resetPassword } }],
      },
    });

    if (!user) throw new NotFoundException(' invalid account ');

    if (!(user.otp?.length && (await compareHash(otp, user.otp[0].otp)))) {
      throw new BadRequestException('invalid otp');
    }

    const result = await this.userRepository.updateOne({
      filter: { email },
      update: {
        password: await generateHash(password),
        $set: { changeCredentialsTime: new Date() },
        $unset: { resetPasswordOtp: 1 },
      },
    });

    if (!result.matchedCount) throw new BadRequestException('failed to reset password');

    return ' password changed successfully ';
  }
}
