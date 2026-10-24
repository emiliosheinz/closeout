import { absoluteUrl, itemPath, storePath } from "../site";

describe("store URLs", () => {
  it("roots each store's storefront at its own path", () => {
    expect(storePath("nosso-desapego")).toBe("/store/nosso-desapego");
    expect(storePath("loja-da-bia")).toBe("/store/loja-da-bia");
  });

  it("puts each item under its store", () => {
    expect(itemPath("nosso-desapego", "mesa-abc123")).toBe(
      "/store/nosso-desapego/items/mesa-abc123",
    );
    expect(itemPath("loja-da-bia", "sofa-x9")).toBe(
      "/store/loja-da-bia/items/sofa-x9",
    );
  });

  it("makes store URLs absolute on the public origin", () => {
    process.env.PUBLIC_BASE_URL = "https://closeout.example/";
    expect(absoluteUrl(itemPath("loja-da-bia", "sofa-x9"))).toBe(
      "https://closeout.example/store/loja-da-bia/items/sofa-x9",
    );
  });
});
