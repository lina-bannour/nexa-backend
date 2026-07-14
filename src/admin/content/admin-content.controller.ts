import { Controller, Get, Put, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { AdminContentService } from './admin-content.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('admin/content')
export class AdminContentController {
  constructor(private readonly adminContentService: AdminContentService) {}

  // Exercises
  @Get('exercises')
  listExercises() { return this.adminContentService.listExercises(); }

  @Put('exercises/:id')
  updateExercise(@Param('id') id: string, @Body() body: any) {
    return this.adminContentService.updateExercise(id, body);
  }

  @Delete('exercises/:id')
  deleteExercise(@Param('id') id: string) {
    return this.adminContentService.deleteExercise(id);
  }

  // Contests
  @Get('contests')
  listContests() { return this.adminContentService.listContests(); }

  @Put('contests/:id')
  updateContest(@Param('id') id: string, @Body() body: any) {
    return this.adminContentService.updateContest(id, body);
  }

  @Delete('contests/:id')
  deleteContest(@Param('id') id: string) {
    return this.adminContentService.deleteContest(id);
  }
}
