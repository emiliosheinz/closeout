import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import type { DataSource, EntityManager } from "typeorm";
import { MediaService, type StoredImage } from "@/media/media.service";
import { mediaUrls } from "@/media/media-urls";
import { MAX_IMAGES_PER_LISTING } from "@/media/upload-limits";
import { Listing } from "../entities/listing.entity";
import { ListingImage } from "../entities/listing-image.entity";
import { isPubliclyVisible } from "../listing-rules";
import type { AdminImage } from "./listings.service";

@Injectable()
export class ListingImagesService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly media: MediaService,
  ) {}

  /**
   * Process uploads one at a time (bounded memory), then insert all rows in
   * one transaction. Any failure removes the files written by this call, so
   * a failed upload leaves neither rows nor files behind.
   */
  async add(
    storeId: string,
    listingId: string,
    files: Buffer[],
  ): Promise<AdminImage[]> {
    const existing = await this.countImages(
      this.dataSource.manager,
      storeId,
      listingId,
    );
    if (existing + files.length > MAX_IMAGES_PER_LISTING) {
      throw new UnprocessableEntityException(
        `Cada anúncio pode ter até ${MAX_IMAGES_PER_LISTING} fotos.`,
      );
    }

    const stored: StoredImage[] = [];
    try {
      for (const file of files) stored.push(await this.media.store(file));
      return await this.dataSource.transaction(async (manager) => {
        const count = await this.countImages(manager, storeId, listingId);
        if (count + stored.length > MAX_IMAGES_PER_LISTING) {
          throw new UnprocessableEntityException(
            `Cada anúncio pode ter até ${MAX_IMAGES_PER_LISTING} fotos.`,
          );
        }
        await manager.getRepository(ListingImage).save(
          stored.map((image, index) => ({
            storeId,
            listingId,
            storageKey: image.key,
            width: image.width,
            height: image.height,
            position: count + index,
          })),
        );
        return this.listImages(manager, listingId);
      });
    } catch (err) {
      for (const image of stored) await this.media.remove(image.key);
      throw err;
    }
  }

  /** `ids` must be exactly the listing's images, in the new order. */
  async reorder(
    storeId: string,
    listingId: string,
    ids: string[],
  ): Promise<AdminImage[]> {
    return this.dataSource.transaction(async (manager) => {
      await this.lockListing(manager, storeId, listingId);
      const current = await manager
        .getRepository(ListingImage)
        .find({ where: { listingId } });
      const currentIds = new Set(current.map((image) => image.id));
      const sameSet =
        ids.length === current.length &&
        new Set(ids).size === ids.length &&
        ids.every((id) => currentIds.has(id));
      if (!sameSet) {
        throw new UnprocessableEntityException(
          "A nova ordem precisa conter todas as fotos do anúncio.",
        );
      }
      for (const [position, id] of ids.entries()) {
        await manager
          .getRepository(ListingImage)
          .update({ id, listingId }, { position });
      }
      return this.listImages(manager, listingId);
    });
  }

  async remove(
    storeId: string,
    listingId: string,
    imageId: string,
  ): Promise<AdminImage[]> {
    const { key, images } = await this.dataSource.transaction(
      async (manager) => {
        const listing = await this.lockListing(manager, storeId, listingId);
        const repo = manager.getRepository(ListingImage);
        const remaining = await repo.find({
          where: { listingId },
          order: { position: "ASC" },
        });
        const target = remaining.find((image) => image.id === imageId);
        if (!target) throw new NotFoundException("Foto não encontrada.");
        if (isPubliclyVisible(listing) && remaining.length === 1) {
          throw new UnprocessableEntityException(
            "Um anúncio publicado precisa de ao menos uma foto. Adicione outra antes de remover esta.",
          );
        }
        await repo.delete({ id: target.id });
        const rest = remaining.filter((image) => image.id !== target.id);
        for (const [position, image] of rest.entries()) {
          if (image.position !== position) {
            await repo.update({ id: image.id }, { position });
          }
        }
        return {
          key: target.storageKey,
          images: await this.listImages(manager, listingId),
        };
      },
    );
    await this.media.remove(key);
    return images;
  }

  private async lockListing(
    manager: EntityManager,
    storeId: string,
    listingId: string,
  ): Promise<Listing> {
    const listing = await manager.getRepository(Listing).findOne({
      where: { id: listingId, storeId },
      lock: { mode: "pessimistic_write" },
    });
    if (!listing) throw new NotFoundException("Anúncio não encontrado.");
    return listing;
  }

  /** Pass a transactional manager to also lock the listing row. */
  private async countImages(
    manager: EntityManager,
    storeId: string,
    listingId: string,
  ): Promise<number> {
    if (manager.queryRunner?.isTransactionActive) {
      await this.lockListing(manager, storeId, listingId);
    } else if (
      !(await manager
        .getRepository(Listing)
        .exists({ where: { id: listingId, storeId } }))
    ) {
      throw new NotFoundException("Anúncio não encontrado.");
    }
    return manager.getRepository(ListingImage).count({ where: { listingId } });
  }

  private async listImages(
    manager: EntityManager,
    listingId: string,
  ): Promise<AdminImage[]> {
    const rows = await manager.getRepository(ListingImage).find({
      where: { listingId },
      order: { position: "ASC" },
    });
    return rows.map((image) => {
      const urls = mediaUrls(image.storageKey);
      return {
        id: image.id,
        position: image.position,
        width: image.width,
        height: image.height,
        urls: { sm: urls.sm, lg: urls.lg },
      };
    });
  }
}
