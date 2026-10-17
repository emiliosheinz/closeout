import sharp from "sharp";
import type { DataSource } from "typeorm";
import { Listing } from "@/catalog/entities/listing.entity";
import type {
  Availability,
  Condition,
  ListingAttribute,
  Publication,
} from "@/catalog/listing-types";
import type { ListingImagesService } from "@/catalog/services/listing-images.service";
import type { ListingsService } from "@/catalog/services/listings.service";
import { Seller } from "@/sellers/entities/seller.entity";
import { Category } from "@/stores/entities/category.entity";
import type { StoresService } from "@/stores/services/stores.service";
import { ensureStore, type StoreIdentity } from "./admin-commands";

/** Marks every demo listing so nobody mistakes it for a real item. */
const DEMO_ATTRIBUTE: ListingAttribute = {
  label: "Observação",
  value: "Anúncio de demonstração",
};
const DEMO_NOTE =
  "Anúncio de demonstração criado pelo seed de desenvolvimento. A imagem é ilustrativa.";

interface DemoListing {
  title: string;
  category: string;
  priceCents: number | null;
  condition: Condition;
  availability: Availability;
  publication: Publication;
  seller: 0 | 1;
  description: string;
  attributes: ListingAttribute[];
  images: number;
}

const DEMO_LISTINGS: DemoListing[] = [
  {
    title: "Sofá retrátil 3 lugares",
    category: "moveis",
    priceCents: 120000,
    condition: "good",
    availability: "available",
    publication: "published",
    seller: 0,
    description:
      "Sofá retrátil e reclinável, tecido suede cinza. Sem rasgos, só um leve desbotado no braço esquerdo. Precisa de carro grande ou frete para levar.",
    attributes: [
      { label: "Dimensões", value: "2,10 m × 0,95 m × 1,00 m" },
      { label: "Cor", value: "Cinza" },
    ],
    images: 3,
  },
  {
    title: "Mesa de jantar com 4 cadeiras",
    category: "moveis",
    priceCents: 85000,
    condition: "like_new",
    availability: "reserved",
    publication: "published",
    seller: 1,
    description:
      "Mesa de madeira maciça com tampo de vidro e quatro cadeiras estofadas. Usamos pouco, está como nova.",
    attributes: [{ label: "Tampo", value: "1,40 m × 0,90 m" }],
    images: 2,
  },
  {
    title: 'Smart TV 50" 4K',
    category: "eletronicos",
    priceCents: 160000,
    condition: "good",
    availability: "available",
    publication: "published",
    seller: 0,
    description:
      "TV 4K com Wi-Fi, funcionando perfeitamente. Acompanha controle remoto e base original (sem o suporte de parede).",
    attributes: [
      { label: "Tamanho", value: "50 polegadas" },
      { label: "Ano de compra", value: "2022" },
    ],
    images: 2,
  },
  {
    title: "Fone de ouvido Bluetooth",
    category: "eletronicos",
    priceCents: 18000,
    condition: "like_new",
    availability: "available",
    publication: "published",
    seller: 1,
    description: "Fone over-ear com cancelamento de ruído. Na caixa, com cabo.",
    attributes: [],
    images: 1,
  },
  {
    title: "Geladeira frost free 375 L",
    category: "eletrodomesticos",
    priceCents: 180000,
    condition: "good",
    availability: "available",
    publication: "published",
    seller: 0,
    description:
      "Geladeira duplex inox, gelando muito bem. Pequeno amassado na lateral que fica encostada na parede.",
    attributes: [{ label: "Voltagem", value: "220 V" }],
    images: 2,
  },
  {
    title: "Máquina de lavar 11 kg",
    category: "eletrodomesticos",
    priceCents: null,
    condition: "fair",
    availability: "available",
    publication: "published",
    seller: 1,
    description:
      "Funciona bem, mas faz barulho na centrifugação. Aceitamos proposta.",
    attributes: [{ label: "Voltagem", value: "127 V" }],
    images: 1,
  },
  {
    title: "Air fryer 4 L",
    category: "cozinha",
    priceCents: 22000,
    condition: "good",
    availability: "sold",
    publication: "published",
    seller: 1,
    description: "Air fryer com cesto antiaderente. Tudo funcionando.",
    attributes: [],
    images: 1,
  },
  {
    title: "Jogo de panelas inox 5 peças",
    category: "cozinha",
    priceCents: 25000,
    condition: "like_new",
    availability: "available",
    publication: "published",
    seller: 0,
    description: "Panelas de fundo triplo, compatíveis com indução.",
    attributes: [{ label: "Peças", value: "5" }],
    images: 1,
  },
  {
    title: "Luminária de piso",
    category: "casa-e-decoracao",
    priceCents: 15000,
    condition: "good",
    availability: "available",
    publication: "published",
    seller: 1,
    description: "Luminária de piso com cúpula de linho. Lâmpada não inclusa.",
    attributes: [{ label: "Altura", value: "1,60 m" }],
    images: 1,
  },
  {
    title: "Tapete 2 × 1,5 m",
    category: "casa-e-decoracao",
    priceCents: 9000,
    condition: "fair",
    availability: "available",
    publication: "published",
    seller: 0,
    description: "Tapete felpudo bege. Lavado, mas com uma manchinha discreta.",
    attributes: [],
    images: 1,
  },
  {
    title: "Bicicleta aro 29",
    category: "esporte-e-lazer",
    priceCents: 140000,
    condition: "good",
    availability: "available",
    publication: "published",
    seller: 0,
    description:
      "Mountain bike 21 marchas, freio a disco. Revisada no começo do ano.",
    attributes: [
      { label: "Quadro", value: "17" },
      { label: "Marchas", value: "21" },
    ],
    images: 2,
  },
  {
    title: "Tapete de yoga e halteres",
    category: "esporte-e-lazer",
    priceCents: 12000,
    condition: "like_new",
    availability: "available",
    publication: "published",
    seller: 1,
    description: "Tapete de yoga 6 mm e um par de halteres de 3 kg.",
    attributes: [],
    images: 1,
  },
  {
    title: "Coleção de livros de ficção",
    category: "livros-e-midia",
    priceCents: 6000,
    condition: "good",
    availability: "available",
    publication: "published",
    seller: 1,
    description: "Doze livros de ficção em português. Vendemos o lote junto.",
    attributes: [{ label: "Quantidade", value: "12 livros" }],
    images: 1,
  },
  {
    title: "Cadeira de escritório",
    category: "moveis",
    priceCents: 30000,
    condition: "for_parts",
    availability: "available",
    publication: "draft",
    seller: 0,
    description: "Pistão com defeito. Rascunho ainda não publicado.",
    attributes: [],
    images: 0,
  },
];

