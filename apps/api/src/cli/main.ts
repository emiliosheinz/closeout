import "reflect-metadata";
import { parseArgs } from "node:util";
import { NestFactory } from "@nestjs/core";
import { DataSource } from "typeorm";
import { appModule } from "@/app.module";
import { SessionsService } from "@/auth/services/sessions.service";
import { ListingImagesService } from "@/catalog/services/listing-images.service";
import { ListingsService } from "@/catalog/services/listings.service";
import { cliScope } from "@/config/config";
import { parseOrExit } from "@/config/report";
import { StoresService } from "@/stores/services/stores.service";
import { WaitlistService } from "@/waitlist/services/waitlist.service";
import {
  CommandError,
  createAdmin,
  parseWhatsApp,
  resetPassword,
  type StoreIdentity,
} from "./admin-commands";
import { readPassword } from "./password";
import { DEMO_PASSWORD, seedDemo } from "./seed-demo";
import { listWaitlist, removeWaitlistSignup } from "./waitlist-commands";

const USAGE = `Usage:
  admin:create --store <slug> [--store-name <name>] --email <email> --name <name> [--whatsapp "+55 11 99999-8888"]
  admin:password --email <email>
  seed:demo --store <slug> [--store-name <name>] [--whatsapp "+55 11 99999-8888"]
  waitlist:list
  waitlist:remove --contact <email or phone>

The password is read from CLOSEOUT_PASSWORD or prompted for.
A missing store is created; --store-name is required then and ignored otherwise.
waitlist:list prints the waitlist as CSV, newest first.`;

async function main(): Promise<void> {
  const config = parseOrExit(cliScope);
  const [command, ...rest] = process.argv.slice(2);
  const { values } = parseArgs({
    args: rest,
    options: {
      store: { type: "string" },
      "store-name": { type: "string" },
      email: { type: "string" },
      name: { type: "string" },
      whatsapp: { type: "string" },
      contact: { type: "string" },
    },
  });

  if (
    !command ||
    ![
      "admin:create",
      "admin:password",
      "seed:demo",
      "waitlist:list",
      "waitlist:remove",
    ].includes(command)
  ) {
    console.error(USAGE);
    process.exitCode = 1;
    return;
  }

  // Checked before booting the app, so a usage mistake fails fast.
  if (["admin:create", "seed:demo"].includes(command) && !values.store) {
    console.error(`--store is required.\n\n${USAGE}`);
    process.exitCode = 1;
    return;
  }
  const store = (): StoreIdentity => ({
    slug: required(values.store, "--store"),
    name: values["store-name"],
  });

  const app = await NestFactory.createApplicationContext(appModule(config), {
    logger: ["error", "warn"],
  });
  try {
    const dataSource = app.get(DataSource);
    const stores = app.get(StoresService);

    if (command === "admin:create") {
      const result = await createAdmin(dataSource, stores, {
        email: required(values.email, "--email"),
        name: required(values.name, "--name"),
        password: await readPassword(config.cli.password),
        whatsapp: values.whatsapp,
        store: store(),
      });
      console.log(
        `Created ${result.role} ${values.email} for store ${values.store}.`,
      );
    } else if (command === "admin:password") {
      await resetPassword(dataSource, app.get(SessionsService), {
        email: required(values.email, "--email"),
        password: await readPassword(config.cli.password),
      });
      console.log("Password updated; existing sessions were signed out.");
    } else if (command === "waitlist:list") {
      console.log(await listWaitlist(app.get(WaitlistService)));
    } else if (command === "waitlist:remove") {
      console.log(
        await removeWaitlistSignup(
          app.get(WaitlistService),
          required(values.contact, "--contact"),
        ),
      );
    } else {
      const result = await seedDemo(
        dataSource,
        {
          stores,
          listings: app.get(ListingsService),
          images: app.get(ListingImagesService),
        },
        {
          store: store(),
          whatsapp: values.whatsapp ? parseWhatsApp(values.whatsapp) : null,
        },
      );
      if (result.skipped) {
        console.log("Store already has listings; demo seed skipped.");
      } else {
        console.log(`Created ${result.created} demo listings.`);
        if (result.accounts.length > 0) {
          console.log(
            `Demo accounts (password "${DEMO_PASSWORD}"): ${result.accounts.join(", ")}`,
          );
        }
      }
    }
  } catch (err) {
    if (!(err instanceof CommandError)) throw err;
    console.error(err.message);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

function required(value: string | undefined, name: string): string {
  if (!value) throw new CommandError(`${name} is required.\n\n${USAGE}`);
  return value;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
