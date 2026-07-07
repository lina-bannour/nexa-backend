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

export class CreateChoiceDto {
  @IsString()
  @IsNotEmpty()
  label: string;

  @IsBoolean()
  isCorrect: boolean;
}

export class CreateExerciseDto {
  @IsString()
  @IsNotEmpty()
  titre: string;

  @IsIn(['MATHEMATIQUES', 'PHYSIQUE', 'SCIENCES_INGENIEUR', 'AUTRE'])
  matiere: string;

  @IsIn(['UN_ETOILE', 'DEUX_ETOILES', 'TROIS_ETOILES'])
  difficulte: string;

  @IsString()
  @IsNotEmpty()
  enonce: string;

  @IsString()
  @IsNotEmpty()
  solutionDetaillee: string;

  @IsInt()
  @Min(1)
  xpBase: number;

  @IsOptional()
  @IsString()
  hint1?: string;

  @IsOptional()
  @IsString()
  hint2?: string;

  @IsOptional()
  @IsString()
  hint3?: string;

  @IsOptional()
  @IsString()
  hint4?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateChoiceDto)
  choix: CreateChoiceDto[];
}
