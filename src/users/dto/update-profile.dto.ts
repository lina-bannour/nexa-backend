import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  ecole?: string;

  @IsOptional()
  @IsIn(['MP', 'PT', 'PC', 'BG'])
  filiere?: string;
}
