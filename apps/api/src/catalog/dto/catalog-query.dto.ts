import { Transform, Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from "class-validator";
import { CONDITIONS, type Condition } from "../listing-types";
import { MAX_PRICE_CENTS } from "./listing.dto";

const isDefined = (_: unknown, value: unknown) => value !== undefined;

export const CATALOG_SORTS = ["recent", "price_asc", "price_desc"] as const;
export type CatalogSort = (typeof CATALOG_SORTS)[number];

export const AVAILABILITY_FILTERS = [
  "listed",
  "available",
  "reserved",
  "sold",
  "all",
] as const;
export type AvailabilityFilter = (typeof AVAILABILITY_FILTERS)[number];

export const DEFAULT_PAGE_SIZE = 24;

/**
 * Public catalog query. Prices are integer cents. `availability=listed`
 * (the default) means available + reserved.
 */
export class CatalogQueryDto {
  @ValidateIf(isDefined)
  @IsString()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @MaxLength(100)
  declare q?: string;

  @ValidateIf(isDefined)
  @IsString()
  @MaxLength(60)
  declare category?: string;

  @ValidateIf(isDefined)
  @IsIn(CONDITIONS)
  declare condition?: Condition;

  @ValidateIf(isDefined)
  @IsIn(AVAILABILITY_FILTERS)
  declare availability?: AvailabilityFilter;

  @ValidateIf(isDefined)
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_PRICE_CENTS)
  declare minPrice?: number;

  @ValidateIf(isDefined)
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_PRICE_CENTS)
  declare maxPrice?: number;

  @ValidateIf(isDefined)
  @IsIn(CATALOG_SORTS)
  declare sort?: CatalogSort;

  @ValidateIf(isDefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  declare page?: number;

  @ValidateIf(isDefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  declare pageSize?: number;
}
