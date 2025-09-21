import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { auth } from '../../auth';

@Injectable()
export class AuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    try {
      // Get the session from Better Auth
      const session = await auth.api.getSession({
        headers: request.headers as any,
      });

      if (!session || !session.user) {
        throw new UnauthorizedException('No valid session found');
      }

      // Attach user and session to request for use in controllers
      request['user'] = session.user;
      request['session'] = session;

      return true;
    } catch {
      throw new UnauthorizedException('Invalid authentication');
    }
  }
}
