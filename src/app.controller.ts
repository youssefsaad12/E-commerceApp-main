import { BadRequestException, Controller, Get, Param, Query, Res } from '@nestjs/common';
import { S3Service } from './common/services/s3.service';

import { promisify } from 'util';
import { pipeline } from 'stream';
import type { Response } from 'express';

const s3WriteStreamPipeline = promisify(pipeline);

// localhost:5000/
@Controller()
export class AppController {
  constructor(
    private readonly s3Service: S3Service,
  ) {}


  @Get("/upload/pre-signed/*path")
  async getPresignedAssetUrl(
    @Query() query: { download?: "true" | "false"; filename?: string },
    @Param() params: { path: string[] },
  ) {
    const { filename: requestedFilename, download: shouldDownload } = query;
    const { path: pathSegments } = params;

    const assetKey = pathSegments.join("/");

    const presignedUrl = await this.s3Service.createGetPreSignedLink({
      Key: assetKey,
      filename: requestedFilename,
      download: shouldDownload,
    });

    return { message: "pre-signed url", data: { url: presignedUrl } };
  }

  @Get("/upload/*path")
  async getAsset(
    @Query() query: { download?: "true" | "false"; filename?: string },
    @Param() params: { path: string[] },
    @Res({ passthrough: true }) res: Response,
  ) {
    const { filename: requestedFilename, download: shouldDownload } = query;
    const { path: pathSegments } = params;

    const assetKey = pathSegments.join("/");

    const fetchedFile = await this.s3Service.getFile({ Key: assetKey });

    if (!fetchedFile?.Body) {
      throw new BadRequestException("failed to fetch this asset");
    }

    res.set("Cross-Origin-Resource-Policy", "cross-origin");
    res.setHeader("Content-Type", fetchedFile.ContentType || "application/octet-stream");

    if (shouldDownload === "true") {
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${requestedFilename || assetKey.split("/").pop()}"`
      );
    }

    return await s3WriteStreamPipeline(
      fetchedFile.Body as NodeJS.ReadableStream,
      res,
    );
  }
}
