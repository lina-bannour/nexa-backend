import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ContestsService } from './contests.service';
import { CreateContestDto, SubmitContestAnswerDto } from './dto/contest.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('contests')
export class ContestsController {
  constructor(private readonly contestsService: ContestsService) {}

  // Admin: create contest
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post()
  create(@Body() dto: CreateContestDto) {
    return this.contestsService.create(dto);
  }

  // Student: list contests
  // GET /contests?filiere=MP
  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(@Query('filiere') filiere: string | undefined, @Request() req: any) {
    return this.contestsService.findAll(filiere, req.user.userId);
  }

  // Student: get one contest with questions
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.contestsService.findOne(id);
  }

  // Student: start session
  @UseGuards(JwtAuthGuard)
  @Post(':id/session')
  startSession(@Param('id') id: string, @Request() req: any) {
    return this.contestsService.startSession(id, req.user.userId);
  }

  // Student: submit answer for a question
  @UseGuards(JwtAuthGuard)
  @Post('sessions/:sessionId/questions/:questionId/submit')
  submitAnswer(
    @Param('sessionId') sessionId: string,
    @Param('questionId') questionId: string,
    @Body() dto: SubmitContestAnswerDto,
    @Request() req: any,
  ) {
    return this.contestsService.submitAnswer(
      sessionId,
      questionId,
      req.user.userId,
      dto,
    );
  }

  // Student: get session progress
  @UseGuards(JwtAuthGuard)
  @Get('sessions/:sessionId')
  getSession(@Param('sessionId') sessionId: string, @Request() req: any) {
    return this.contestsService.getSession(sessionId, req.user.userId);
  }
}
