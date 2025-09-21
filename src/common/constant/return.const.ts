export interface Resp<T> {
  ok: boolean;
  val: T;
  error: Error;
  errMessage?: string;
  errName?: string;
  code?: number;
}

export function FAIL(
  errMessage: string,
  code = 400,
  e: Error = null,
): Resp<any> {
  return {
    ok: false,
    val: null,
    error: e,
    errMessage,
    code,
  };
}

export function Succeed<T>(val: T): Resp<T> {
  return {
    ok: true,
    val: val,
    error: null,
  };
}
