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
import { CreateContestDto, SubmitContestAnswerDto, CheckContestTextAnswerDto, CreatePhotoSubmissionDto } from './dto/contest.dto';
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

  // Student: check a free-text guess before choices are ever revealed
  @UseGuards(JwtAuthGuard)
  @Post('sessions/:sessionId/questions/:questionId/check-answer')
  checkTextAnswer(
    @Param('sessionId') sessionId: string,
    @Param('questionId') questionId: string,
    @Body() dto: CheckContestTextAnswerDto,
    @Request() req: any,
  ) {
    return this.contestsService.checkTextAnswer(
      sessionId,
      questionId,
      req.user.userId,
      dto.text,
    );
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

  // Student: "solve on paper, submit a photo" mode — alternative to the QCM.
  // Review/grading of the photo is a separate future admin workflow.
  @UseGuards(JwtAuthGuard)
  @Post(':id/photo-submissions')
  submitPhoto(
    @Param('id') id: string,
    @Body() dto: CreatePhotoSubmissionDto,
    @Request() req: any,
  ) {
    return this.contestsService.createPhotoSubmission(
      id,
      req.user.userId,
      dto.imageBase64,
    );
  }

  // Student: check whether they already submitted a photo for this contest
  @UseGuards(JwtAuthGuard)
  @Get(':id/photo-submissions/me')
  getMyPhotoSubmission(@Param('id') id: string, @Request() req: any) {
    return this.contestsService.getMyPhotoSubmission(id, req.user.userId);
  }
}
