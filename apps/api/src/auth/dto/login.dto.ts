import { Transform } from "class-transformer";
import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";

export class LoginDto {
  @IsString()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsEmail()
  @MaxLength(254)
  declare email: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  declare password: string;
}
