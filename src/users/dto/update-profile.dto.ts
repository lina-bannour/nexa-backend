import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nom?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  prenom?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  ecole?: string;

  @IsOptional()
  @IsIn(['MP', 'PT', 'PC', 'BG'])
  filiere?: string;
}
