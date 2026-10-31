import type { WaitlistService } from "@/waitlist/services/waitlist.service";
import { CommandError } from "./admin-commands";

const HEADER = "created_at,name,channel,contact,ref,src";
/** Cells starting with one of these would run as formulas in a spreadsheet. */
const FORMULA_START = /^[-+=@']/;

/**
 * A CSV cell: a value that could be read as a formula gets one leading
 * quote (so dropping one restores it), then RFC 4180 quoting if needed.
 */
function cell(value: string | null): string {
  if (!value) return "";
  const guarded = FORMULA_START.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(guarded)
    ? `"${guarded.replaceAll('"', '""')}"`
    : guarded;
}

/** Every signup as CSV, newest first. */
export async function listWaitlist(waitlist: WaitlistService): Promise<string> {
  const rows = (await waitlist.list()).map((signup) =>
    [
      signup.createdAt.toISOString(),
      signup.name,
      signup.channel,
      signup.contact,
      signup.ref,
      signup.src,
    ]
      .map(cell)
      .join(","),
  );
  return [HEADER, ...rows].join("\n");
}

/**
 * The stored form of a contact typed or copied from `waitlist:list`: one
 * leading guard quote is dropped, an address is trimmed and lowercased, and
 * anything else keeps only its digits.
 */
function storedContact(input: string): string {
  const value = input.startsWith("'") ? input.slice(1) : input;
  return value.includes("@")
    ? value.trim().toLowerCase()
    : value.replace(/\D/g, "");
}

/** Delete the signup with this contact; returns the line to print. */
export async function removeWaitlistSignup(
  waitlist: WaitlistService,
  input: string,
): Promise<string> {
  const contact = storedContact(input);
  if (!contact) {
    throw new CommandError(
      "--contact must be an e-mail address or a phone number.",
    );
  }
  if (!(await waitlist.remove(contact))) {
    throw new CommandError(`No waitlist signup for ${contact}.`);
  }
  return `Removed waitlist signup ${contact}.`;
}