const PALETTES: Record<string, [string, string]> = {
  moveis: ["#e9d8c4", "#b5835a"],
  eletronicos: ["#d7dde8", "#5a6d8c"],
  eletrodomesticos: ["#dfe7e2", "#5f8a75"],
  cozinha: ["#f1dccf", "#c0603a"],
  "casa-e-decoracao": ["#eadfd0", "#9a7b52"],
  "esporte-e-lazer": ["#dbe6d5", "#6b8f4e"],
  "livros-e-midia": ["#e6dbe6", "#80608a"],
  "roupas-e-acessorios": ["#efd9df", "#b45d74"],
  outros: ["#e5e2dc", "#7d766b"],
};

/**
 * Abstract placeholder art: soft shapes in the category's colors. It is
 * deliberately not a picture of anything, so it can never pass for a real
 * product photo.
 */
export async function placeholderImage(
  category: string,
  variant: number,
): Promise<Buffer> {
  const [light, dark] = PALETTES[category] ?? ["#e5e2dc", "#7d766b"];
  const cx = 420 + variant * 180;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900">
  <rect width="1200" height="900" fill="${light}"/>
  <circle cx="${cx}" cy="420" r="230" fill="${dark}" fill-opacity="0.28"/>
  <rect x="${cx - 40}" y="300" width="420" height="300" rx="36" fill="${dark}" fill-opacity="0.45"/>
  <rect x="0" y="720" width="1200" height="180" fill="${dark}" fill-opacity="0.12"/>
</svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 80 }).toBuffer();
}

export interface SeedDeps {
  stores: StoresService;
  listings: ListingsService;
  images: ListingImagesService;
}

/**
 * Populate a store with demo listings. Idempotent: a store that already has
 * listings is left untouched. Demo sellers get a WhatsApp number only when
 * one is passed explicitly, so the seed never links to a stranger's phone.
 */
export async function seedDemo(
  dataSource: DataSource,
  deps: SeedDeps,
  options: { store: StoreIdentity; whatsapp: string | null },
): Promise<{ created: number; skipped: boolean }> {
  const store = await dataSource.transaction((manager) =>
    ensureStore(manager, deps.stores, options.store),
  );
  if (
    await dataSource
      .getRepository(Listing)
      .exists({ where: { storeId: store.id } })
  ) {
    return { created: 0, skipped: true };
  }

  if (!store.headline && !store.intro) {
    await deps.stores.updateSettings(store.id, {
      headline: "Estamos de mudança e tudo precisa de um novo lar",
      intro:
        "Juntamos aqui as coisas que não vão com a gente para o apartamento novo. Tudo usado com carinho e com o estado descrito com sinceridade. Gostou de algo? Chama no WhatsApp.",
    });
  }

  const sellerRepo = dataSource.getRepository(Seller);
  const sellers = await Promise.all(
    ["Vendedor de exemplo", "Vendedora de exemplo"].map((displayName) =>
      sellerRepo.save({
        storeId: store.id,
        userId: null,
        displayName,
        whatsappNumber: options.whatsapp,
        avatarKey: null,
      }),
    ),
  );
  const categories = await dataSource
    .getRepository(Category)
    .find({ where: { storeId: store.id } });
  const categoryId = (slug: string) => {
    const category = categories.find((c) => c.slug === slug);
    if (!category) throw new Error(`Missing default category ${slug}`);
    return category.id;
  };

  for (const demo of DEMO_LISTINGS) {
    const seller = sellers[demo.seller];
    if (!seller) throw new Error("Demo seller index out of range");
    const listing = await deps.listings.create(store.id, {
      title: demo.title,
      description: `${demo.description}\n\n${DEMO_NOTE}`,
      categoryId: categoryId(demo.category),
      sellerId: seller.id,
      priceCents: demo.priceCents,
      condition: demo.condition,
      attributes: [...demo.attributes, DEMO_ATTRIBUTE],
    });
    if (demo.images > 0) {
      const files = await Promise.all(
        Array.from({ length: demo.images }, (_, i) =>
          placeholderImage(demo.category, i),
        ),
      );
      await deps.images.add(store.id, listing.id, files);
    }
    await deps.listings.update(store.id, listing.id, {
      publication: demo.publication,
      availability: demo.availability,
    });
  }
  return { created: DEMO_LISTINGS.length, skipped: false };
}
