import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateUserDto {
  @IsOptional() @IsString() nom?: string;
  @IsOptional() @IsString() prenom?: string;
  @IsOptional() @IsString() ecole?: string;
  @IsOptional() @IsIn(['MP', 'PC', 'TSI', 'BIO', 'TECHNO']) filiere?: string;
}

export class UpdateUserStatusDto {
  @IsIn(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'BANNED']) status: string;
}
