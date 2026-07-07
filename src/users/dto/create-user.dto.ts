import { IsString, IsNotEmpty, IsIn, IsInt, Min } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  nom: string;

  @IsIn(['MP', 'PC', 'TSI', 'BIO', 'TECHNO'])
  filiere: string;

  @IsInt()
  @Min(0)
  xpTotal: number;
}