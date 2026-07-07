import {
  IsString, IsNotEmpty, IsInt, IsIn, IsOptional,
  IsArray, ValidateNested, IsBoolean, Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateContestChoiceDto {
  @IsString() @IsNotEmpty() label: string;
  @IsBoolean() isCorrect: boolean;
}

export class CreateContestQuestionDto {
  @IsInt() @Min(1) ordre: number;
  @IsString() @IsNotEmpty() enonce: string;
  @IsString() @IsNotEmpty() solutionDetaillee: string;
  @IsInt() @Min(1) xpBase: number;
  @IsOptional() @IsString() hint1?: string;
  @IsOptional() @IsString() hint2?: string;
  @IsOptional() @IsString() hint3?: string;
  @IsOptional() @IsString() hint4?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => CreateContestChoiceDto)
  choix: CreateContestChoiceDto[];
}

export class CreateContestDto {
  @IsString() @IsNotEmpty() titre: string;
  @IsInt() annee: number;
  @IsIn(['MP', 'PC', 'TSI', 'BIO', 'TECHNO']) filiere: string;
  @IsOptional() @IsIn(['MATHEMATIQUES', 'PHYSIQUE', 'SCIENCES_INGENIEUR', 'AUTRE'])
  matiere?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => CreateContestQuestionDto)
  questions: CreateContestQuestionDto[];
}

export class SubmitContestAnswerDto {
  @IsString() @IsNotEmpty() choiceId: string;
  @IsInt() @Min(0) hintsUsed: number;
}