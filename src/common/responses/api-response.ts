export class ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };

  constructor(
    data?: T,
    message = 'Success',
    success = true,
    meta?: { page?: number; limit?: number; total?: number },
  ) {
    this.success = success;
    this.message = message;
    this.data = data;
    if (meta) this.meta = meta;
  }

  static ok<T>(
    data?: T,
    message = 'Success',
    meta?: { page?: number; limit?: number; total?: number },
  ): ApiResponse<T> {
    return new ApiResponse<T>(data, message, true, meta);
  }

  static fail<T>(message = 'Failed', data?: T): ApiResponse<T> {
    return new ApiResponse<T>(data, message, false);
  }
}
