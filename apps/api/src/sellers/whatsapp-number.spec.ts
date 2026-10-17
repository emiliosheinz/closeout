import { normalizeWhatsAppNumber } from "./whatsapp-number";

describe("normalizeWhatsAppNumber", () => {
  it("keeps only the digits of a number written with its country code", () => {
    expect(normalizeWhatsAppNumber("+55 (11) 99999-8888")).toBe(
      "5511999998888",
    );
    expect(normalizeWhatsAppNumber(" +1 415.555.0100 ")).toBe("14155550100");
  });

  it("rejects numbers without the leading + country code", () => {
    expect(normalizeWhatsAppNumber("11 99999-8888")).toBeNull();
    expect(normalizeWhatsAppNumber("5511999998888")).toBeNull();
  });

  it("rejects text and out-of-range lengths", () => {
    expect(normalizeWhatsAppNumber("+55 abc")).toBeNull();
    expect(normalizeWhatsAppNumber("+1234567")).toBeNull();
    expect(normalizeWhatsAppNumber("+1234567890123456")).toBeNull();
    expect(normalizeWhatsAppNumber("+0 11 99999 8888")).toBeNull();
  });
});
