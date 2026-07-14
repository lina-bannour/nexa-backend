import { IsString, IsNotEmpty, IsIn, IsOptional } from 'class-validator';

export class CreatePostDto {
  @IsString() @IsNotEmpty() titre: string;
  @IsString() @IsNotEmpty() contenu: string;
  @IsIn(['MATHEMATIQUES', 'PHYSIQUE', 'SCIENCES_INGENIEUR', 'AUTRE']) matiere: string;
}

export class CreateReplyDto {
  @IsString() @IsNotEmpty() contenu: string;
}
