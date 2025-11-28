import { MongooseModule, Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types, UpdateQuery } from 'mongoose';
import { ICategory } from 'src/common/interfaces/category.interface';
import slugify from 'slugify';

@Schema({
  timestamps: true,
  strictQuery: true,
  strict: true,
})
export class Category implements ICategory {
  @Prop({
    type: String,
    required: true,
    unique: true,
    minLength: 2,
    maxLength: 25,
    trim: true,
  })
  name: string;

  @Prop({
    type: String,
    minLength: 2,
    maxLength: 25,
  })
  slug: string;

  @Prop({
    type: String,
    minLength: 2,
    maxLength: 5000,
  })
  description: string;

  @Prop({ type: String, required: true })
  image: string;

  @Prop({ type: String, required: true })
  assetFolderId: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  updatedBy: Types.ObjectId;

  @Prop({ type: Date })
  freezedAt?: Date;

  @Prop({ type: Date })
  restoredAt?: Date;
}

export type CategoryDocument = HydratedDocument<Category>;
const categorySchema = SchemaFactory.createForClass(Category);

categorySchema.pre('save', function (next) {
  if (this.isModified('name')) {
    this.slug = slugify(this.name);
  }
  next();
});

categorySchema.pre(['updateOne', 'findOneAndUpdate'], function (next) {
  const update = this.getUpdate() as UpdateQuery<CategoryDocument>;

  if (Array.isArray(update)) {
    let setStage = update.find((stage) => stage.$set);
    if (!setStage) {
      setStage = { $set: {} };
      update.push(setStage);
    }
    if (setStage.$set.name) {
      setStage.$set.slug = slugify(setStage.$set.name);
    }
  } else {
    if (update?.name) {
      this.setUpdate({
        ...update,
        slug: slugify(update.name),
      });
    }
  }

  const query = this.getQuery();
  if (query.paranoId !== false) {
    this.setQuery({
      ...query,
      freezedAt: { $exists: false },
    });
  }

  next();
});

categorySchema.pre(['find', 'findOne'], function (next) {
  const query = this.getQuery();
  if (query.paranoId !== false) {
    this.setQuery({
      ...query,
      freezedAt: { $exists: false },
    });
  }
  next();
});

export const CategoryModel = MongooseModule.forFeature([
  { name: Category.name, schema: categorySchema },
]);
