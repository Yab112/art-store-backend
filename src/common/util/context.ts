import { ExecutionContext } from '@nestjs/common';

export interface RequestContext {
  userId?: string;
  role?: string;
}

export const getRequestContext = (): RequestContext => {
  return {
    userId: undefined,
    role: undefined,
  };
};

export class ContextHelper {
  static getUserId(context: RequestContext): string | undefined {
    return context.userId;
  }

  static getRole(context: RequestContext): string | undefined {
    return context.role;
  }

  static toRequest(context: ExecutionContext): any {
    return context.switchToHttp().getRequest();
  }
}
