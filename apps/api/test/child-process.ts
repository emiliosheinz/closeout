import { type ChildProcess, spawn } from "node:child_process";
import { once } from "node:events";
import { connect, createServer } from "node:net";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const API_ROOT = path.join(__dirname, "..");
const HOST = "127.0.0.1";

export interface Exit {
  code: number | null;
  signal: NodeJS.Signals | null;
}

export interface BuiltProcess {
  child: ChildProcess;
  stdout: () => string;
  stderr: () => string;
  /** Settles once the process has exited. */
  exit: Promise<Exit>;
}

export interface BuiltServer extends BuiltProcess {
  url: string;
}

/** A port nothing listens on right now, picked by the OS. */
export async function freePort(): Promise<number> {
  const server = createServer().listen(0, HOST);
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Expected a TCP address");
  }
  server.close();
  await once(server, "close");
  return address.port;
}

/**
 * Run a script from the API build output (`dist/`), with the test run's env
 * plus `env`, capturing its output.
 */
export function runBuilt(
  script: string,
  env: NodeJS.ProcessEnv = {},
  args: string[] = [],
): BuiltProcess {
  return runInApi(process.execPath, [path.join("dist", script), ...args], env);
}

/**
 * Run a command from the API package directory, with the test run's env
 * plus `env`, capturing its output.
 */
export function runInApi(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv = {},
): BuiltProcess {
  const child = spawn(command, args, {
    cwd: API_ROOT,
    env: { ...process.env, ...env },
  });
  let stdout = "";
  let stderr = "";
  child.stdout?.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr?.on("data", (chunk) => {
    stderr += chunk;
  });
  const exit = once(child, "exit").then(([code, signal]) => ({
    code,
    signal,
  }));
  return { child, stdout: () => stdout, stderr: () => stderr, exit };
}

/** Start the built server on a free port and wait until it accepts connections. */
export async function startBuiltServer(
  env: NodeJS.ProcessEnv = {},
  timeoutMs = 20_000,
): Promise<BuiltServer> {
  const port = await freePort();
  const server = runBuilt("main.js", { HOST, PORT: String(port), ...env });
  let exited = false;
  void server.exit.then(() => {
    exited = true;
  });
  const deadline = Date.now() + timeoutMs;
  while (!(await accepts(port))) {
    if (exited) {
      throw new Error(`Server exited before listening:\n${server.stderr()}`);
    }
    if (Date.now() > deadline) {
      server.child.kill("SIGKILL");
      throw new Error(`Server did not listen within ${timeoutMs} ms`);
    }
    await sleep(100);
  }
  return { ...server, url: `http://${HOST}:${port}` };
}

/** True when something accepts TCP connections on `port`. */
export function accepts(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect(port, HOST);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });
}
