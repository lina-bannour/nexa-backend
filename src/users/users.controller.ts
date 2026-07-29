import {
  Controller,
  Get,
  Put,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
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
