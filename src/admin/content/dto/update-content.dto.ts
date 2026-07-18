import {
  IsString,
  IsNotEmpty,
  IsIn,
  IsInt,
  Min,
  IsOptional,
  IsArray,
  ValidateNested,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateChoiceDto {
  @IsString()
  @IsNotEmpty()
  label: string;

  @IsBoolean()
  isCorrect: boolean;
}

export class UpdateExerciseDto {
  @IsOptional() @IsString() @IsNotEmpty() titre?: string;
  @IsOptional() @IsIn(['MATHEMATIQUES', 'PHYSIQUE', 'SCIENCES_INGENIEUR', 'AUTRE']) matiere?: string;
  @IsOptional() @IsIn(['UN_ETOILE', 'DEUX_ETOILES', 'TROIS_ETOILES']) difficulte?: string;
  @IsOptional() @IsString() @IsNotEmpty() enonce?: string;
  @IsOptional() @IsString() @IsNotEmpty() solutionDetaillee?: string;
  @IsOptional() @IsInt() @Min(1) xpBase?: number;
  @IsOptional() @IsString() hint1?: string;
  @IsOptional() @IsString() hint2?: string;
  @IsOptional() @IsString() hint3?: string;
  @IsOptional() @IsString() hint4?: string;
  // When provided, replaces all existing choices for this exercise.
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateChoiceDto)
  choix?: UpdateChoiceDto[];
}

export class UpdateContestQuestionDto {
  @IsInt() @Min(1) ordre: number;
  @IsString() @IsNotEmpty() enonce: string;
  @IsString() @IsNotEmpty() solutionDetaillee: string;
  @IsInt() @Min(1) xpBase: number;
  @IsOptional() @IsString() hint1?: string;
  @IsOptional() @IsString() hint2?: string;
  @IsOptional() @IsString() hint3?: string;
  @IsOptional() @IsString() hint4?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => UpdateChoiceDto)
  choix: UpdateChoiceDto[];
}

export class UpdateContestDto {
  @IsOptional() @IsString() @IsNotEmpty() titre?: string;
  @IsOptional() @IsInt() annee?: number;
  @IsOptional() @IsIn(['MP', 'PC', 'TSI', 'BIO', 'TECHNO']) filiere?: string;
  @IsOptional() @IsIn(['MATHEMATIQUES', 'PHYSIQUE', 'SCIENCES_INGENIEUR', 'AUTRE']) matiere?: string;
  // When provided, replaces the entire question set for this contest.
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateContestQuestionDto)
  questions?: UpdateContestQuestionDto[];
}
