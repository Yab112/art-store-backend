// import { HttpCodes } from './http.codes';

export enum ResponseConst {
  INTERNAL_ERROR = "Internal Error",
  INVALID_INPUT = "Your input is invalid",
  USER_EXISTS = "USER_EXISTS",
  TOKEN_NOT_VALID = "TOKEN_NOT_VALID",
  USER_NOT_FOUND = "USER_NOT_FOUND",
  UNAUTHORIZED = "UNAUTHORIZED",
  NOT_FOUND = "NOT_FOUND",
  INVALID_CODE = "Code is not valid or expired",
  INVALID_CREDENTIALS = "Invalid credentials",
  VERIFICATION_FAILED = "verification failed please try again or use a different account",
  COULD_NOT_CREATE_USER = "Could not create user",
}

export enum RespConst {
  OPERATION_SUCCESS = "operation is successful",
  VERIFICATION_SENT = "verification message Sent",
  VERIFICATION_PENDING = "verification is pending please wait few minutes",
}
