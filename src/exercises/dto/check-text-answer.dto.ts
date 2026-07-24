import { IsString, IsNotEmpty } from 'class-validator';

export class CheckTextAnswerDto {
  @IsString()
  @IsNotEmpty()
  text: string;
}
