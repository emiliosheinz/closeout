export interface ImageUrls {
  sm: string;
  lg: string;
  og: string;
}

/** Same-origin public paths of an image's variants. */
export function mediaUrls(key: string): ImageUrls {
  return {
    sm: `/media/${key}-sm.webp`,
    lg: `/media/${key}-lg.webp`,
    og: `/media/${key}-og.jpg`,
  };
}

export function mediaFileNames(key: string): string[] {
  return [`${key}-sm.webp`, `${key}-lg.webp`, `${key}-og.jpg`];
}
