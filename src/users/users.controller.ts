import {
  Controller,
  Get,
  Put,
  Patch,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getProfile(@Request() req: any) {
    return this.usersService.getProfile(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Put('me')
  updateProfile(@Request() req: any, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(req.user.userId, dto);
  }

  // Changement de mot de passe depuis le compte connecté (nécessite le mot
  // de passe actuel) — distinct du flux "mot de passe oublié" de AuthController.
  @UseGuards(JwtAuthGuard)
  @Patch('me/password')
  changePassword(@Request() req: any, @Body() dto: ChangePasswordDto) {
    return this.usersService.changePassword(req.user.userId, dto);
  }

  // "Missions du jour" on the profile screen — distinct from the lifetime
  // Progression checklist. Resets daily, grants a one-time bonus XP.
  @UseGuards(JwtAuthGuard)
  @Get('me/daily-missions')
  getDailyMissions(@Request() req: any) {
    return this.usersService.getDailyMissions(req.user.userId);
  }

  // GET /users/leaderboard?filiere=MP&period=semaine|mois|global
  @UseGuards(JwtAuthGuard)
  @Get('leaderboard')
  getLeaderboard(
    @Query('filiere') filiere?: string,
    @Query('period') period: string = 'global',
  ) {
    return this.usersService.getLeaderboard(filiere, period);
  }

  // GET /users/me/rank?filiere=MP&period=semaine|mois|global
  @UseGuards(JwtAuthGuard)
  @Get('me/rank')
  getMyRank(
    @Request() req: any,
    @Query('filiere') filiere?: string,
    @Query('period') period: string = 'global',
  ) {
    return this.usersService.getMyRank(req.user.userId, filiere, period);
  }
}
