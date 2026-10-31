declare module "canvas-confetti" {
  interface Options {
    particleCount?: number;
    spread?: number;
    origin?: { x?: number; y?: number };
    disableForReducedMotion?: boolean;
  }
  type Fire = (options?: Options) => Promise<null> | null;
  export function create(
    canvas: HTMLCanvasElement | null,
    options?: { resize?: boolean; useWorker?: boolean },
  ): Fire;
}
