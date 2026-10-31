import { parseSignupAttribution } from "../signup-attribution";

describe("parseSignupAttribution", () => {
  it.each([
    [
      { ref: "loja-x", src: "catalog-footer" },
      { ref: "loja-x", src: "catalog-footer" },
    ],
    [
      { ref: "loja-x", src: "landing" },
      { ref: "loja-x", src: "landing" },
    ],
    [{ src: "login" }, { src: "login" }],
    [{}, {}],
    [{ ref: "Loja X", src: "footer" }, {}],
    [{ ref: "Loja X", src: "landing" }, { src: "landing" }],
    [{ ref: "", src: "" }, {}],
    [{ ref: "a".repeat(101) }, {}],
    [{ ref: ["loja-x", "outra"], src: ["landing"] }, {}],
    [{ ref: undefined, src: undefined }, {}],
  ])("maps %j to %j", (params, expected) => {
    expect(parseSignupAttribution(params)).toEqual(expected);
  });
});
