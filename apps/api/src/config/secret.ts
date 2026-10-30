import { inspect } from "node:util";

const REDACTED = "[Redacted]";

/**
 * A configuration value that must never reach output. Serialising, inspecting
 * or interpolating it gives `[Redacted]`; only `reveal()` returns the value.
 */
export class Secret {
  readonly #value: string;

  constructor(value: string) {
    this.#value = value;
  }

  reveal(): string {
    return this.#value;
  }

  toString(): string {
    return REDACTED;
  }

  toJSON(): string {
    return REDACTED;
  }

  [inspect.custom](): string {
    return REDACTED;
  }
}
