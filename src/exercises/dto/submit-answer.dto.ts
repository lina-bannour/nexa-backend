import { IsString, IsNotEmpty, IsInt, Min, Max } from 'class-validator';

export class SubmitAnswerDto {
  @IsString()
  @IsNotEmpty()
  choiceId: string;

  @IsInt()
  @Min(0)
  @Max(4)
  hintsUsed: number;
}
