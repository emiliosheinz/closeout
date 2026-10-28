import { z } from "zod";

/** A record id in a route (`storeId`, `id`, `imageId`, `userId`). */
export const uuidSchema = z.uuid();
