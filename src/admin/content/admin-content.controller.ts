import { Controller, Get, Put, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { AdminContentService } from './admin-content.service';
import { UpdateExerciseDto, UpdateContestDto } from './dto/update-content.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/content')
export class AdminContentController {
  constructor(private readonly adminContentService: AdminContentService) {}

  // Exercises
  @Get('exercises')
  listExercises() { return this.adminContentService.listExercises(); }

  @Put('exercises/:id')
  updateExercise(@Param('id') id: string, @Body() dto: UpdateExerciseDto) {
    return this.adminContentService.updateExercise(id, dto);
  }

  @Delete('exercises/:id')
  deleteExercise(@Param('id') id: string) {
    return this.adminContentService.deleteExercise(id);
  }

  // Contests
  @Get('contests')
  listContests() { return this.adminContentService.listContests(); }

  @Put('contests/:id')
  updateContest(@Param('id') id: string, @Body() dto: UpdateContestDto) {
    return this.adminContentService.updateContest(id, dto);
  }

  @Delete('contests/:id')
  deleteContest(@Param('id') id: string) {
    return this.adminContentService.deleteContest(id);
  }
}
