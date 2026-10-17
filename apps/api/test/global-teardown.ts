import { rm } from "node:fs/promises";
import { Client } from "pg";
import { connection } from "./global-setup";

export default async function globalTeardown(): Promise<void> {
  const database = process.env.CLOSEOUT_TEST_DATABASE;
  if (!database) return;
  const admin = new Client(connection("postgres"));
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
  await admin.end();
  if (process.env.MEDIA_DIR) {
    await rm(process.env.MEDIA_DIR, { recursive: true, force: true });
  }
}
