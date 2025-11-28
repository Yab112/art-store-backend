import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { CategoryController } from './category.controller';
import { CategoryService } from './category.service';

@Module({
  controllers: [CategoryController],
  providers: [CategoryService, PrismaClient],
  exports: [CategoryService],
})
export class CategoryModule {}
