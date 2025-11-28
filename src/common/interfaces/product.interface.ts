import { Types } from 'mongoose';
import { IUser } from './user.interface';
import { ICategory } from './category.interface';

export interface IProduct {
  _id?: Types.ObjectId;

  name: string;
  slug: string;
  description: string;
  images: string[];

  assetFolderId: string;

  originalPrice: number;
  discountPercent: number;
  salePrice: number;

  stock: number;
  soldItems: number;

  category: Types.ObjectId | ICategory;

  createdBy: Types.ObjectId | IUser;
  updatedBy?: Types.ObjectId | IUser;

  createdAt?: Date;
  updatedAt?: Date;

  freezedAt?: Date;
  restoredAt?: Date;

}
