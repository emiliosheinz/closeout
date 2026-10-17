export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_FILES_PER_REQUEST = 8;
export const MAX_IMAGES_PER_LISTING = 20;

/**
 * Multer options shared by every image upload route. Without a `dest`,
 * Nest's FilesInterceptor keeps files in memory, which the image pipeline
 * needs anyway; the limits bound that memory per request.
 */
export const IMAGE_UPLOAD_OPTIONS = {
  limits: { fileSize: MAX_FILE_BYTES, files: MAX_FILES_PER_REQUEST },
};
