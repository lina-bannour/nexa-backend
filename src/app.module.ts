import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ExercisesModule } from './exercises/exercises.module';
import { ContestsModule } from './contests/contests.module';
import { ForumModule } from './forum/forum.module';

// Admin modules
import { DashboardModule } from './admin/dashboard/dashboard.module';
import { AdminUsersModule } from './admin/users/admin-users.module';
import { AdminContentModule } from './admin/content/admin-content.module';
import { AdminModerationModule } from './admin/moderation/admin-moderation.module';
import { AdminSettingsModule } from './admin/settings/admin-settings.module';
import { MaintenanceMiddleware } from './middleware/maintenance.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    ExercisesModule,
    ContestsModule,
    ForumModule,
    // Admin
    DashboardModule,
    AdminUsersModule,
    AdminContentModule,
    AdminModerationModule,
    AdminSettingsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(MaintenanceMiddleware).forRoutes('*');
  }
}
