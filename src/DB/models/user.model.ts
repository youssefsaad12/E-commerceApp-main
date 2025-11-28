import { MongooseModule, Prop, Schema, SchemaFactory, Virtual } from "@nestjs/mongoose";
import { HydratedDocument, Types, UpdateQuery } from "mongoose";
import { GenderEnum, ProviderEnum, RoleEnum } from "src/common/enums/user.enum";
import { generateHash } from './../../common/utils/security/hash.security';
import { OtpDocument } from "./otp.model";
import { IUser } from "src/common/interfaces/user.interface";

@Schema({
  strictQuery: true,
  timestamps: true,
  toObject: { virtuals: true },
  toJSON: { virtuals: true },
})
export class User implements IUser {
  @Prop({
    type: String,
    required: true,
    minLength: 2,
    maxLength: 50,
    trim: true,
  })
  firstName: string;

  @Prop({
    type: String,
    required: true,
    minLength: 2,
    maxLength: 50,
    trim: true,
  })
  lastName: string;

  @Virtual({
    get: function (this: User) {
      return `${this.firstName} ${this.lastName}`;
    },
    set: function (value: string) {
      const [fName, lName] = value.split(" ") || [];
      this.set({ firstName: fName, lastName: lName });
    },
  })
  username: string;

  @Prop({
    type: String,
    required: true,
    unique: true,
  })
  email: string;

  @Prop({
    type: String,
    required: function (this: User) {
      return this.provider === ProviderEnum.google ? false : true;
    },
  })
  password: string;

  @Prop({ type: String })
  resetPasswordOtp?: string;

  @Prop({ type: String })
  profilePicture: string;

  @Prop({
    type: String,
    enum: RoleEnum,
    default: RoleEnum.user,
  })
  role: RoleEnum;

  @Prop({
    type: String,
    enum: ProviderEnum,
    default: ProviderEnum.system,
  })
  provider: ProviderEnum;

  @Prop({
    type: String,
    enum: GenderEnum,
    default: GenderEnum.male,
  })
  gender: GenderEnum;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  updatedBy: Types.ObjectId;

  @Prop({ type: Date })
  freezedAt: Date;

  @Prop({ type: Date })
  restoredAt: Date;

  @Prop({ type: Date })
  confirmedAt: Date;

  @Prop({ type: Date })
  changeCredentialsTime: Date;

  @Prop({ type: [{ type: Types.ObjectId, ref: "Product" }] })
  wishlist?: Types.ObjectId[];

  @Virtual()
  otp: OtpDocument[];
}

export type UserDocument = HydratedDocument<User>;
const userSchema = SchemaFactory.createForClass(User);

userSchema.virtual('otp', {
  localField: "_id",
  foreignField: "createdBy",
  ref: "Otp",
});

userSchema.pre("save", async function (next) {
  if (this.isModified("password")) {
    this.password = await generateHash(this.password);
  }
  next();
});

userSchema.pre(['updateOne', 'findOneAndUpdate'], function (next) {
  const upd = this.getUpdate() as UpdateQuery<UserDocument>;
  const target = (upd.$set ?? upd) as any;

  if (target.username) {
    const [first, ...rest] = String(target.username).split(" ");
    const last = rest.join(" ");

    const newUpd = {
      ...upd,
      $set: {
        ...(upd.$set || {}),
        firstName: first,
        lastName: last,
      },
    };

    delete newUpd.$set.username;
    if ((newUpd as any).username) delete (newUpd as any).username;

    this.setUpdate(newUpd);
  }

  const conditions = this.getQuery();
  if (conditions.paranoId !== false) {
    this.where({ freezedAt: { $exists: false } });
  }

  next();
});

userSchema.pre(['find', 'findOne'], function (next) {
  const conditions = this.getQuery();
  if (conditions.paranoId !== false) {
    this.where({ freezedAt: { $exists: false } });
  }
  next();
});

export const UserModel = MongooseModule.forFeature([
  { name: User.name, schema: userSchema },
]);
