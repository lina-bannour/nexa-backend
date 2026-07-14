import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional() @IsString() platformName?: string;
  @IsOptional() @IsString() supportEmail?: string;
  @IsOptional() @IsString() websiteUrl?: string;
  @IsOptional() @IsInt() @Min(0) xpPerDirectAnswer?: number;
  @IsOptional() @IsInt() @Min(0) xpPerForumPost?: number;
  @IsOptional() @IsInt() @Min(0) xpPerForumReply?: number;
  @IsOptional() @IsInt() @Min(0) hintPenaltyPercent1?: number;
  @IsOptional() @IsInt() @Min(0) hintPenaltyPercent2?: number;
  @IsOptional() @IsInt() @Min(0) hintPenaltyPercent3?: number;
  @IsOptional() @IsInt() @Min(0) hintPenaltyPercent4?: number;
}

export class UpdateMaintenanceDto {
  @IsBoolean() maintenanceMode: boolean;
}
