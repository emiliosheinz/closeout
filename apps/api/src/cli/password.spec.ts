import { PassThrough, Writable } from "node:stream";
import { Secret } from "@/config/secret";
import { readPassword, type Terminal } from "./password";

/** A terminal that types the next answer each time a prompt is shown. */
function fakeTerminal(answers: string[], isTTY = true) {
  const input = Object.assign(new PassThrough(), { isTTY });
  let shown = "";
  const output = new Writable({
    write(chunk, _encoding, done) {
      shown += chunk;
      if (String(chunk).endsWith(": ")) {
        setImmediate(() => input.write(`${answers.shift()}\n`));
      }
      done();
    },
  });
  const terminal: Terminal = { input, output };
  return { terminal, shown: () => shown };
}

describe("readPassword", () => {
  it("uses CLOSEOUT_PASSWORD without prompting", async () => {
    const { terminal, shown } = fakeTerminal([]);
    await expect(
      readPassword(new Secret("from the env"), terminal),
    ).resolves.toBe("from the env");
    expect(shown()).toBe("");
  });

  it("prompts twice on a TTY without echoing what is typed", async () => {
    const { terminal, shown } = fakeTerminal([
      "typed secret 42",
      "typed secret 42",
    ]);
    await expect(readPassword(undefined, terminal)).resolves.toBe(
      "typed secret 42",
    );
    expect(shown()).toContain("Password: ");
    expect(shown()).toContain("Repeat password: ");
    expect(shown()).not.toContain("typed secret");
  });

  it("refuses answers that do not match", async () => {
    const { terminal } = fakeTerminal(["first answer", "second answer"]);
    await expect(readPassword(undefined, terminal)).rejects.toThrow(
      "Passwords do not match.",
    );
  });

  it("asks for CLOSEOUT_PASSWORD when there is no TTY to prompt on", async () => {
    const { terminal, shown } = fakeTerminal([], false);
    await expect(readPassword(undefined, terminal)).rejects.toThrow(
      "No TTY to prompt for a password; set CLOSEOUT_PASSWORD instead.",
    );
    expect(shown()).toBe("");
  });
});
