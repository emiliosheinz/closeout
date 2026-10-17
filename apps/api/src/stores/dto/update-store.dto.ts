import { Transform } from "class-transformer";
import { IsNotEmpty, IsString, MaxLength, ValidateIf } from "class-validator";

const TRIM = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;

export class UpdateStoreDto {
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @Transform(TRIM)
  @IsNotEmpty()
  @MaxLength(80)
  declare name?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @Transform(TRIM)
  @MaxLength(160)
  declare headline?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @Transform(TRIM)
  @MaxLength(1200)
  declare intro?: string;
}
