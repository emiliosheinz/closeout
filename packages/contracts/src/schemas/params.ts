import { z } from "zod";

/** A record id in a route (`storeId`, `id`, `imageId`, `userId`). */
export const uuidSchema = z.uuid();

/**
 * A free-text route segment (a store or listing slug, a media file name).
 * Any value parses: a malformed one is unknown, and the handler answers 404.
 */
export const routeNameSchema = z.string();
