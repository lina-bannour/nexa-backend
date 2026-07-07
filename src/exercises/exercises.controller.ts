import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ExercisesService } from './exercises.service';
import { CreateExerciseDto } from './dto/create-exercise.dto';
import { SubmitAnswerDto } from './dto/submit-answer.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('exercises')
export class ExercisesController {
  constructor(private readonly exercisesService: ExercisesService) {}

  // Admin: create exercise (protected)
  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() dto: CreateExerciseDto) {
    return this.exercisesService.create(dto);
  }

  // Student: list exercises with optional filters
  // GET /exercises?matiere=MATHEMATIQUES&difficulte=UN_ETOILE
  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(
    @Query('matiere') matiere?: string,
    @Query('difficulte') difficulte?: string,
  ) {
    return this.exercisesService.findAll(matiere, difficulte);
  }

  // Student: get one exercise
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.exercisesService.findOne(id);
  }

  // Student: submit answer
  @UseGuards(JwtAuthGuard)
  @Post(':id/submit')
  submitAnswer(
    @Param('id') id: string,
    @Body() dto: SubmitAnswerDto,
    @Request() req: any,
  ) {
    return this.exercisesService.submitAnswer(id, req.user.userId, dto);
  }

  // Admin: delete exercise (protected)
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.exercisesService.remove(id);
  }
}
