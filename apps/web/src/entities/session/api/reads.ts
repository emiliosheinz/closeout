import { meSchema } from "@closeout/contracts/schemas";
import type { Read } from "@/shared/api";
import { sessionKeys } from "../model/keys";
import type { Me } from "../model/types";

export const sessionReads = {
  me: (): Read<Me> => ({
    queryKey: sessionKeys.me(),
    path: "/me",
    schema: meSchema,
  }),
};
