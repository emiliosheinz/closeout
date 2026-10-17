import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import {
  AVAILABILITIES,
  type Availability,
  CONDITIONS,
  type Condition,
  PUBLICATIONS,
  type Publication,
} from "../listing-types";

const TRIM = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;
const isDefined = (_: unknown, value: unknown) => value !== undefined;
const isPresent = (_: unknown, value: unknown) =>
  value !== undefined && value !== null;

export const MAX_PRICE_CENTS = 100_000_000;
const MAX_SELLERS = 10;

export class AttributeDto {
  @IsString()
  @Transform(TRIM)
  @IsNotEmpty()
  @MaxLength(40)
  declare label: string;

  @IsString()
  @Transform(TRIM)
  @IsNotEmpty()
  @MaxLength(120)
  declare value: string;
}

export class CreateListingDto {
  @IsString()
  @Transform(TRIM)
  @IsNotEmpty()
  @MaxLength(120)
  declare title: string;

  @ValidateIf(isDefined)
  @IsString()
  @Transform(TRIM)
  @MaxLength(5000)
  declare description?: string;

  @IsUUID()
  declare categoryId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_SELLERS)
  @ArrayUnique()
  @IsUUID("all", { each: true })
  declare sellerIds: string[];

  /** Null or absent means "a combinar". */
  @ValidateIf(isPresent)
  @IsInt()
  @Min(0)
  @Max(MAX_PRICE_CENTS)
  declare priceCents?: number | null;

  @IsIn(CONDITIONS)
  declare condition: Condition;

  @ValidateIf(isDefined)
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => AttributeDto)
  declare attributes?: AttributeDto[];
}

export class UpdateListingDto {
  @ValidateIf(isDefined)
  @IsString()
  @Transform(TRIM)
  @IsNotEmpty()
  @MaxLength(120)
  declare title?: string;

  @ValidateIf(isDefined)
  @IsString()
  @Transform(TRIM)
  @MaxLength(5000)
  declare description?: string;

  @ValidateIf(isDefined)
  @IsUUID()
  declare categoryId?: string;

  @ValidateIf(isDefined)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_SELLERS)
  @ArrayUnique()
  @IsUUID("all", { each: true })
  declare sellerIds?: string[];

  @ValidateIf(isPresent)
  @IsInt()
  @Min(0)
  @Max(MAX_PRICE_CENTS)
  declare priceCents?: number | null;

  @ValidateIf(isDefined)
  @IsIn(CONDITIONS)
  declare condition?: Condition;

  @ValidateIf(isDefined)
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => AttributeDto)
  declare attributes?: AttributeDto[];

  @ValidateIf(isDefined)
  @IsIn(AVAILABILITIES)
  declare availability?: Availability;

  @ValidateIf(isDefined)
  @IsIn(PUBLICATIONS)
  declare publication?: Publication;
}

export class ListingStatusDto {
  @ValidateIf(isDefined)
  @IsIn(AVAILABILITIES)
  declare availability?: Availability;

  @ValidateIf(isDefined)
  @IsIn(PUBLICATIONS)
  declare publication?: Publication;
}

export class ReorderImagesDto {
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID("all", { each: true })
  declare ids: string[];
}

export class AdminListingsQueryDto {
  @ValidateIf(isDefined)
  @IsString()
  @Transform(TRIM)
  @MaxLength(100)
  declare q?: string;
}
