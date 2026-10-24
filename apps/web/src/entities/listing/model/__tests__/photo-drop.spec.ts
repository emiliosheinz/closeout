import { planPhotoDrop } from "../photo-drop";

const files = (n: number) =>
  Array.from({ length: n }, (_, i) => new File(["x"], `f${i}.png`));

describe("planPhotoDrop", () => {
  it("names each rejected file", () => {
    expect(planPhotoDrop([], ["a.pdf", "b.gif"], 0).errors).toEqual([
      '"a.pdf" não é JPEG, PNG ou WebP.',
      '"b.gif" não é JPEG, PNG ou WebP.',
    ]);
  });

  it("uploads only the remaining capacity and reports the rest", () => {
    const plan = planPhotoDrop(files(5), [], 17);
    expect(plan.upload).toHaveLength(3);
    expect(plan.errors).toEqual(["2 fotos não enviadas: limite de 20."]);
  });

  it("uploads everything that fits without errors", () => {
    const plan = planPhotoDrop(files(3), [], 17);
    expect(plan.upload).toHaveLength(3);
    expect(plan.errors).toEqual([]);
  });

  it("uploads nothing when the listing is already over the cap", () => {
    const plan = planPhotoDrop(files(1), [], 22);
    expect(plan.upload).toEqual([]);
    expect(plan.errors).toEqual(["1 foto não enviada: limite de 20."]);
  });

  it("uploads nothing when the listing is full", () => {
    const plan = planPhotoDrop(files(1), [], 20);
    expect(plan.upload).toEqual([]);
    expect(plan.errors).toEqual(["1 foto não enviada: limite de 20."]);
  });
});
