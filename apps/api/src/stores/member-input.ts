import { MIN_PASSWORD_LENGTH } from "@/auth/services/passwords";

// Parsers for the values a new member supplies, shared by every way of
// creating one so they all accept and store the same thing. Each returns null
// for invalid input and leaves the error message to the caller.

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Trimmed, lowercased email, or null when it is not an email address. */
export function parseEmail(input: string): string | null {
  const email = input.trim().toLowerCase();
  return EMAIL_PATTERN.test(email) ? email : null;
}

/** Trimmed name, or null when nothing is left. */
export function parseName(input: string): string | null {
  const name = input.trim();
  return name || null;
}

export function isLongEnoughPassword(password: string): boolean {
  return password.length >= MIN_PASSWORD_LENGTH;
}
