import "reflect-metadata";
import { createInterface } from "node:readline";
import { parseArgs } from "node:util";
import { NestFactory } from "@nestjs/core";
import { DataSource } from "typeorm";
import { AppModule } from "@/app.module";
import { SessionsService } from "@/auth/services/sessions.service";
import { ListingImagesService } from "@/catalog/services/listing-images.service";
import { ListingsService } from "@/catalog/services/listings.service";
import { StoresService } from "@/stores/services/stores.service";
import {
  CommandError,
  createAdmin,
  parseWhatsApp,
  resetPassword,
  type StoreIdentity,
} from "./admin-commands";
import { seedDemo } from "./seed-demo";

const USAGE = `Usage:
  admin:create --email <email> --name <name> [--whatsapp "+55 11 99999-8888"]
  admin:password --email <email>
  seed:demo [--whatsapp "+55 11 99999-8888"]

The password is read from CLOSEOUT_PASSWORD or prompted for.
The store comes from STORE_SLUG / STORE_NAME and is created when missing.`;

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);
  const { values } = parseArgs({
    args: rest,
    options: {
      email: { type: "string" },
      name: { type: "string" },
      whatsapp: { type: "string" },
    },
  });

  if (
    !command ||
    !["admin:create", "admin:password", "seed:demo"].includes(command)
  ) {
    console.error(USAGE);
    process.exitCode = 1;
    return;
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn"],
  });
  try {
    const dataSource = app.get(DataSource);
    const stores = app.get(StoresService);

    if (command === "admin:create") {
      const result = await createAdmin(dataSource, stores, {
        email: required(values.email, "--email"),
        name: required(values.name, "--name"),
        password: await readPassword(),
        whatsapp: values.whatsapp,
        store: storeFromEnv(),
      });
      console.log(
        `Created ${result.role} ${values.email} for store ${storeFromEnv().slug}.`,
      );
    } else if (command === "admin:password") {
      await resetPassword(dataSource, app.get(SessionsService), {
        email: required(values.email, "--email"),
        password: await readPassword(),
      });
      console.log("Password updated; existing sessions were signed out.");
    } else {
      const result = await seedDemo(
        dataSource,
        {
          stores,
          listings: app.get(ListingsService),
          images: app.get(ListingImagesService),
        },
        {
          store: storeFromEnv(),
          whatsapp: values.whatsapp ? parseWhatsApp(values.whatsapp) : null,
        },
      );
      console.log(
        result.skipped
          ? "Store already has listings; demo seed skipped."
          : `Created ${result.created} demo listings.`,
      );
    }
  } catch (err) {
    if (!(err instanceof CommandError)) throw err;
    console.error(err.message);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

function storeFromEnv(): StoreIdentity {
  return {
    slug: required(process.env.STORE_SLUG, "STORE_SLUG"),
    name: required(process.env.STORE_NAME, "STORE_NAME"),
  };
}

function required(value: string | undefined, name: string): string {
  if (!value) throw new CommandError(`${name} is required.\n\n${USAGE}`);
  return value;
}

async function readPassword(): Promise<string> {
  const fromEnv = process.env.CLOSEOUT_PASSWORD;
  if (fromEnv) return fromEnv;
  if (!process.stdin.isTTY) {
    throw new CommandError(
      "No TTY to prompt for a password; set CLOSEOUT_PASSWORD instead.",
    );
  }
  const first = await prompt("Password: ");
  const second = await prompt("Repeat password: ");
  if (first !== second) throw new CommandError("Passwords do not match.");
  return first;
}

/** Prompt without echoing what is typed. */
function prompt(question: string): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });
  const output = rl as unknown as { _writeToOutput: (s: string) => void };
  output._writeToOutput = (text: string) => {
    if (text.includes(question)) process.stdout.write(question);
  };
  return new Promise((resolve) =>
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    }),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
