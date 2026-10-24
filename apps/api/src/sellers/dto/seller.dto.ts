import { applyDecorators } from "@nestjs/common";
import { Transform } from "class-transformer";
import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from "class-validator";
import {
  normalizeWhatsAppNumber,
  WHATSAPP_NUMBER_PATTERN,
} from "../whatsapp-number";

const TRIM = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;

const INVALID_NUMBER = "invalid";
const NUMBER_MESSAGE =
  "Informe o WhatsApp com o código do país, por exemplo +55 11 99999-8888.";

/** Empty input clears the number; anything else must normalize. */
const NORMALIZE_NUMBER = ({ value }: { value: unknown }) => {
  if (value === null || value === undefined) return value;
  if (typeof value !== "string") return INVALID_NUMBER;
  if (value.trim() === "") return null;
  return normalizeWhatsAppNumber(value) ?? INVALID_NUMBER;
};

/**
 * Optional WhatsApp number, normalized to international digits; empty
 * means none. Every form that takes a contact number uses this.
 */
export function IsOptionalWhatsAppNumber(): PropertyDecorator {
  return applyDecorators(
    Transform(NORMALIZE_NUMBER),
    ValidateIf((_, value) => value !== undefined && value !== null),
    Matches(WHATSAPP_NUMBER_PATTERN, { message: NUMBER_MESSAGE }),
  );
}

export class UpdateSellerDto {
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @Transform(TRIM)
  @IsNotEmpty()
  @MaxLength(60)
  declare displayName?: string;

  @IsOptionalWhatsAppNumber()
  declare whatsappNumber?: string | null;
}
