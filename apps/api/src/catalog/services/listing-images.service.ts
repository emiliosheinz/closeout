import { HttpStatus, Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import type { DataSource, EntityManager } from "typeorm";
import { MediaService, type StoredImage } from "@/media/media.service";
import { MAX_IMAGES_PER_LISTING } from "@/media/upload-limits";
import { AppException } from "@/problem/app-exception";
import { type AdminImage, toAdminImage } from "../admin-mappers";
import { Listing } from "../entities/listing.entity";
import { ListingImage } from "../entities/listing-image.entity";
import { canRemovePhoto, PUBLISHED_KEEPS_A_PHOTO } from "../listing-rules";
import { listingNotFound, lockListing } from "./listings.service";

const TOO_MANY_IMAGES = `Cada anúncio pode ter até ${MAX_IMAGES_PER_LISTING} fotos.`;
const INCOMPLETE_ORDER =
  "A nova ordem precisa conter todas as fotos do anúncio.";
const PHOTO_NOT_FOUND = "Foto não encontrada.";

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
    const repo = this.dataSource.getRepository(ListingImage);
    if (
      !(await this.dataSource
        .getRepository(Listing)
        .exists({ where: { id: listingId, storeId } }))
    ) {
      throw listingNotFound();
    }
    const existing = await repo.count({ where: { listingId } });
    if (existing + files.length > MAX_IMAGES_PER_LISTING) {
      throw new AppException(HttpStatus.UNPROCESSABLE_ENTITY, TOO_MANY_IMAGES);
    }

    const stored: StoredImage[] = [];
    try {
      for (const file of files) stored.push(await this.media.store(file));
      return await this.dataSource.transaction(async (manager) => {
        await lockListing(manager, storeId, listingId);
        const count = await manager
          .getRepository(ListingImage)
          .count({ where: { listingId } });
        if (count + stored.length > MAX_IMAGES_PER_LISTING) {
          throw new AppException(
            HttpStatus.UNPROCESSABLE_ENTITY,
            TOO_MANY_IMAGES,
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
      await lockListing(manager, storeId, listingId);
      const current = await manager
        .getRepository(ListingImage)
        .find({ where: { listingId } });
      const currentIds = new Set(current.map((image) => image.id));
      const sameSet =
        ids.length === current.length &&
        new Set(ids).size === ids.length &&
        ids.every((id) => currentIds.has(id));
      if (!sameSet) {
        throw new AppException(
          HttpStatus.UNPROCESSABLE_ENTITY,
          INCOMPLETE_ORDER,
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
        const listing = await lockListing(manager, storeId, listingId);
        const repo = manager.getRepository(ListingImage);
        const remaining = await repo.find({
          where: { listingId },
          order: { position: "ASC" },
        });
        const target = remaining.find((image) => image.id === imageId);
        if (!target) {
          throw new AppException(HttpStatus.NOT_FOUND, PHOTO_NOT_FOUND);
        }
        if (!canRemovePhoto(listing, remaining.length)) {
          throw new AppException(
            HttpStatus.UNPROCESSABLE_ENTITY,
            PUBLISHED_KEEPS_A_PHOTO,
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

  private async listImages(
    manager: EntityManager,
    listingId: string,
  ): Promise<AdminImage[]> {
    const rows = await manager.getRepository(ListingImage).find({
      where: { listingId },
      order: { position: "ASC" },
    });
    return rows.map(toAdminImage);
  }
}
