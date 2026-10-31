import { type BuyerRef, buyerNameKey } from "@closeout/contracts/schemas";
import { HttpStatus } from "@nestjs/common";
import { type EntityManager, IsNull } from "typeorm";
import { AppException } from "@/problem/app-exception";
import { Buyer } from "./entities/buyer.entity";

export const BUYER_NOT_IN_STORE =
  "Esse comprador foi juntado ou removido. Escolha o comprador de novo.";

type ResolvedBuyer = Pick<Buyer, "id" | "name" | "whatsappNumber">;

/**
 * The store's buyer a reference points at, inside the caller's transaction.
 * An id must belong to the store. A name finds the buyer under the same
 * normalized key or creates it, keeping the first spelling. Either way a
 * given phone is stored only when the buyer has none.
 */
export async function resolveBuyer(
  manager: EntityManager,
  storeId: string,
  ref: BuyerRef,
): Promise<ResolvedBuyer> {
  const whatsappNumber = ref.whatsappNumber ?? null;
  const buyers = manager.getRepository(Buyer);

  if ("id" in ref) {
    const buyer = await buyers.findOneBy({ id: ref.id, storeId });
    if (!buyer) throw new AppException(HttpStatus.CONFLICT, BUYER_NOT_IN_STORE);
    if (whatsappNumber && !buyer.whatsappNumber) {
      await buyers.update(
        { id: buyer.id, whatsappNumber: IsNull() },
        { whatsappNumber },
      );
      buyer.whatsappNumber = whatsappNumber;
    }
    return buyer;
  }

  // TypeORM's insert builder has no raw ON CONFLICT clause, and the upsert
  // helper would overwrite an existing phone.
  const [row] = await manager.query<
    { id: string; name: string; whatsapp_number: string | null }[]
  >(
    `INSERT INTO buyers (store_id, name, name_key, whatsapp_number)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (store_id, name_key) DO UPDATE
       SET whatsapp_number = COALESCE(buyers.whatsapp_number, EXCLUDED.whatsapp_number)
     RETURNING id, name, whatsapp_number`,
    [storeId, ref.name, buyerNameKey(ref.name), whatsappNumber],
  );
  if (!row) throw new Error("Buyer upsert returned no row");
  return { id: row.id, name: row.name, whatsappNumber: row.whatsapp_number };
}
