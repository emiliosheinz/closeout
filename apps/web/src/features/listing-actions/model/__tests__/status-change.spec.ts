import { statusMessage } from "../status-change";

const sale = {
  buyer: { id: "b-1", name: "Maria" },
  agreedPriceCents: 7000,
  paid: false,
  notes: null,
};

describe("statusMessage", () => {
  it("names the availability without a buyer", () => {
    expect(
      statusMessage({
        id: "a",
        title: "Sofá azul",
        patch: { availability: "reserved" },
        body: {},
      }),
    ).toBe('"Sofá azul" marcado como reservado.');
  });

  it("names the buyer when one is attached", () => {
    expect(
      statusMessage({
        id: "a",
        title: "Sofá azul",
        patch: { availability: "sold", sale },
        body: {},
      }),
    ).toBe('"Sofá azul" vendido para Maria.');
  });

  it("does not name the buyer on release", () => {
    expect(
      statusMessage({
        id: "a",
        title: "Sofá azul",
        patch: { availability: "available", sale: null },
        body: {},
      }),
    ).toBe('"Sofá azul" marcado como disponível.');
  });

  it("reports a sale edit", () => {
    expect(
      statusMessage({ id: "a", title: "Sofá azul", patch: { sale }, body: {} }),
    ).toBe('Venda de "Sofá azul" atualizada.');
  });
});
