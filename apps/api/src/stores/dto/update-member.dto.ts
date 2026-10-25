import {
  ASSIGNABLE_ROLES,
  type AssignableRole,
} from "@closeout/contracts/enums";
import { IsIn } from "class-validator";

export class UpdateMemberDto {
  @IsIn(ASSIGNABLE_ROLES)
  declare role: AssignableRole;
}
