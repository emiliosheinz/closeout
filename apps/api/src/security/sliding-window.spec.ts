import { SlidingWindowCounter } from "./sliding-window";

const MINUTE = 60 * 1000;

describe("SlidingWindowCounter", () => {
  it("counts events per key within the window", () => {
    const counter = new SlidingWindowCounter(15 * MINUTE);
    for (let i = 0; i < 10; i++) counter.record("a", 0);
    counter.record("b", 0);
    expect(counter.count("a", 0)).toBe(10);
    expect(counter.count("b", 0)).toBe(1);
    expect(counter.count("c", 0)).toBe(0);
  });

  it("drops events once the window has passed", () => {
    const counter = new SlidingWindowCounter(15 * MINUTE);
    counter.record("a", 0);
    counter.record("a", 5 * MINUTE);
    expect(counter.count("a", 15 * MINUTE - 1)).toBe(2);
    expect(counter.count("a", 15 * MINUTE)).toBe(1);
    expect(counter.count("a", 20 * MINUTE)).toBe(0);
  });

  it("forgets the latest event or all of a key", () => {
    const counter = new SlidingWindowCounter(MINUTE);
    counter.record("a", 0);
    counter.record("a", 1);
    counter.forgetLatest("a", 1);
    expect(counter.count("a", 1)).toBe(1);
    counter.clear("a");
    expect(counter.count("a", 1)).toBe(0);
  });
});
