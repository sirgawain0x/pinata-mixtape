import {
  isGroveConfigured,
  resolveGroveUrl,
  uploadGroveFile,
  type GroveUpload,
} from "./grove";

export type PinataUpload = GroveUpload;

export const isPinataConfigured = isGroveConfigured;
export const gatewayUrl = resolveGroveUrl;
export const uploadFile = uploadGroveFile;
