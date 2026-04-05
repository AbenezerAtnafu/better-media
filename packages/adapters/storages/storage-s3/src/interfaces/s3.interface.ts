import { Buffer } from "node:buffer";

export enum EnumS3Accessibility {
  public = "public",
  private = "private",
}

export interface S3Object {
  bucket: string;
  key: string;
  cdnUrl?: string;
  completedUrl: string;
  mime: string;
  extension: string;
  access?: EnumS3Accessibility;
  size: number;
  data?: unknown; // Stream or Buffer-like object
}

export interface S3MultipartPart {
  size: number;
  eTag: string;
  partNumber: number;
}

export interface S3Multipart {
  bucket: string;
  key: string;
  uploadId: string;
  lastPartNumber: number;
  maxPartNumber: number;
  parts: S3MultipartPart[];
}

export interface S3Presign {
  key: string;
  mime: string;
  extension: string;
  presignUrl: string;
  expiredIn: number;
}

export interface S3PresignPart extends S3Presign {
  size: number;
  partNumber: number;
}

export interface S3Options {
  access?: EnumS3Accessibility;
}

export interface S3PutItemOptions extends S3Options {
  forceUpdate?: boolean;
}

export interface S3GetItemsOptions extends S3Options {
  continuationToken?: string;
}

export type S3DeleteDirOptions = S3GetItemsOptions;

export interface S3PresignGetItemOptions extends S3Options {
  expired?: number;
}

export interface S3PresignPutItemOptions extends S3PutItemOptions {
  expired?: number;
}

export interface S3PresignPutItemPartOptions extends S3Options {
  expired?: number;
}

export interface S3MoveItemOptions {
  accessFrom?: EnumS3Accessibility;
  accessTo?: EnumS3Accessibility;
}

export interface S3CreateMultiplePart {
  key: string;
  size?: number;
}

export interface S3PutItem extends S3CreateMultiplePart {
  file: Buffer;
}
