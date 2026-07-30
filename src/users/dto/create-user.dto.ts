import { IsString, IsNotEmpty, IsIn, IsInt, Min } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  nom: string;

  @IsIn(['MP', 'PT', 'PC', 'BG'])
  filiere: string;

  @IsInt()
  @Min(0)
  xpTotal: number;
}