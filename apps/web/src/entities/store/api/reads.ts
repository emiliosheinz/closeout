import { storeSettingsSchema } from "@closeout/contracts/schemas";
import type { Read } from "@/shared/api";
import { storeKeys } from "../model/keys";
import type { StoreSettings } from "../model/types";

export const storeReads = {
  settings: (storeId: string): Read<StoreSettings> => ({
    queryKey: storeKeys.settings(storeId),
    path: `/stores/${storeId}`,
    schema: storeSettingsSchema,
  }),
};
