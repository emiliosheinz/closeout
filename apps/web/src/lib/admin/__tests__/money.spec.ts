import { centsToInput, parsePriceToCents } from "../money";

describe("parsePriceToCents", () => {
  it.each([
    ["1.200,50", 120050],
    ["1200,5", 120050],
    ["R$ 80", 8000],
    ["1200", 120000],
    ["1.200", 120000],
    ["12.5", 1250],
    ["0", 0],
    ["123.456,78", 12345678],
  ])("reads %s as %i cents", (input, cents) => {
    expect(parsePriceToCents(input)).toBe(cents);
  });

  it.each([
    "",
    "abc",
    "-10",
    "1,2,3",
    "10,999",
    "2.000.000,00",
  ])("rejects %p", (input) => {
    expect(parsePriceToCents(input)).toBeNull();
  });
});

describe("centsToInput", () => {
  it("renders cents for editing", () => {
    expect(centsToInput(120050)).toBe("1200,50");
    expect(centsToInput(8000)).toBe("80");
    expect(centsToInput(5)).toBe("0,05");
    expect(centsToInput(null)).toBe("");
  });
});
