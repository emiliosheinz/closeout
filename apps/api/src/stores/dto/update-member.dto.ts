import { IsIn } from "class-validator";
import {
  ASSIGNABLE_ROLES,
  type AssignableRole,
} from "../entities/store-member.entity";

export class UpdateMemberDto {
  @IsIn(ASSIGNABLE_ROLES)
  declare role: AssignableRole;
}
