import { Transform } from "class-transformer";
import {
  IsIn,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";
import { MIN_PASSWORD_LENGTH } from "@/auth/services/passwords";
import { IsOptionalWhatsAppNumber } from "@/sellers/dto/seller.dto";
import {
  ASSIGNABLE_ROLES,
  type AssignableRole,
} from "@/stores/entities/store-member.entity";
import { parseEmail, parseName } from "@/stores/member-input";

const EMAIL_MESSAGE = "Informe um e-mail válido.";
const NAME_MESSAGE = "Informe seu nome.";
const PASSWORD_MESSAGE = `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`;

export class CreateInviteDto {
  /** Parsed like every other way of creating a member; invalid becomes "". */
  @Transform(({ value }) =>
    typeof value === "string" ? (parseEmail(value) ?? "") : value,
  )
  @IsString({ message: EMAIL_MESSAGE })
  @IsNotEmpty({ message: EMAIL_MESSAGE })
  @MaxLength(254, { message: EMAIL_MESSAGE })
  declare email: string;

  @IsIn(ASSIGNABLE_ROLES)
  declare role: AssignableRole;
}

export class InviteTokenDto {
  @IsString()
  @MaxLength(200)
  declare token: string;
}

export class AcceptInviteDto extends InviteTokenDto {
  @Transform(({ value }) =>
    typeof value === "string" ? (parseName(value) ?? "") : value,
  )
  @IsString({ message: NAME_MESSAGE })
  @IsNotEmpty({ message: NAME_MESSAGE })
  @MaxLength(60)
  declare name: string;

  @IsString({ message: PASSWORD_MESSAGE })
  @MinLength(MIN_PASSWORD_LENGTH, { message: PASSWORD_MESSAGE })
  @MaxLength(200)
  declare password: string;

  @IsOptionalWhatsAppNumber()
  declare whatsappNumber?: string | null;
}
