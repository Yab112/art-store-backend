import { Module } from '@nestjs/common';
import { UsersModule } from './apps/users/users.module';
import { ArtworkModule } from './apps/artwork';
import { ProfileModule } from './apps/profile';
import { CollectionsModule } from './apps/collections';
import { FavoritesModule } from './apps/favorites';
import { CartModule } from './apps/cart';
import { OrderModule } from './apps/order/order.module';
import { PaymentModule } from './apps/payment/payment.module';
import { ArtistModule } from './apps/artist/artist.module';
import { UploadModule } from './libraries/upload';
import { TestModule } from './apps/test/test.module';

@Module({
  imports: [
    UsersModule,
    ArtworkModule,
    ProfileModule,
    CollectionsModule,
    FavoritesModule,
    CartModule,
    OrderModule,
    PaymentModule,
    ArtistModule,
    UploadModule,
    TestModule,
  ],
  controllers: [],
  providers: [],
})
export class AppInfrastructureModule {}
