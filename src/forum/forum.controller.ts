import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ForumService } from './forum.service';
import { CreatePostDto, CreateReplyDto } from './dto/forum.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('forum')
export class ForumController {
  constructor(private readonly forumService: ForumService) {}

  // GET /forum?matiere=MATHEMATIQUES
  @Get()
  listPosts(
    @Query('matiere') matiere: string | undefined,
    @Request() req: any,
  ) {
    return this.forumService.listPosts(matiere, req.user.userId);
  }

  // GET /forum/:id
  @Get(':id')
  getPost(@Param('id') id: string, @Request() req: any) {
    return this.forumService.getPost(id, req.user.userId);
  }

  // POST /forum
  @Post()
  createPost(@Body() dto: CreatePostDto, @Request() req: any) {
    return this.forumService.createPost(dto, req.user.userId);
  }

  // POST /forum/:id/replies
  @Post(':id/replies')
  createReply(
    @Param('id') id: string,
    @Body() dto: CreateReplyDto,
    @Request() req: any,
  ) {
    return this.forumService.createReply(id, dto, req.user.userId);
  }

  // POST /forum/:id/like
  @Post(':id/like')
  toggleLike(@Param('id') id: string, @Request() req: any) {
    return this.forumService.togglePostLike(id, req.user.userId);
  }

  // PATCH /forum/:id/report
  @Patch(':id/report')
  reportPost(@Param('id') id: string) {
    return this.forumService.reportPost(id);
  }
}
