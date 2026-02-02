export enum RoleEnum {
  CLIENT = "CLIENT",
  ADMIN = "ADMIN",
  TASKER = "TASKER",
}

import { User } from "@prisma/client";

export class UserFromToken {
  id?: string;
  role?: RoleEnum;
  sessionId?: string;
  expiryDate?: number;
}

// ExtendedUser interface can be implemented based on specific needs
// For now, we'll use the base User type
export type ExtendedUser = User;
