import { Injectable } from '@nestjs/common';

@Injectable()
export class UploadService {
  // Stub implementation
  async uploadFile(file: Express.Multer.File): Promise<string> {
    // TODO: Implement file upload logic
    return 'stub-url';
  }
}

