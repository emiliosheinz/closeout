import { createInterface } from "node:readline";
import type { Readable, Writable } from "node:stream";
import type { Secret } from "@/config/secret";
import { CommandError } from "./admin-commands";

export interface Terminal {
  input: Readable & { isTTY?: boolean };
  output: Writable;
}

/**
 * The operator's password: `CLOSEOUT_PASSWORD` when set, otherwise typed
 * twice at the terminal without echo.
 */
export async function readPassword(
  fromEnv: Secret | undefined,
  terminal: Terminal = { input: process.stdin, output: process.stdout },
): Promise<string> {
  if (fromEnv) return fromEnv.reveal();
  if (!terminal.input.isTTY) {
    throw new CommandError(
      "No TTY to prompt for a password; set CLOSEOUT_PASSWORD instead.",
    );
  }
  const first = await prompt("Password: ", terminal);
  const second = await prompt("Repeat password: ", terminal);
  if (first !== second) throw new CommandError("Passwords do not match.");
  return first;
}

/** Prompt without echoing what is typed. */
function prompt(
  question: string,
  { input, output }: Terminal,
): Promise<string> {
  const rl = createInterface({ input, output, terminal: true });
  const echo = rl as unknown as { _writeToOutput: (s: string) => void };
  echo._writeToOutput = (text: string) => {
    if (text.includes(question)) output.write(question);
  };
  return new Promise((resolve) =>
    rl.question(question, (answer) => {
      rl.close();
      output.write("\n");
      resolve(answer);
    }),
  );
}
