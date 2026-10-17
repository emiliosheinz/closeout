import { rm } from "node:fs/promises";
import { runOnServer } from "./global-setup";

export default async function globalTeardown(): Promise<void> {
  const database = process.env.CLOSEOUT_TEST_DATABASE;
  if (database) {
    await runOnServer(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
  }
  if (process.env.MEDIA_DIR) {
    await rm(process.env.MEDIA_DIR, { recursive: true, force: true });
  }
}
