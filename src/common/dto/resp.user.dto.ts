import { sessionUser } from "@/auth";

export class UserRes {
  error?: string;
  user?: sessionUser["user"];
}

// Pagination users Response
