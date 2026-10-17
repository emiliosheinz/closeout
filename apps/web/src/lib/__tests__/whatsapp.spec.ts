import { listingContactUrl, sellerContactUrl } from "../whatsapp";

describe("listingContactUrl", () => {
  it("links to the seller's number with the encoded message", () => {
    const url = listingContactUrl(
      "5511999998888",
      "Mesa & cadeiras",
      "https://loja.example/itens/mesa-cadeiras-abc123",
    );
    expect(url).toBe(
      "https://wa.me/5511999998888?text=Oi!%20Tenho%20interesse%20no%20item%20%22Mesa%20%26%20cadeiras%22%20que%20vi%20no%20cat%C3%A1logo%20de%20voc%C3%AAs%3A%20https%3A%2F%2Floja.example%2Fitens%2Fmesa-cadeiras-abc123.%20Ele%20ainda%20est%C3%A1%20dispon%C3%ADvel%3F",
    );
  });

  it("round-trips the title and listing URL through the text parameter", () => {
    const url = listingContactUrl(
      "14155550100",
      "Sofá #2 ?=&",
      "https://x.y/itens/a?b=c",
    );
    const text = new URL(url ?? "").searchParams.get("text");
    expect(text).toContain('"Sofá #2 ?=&"');
    expect(text).toContain("https://x.y/itens/a?b=c");
  });

  it("returns null without a valid international number", () => {
    expect(listingContactUrl(null, "Mesa", "https://x.y")).toBeNull();
    expect(listingContactUrl("", "Mesa", "https://x.y")).toBeNull();
    expect(
      listingContactUrl("+5511999998888", "Mesa", "https://x.y"),
    ).toBeNull();
    expect(listingContactUrl("123", "Mesa", "https://x.y")).toBeNull();
  });
});

describe("sellerContactUrl", () => {
  it("rejects malformed numbers", () => {
    expect(sellerContactUrl("abc", "Loja")).toBeNull();
    expect(sellerContactUrl("5511999998888", "Loja")).toMatch(
      /^https:\/\/wa\.me\/5511999998888\?text=/,
    );
  });
});
