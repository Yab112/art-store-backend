import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Request,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { BlogService } from './blog.service';
import { BlogCommentsService } from './blog-comments.service';
import { BlogVotesService } from './blog-votes.service';
import { BlogSharesService } from './blog-shares.service';
import {
  CreateBlogPostDto,
  UpdateBlogPostDto,
  BlogPostQueryDto,
  BlogPostResponseDto,
  BlogPostListResponseDto,
  CreateCommentDto,
  UpdateCommentDto,
  VoteDto,
  ShareDto,
} from './dto';
import { AuthGuard } from '../../core/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../core/decorators/public.decorator';

@ApiTags('Blog Posts')
@Controller('blog')
export class BlogController {
  private readonly logger = new Logger(BlogController.name);

  constructor(
    private readonly blogService: BlogService,
    private readonly commentsService: BlogCommentsService,
    private readonly votesService: BlogVotesService,
    private readonly sharesService: BlogSharesService,
  ) {}

  @Post()
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new blog post' })
  @ApiResponse({
    status: 201,
    description: 'Blog post created successfully',
    type: BlogPostResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async create(
    @Body() createBlogPostDto: CreateBlogPostDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.blogService.create(createBlogPostDto, user.id);
  }

  @Get()
  @Public()
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get all blog posts with pagination and filters' })
  @ApiResponse({
    status: 200,
    description: 'Blog posts retrieved successfully',
    type: BlogPostListResponseDto,
  })
  async findAll(
    @Query() query: BlogPostQueryDto,
    @Request() req: any,
  ) {
    // For public routes, AuthGuard sets req.user if authenticated, but doesn't throw if not
    // Try to get user from request (set by AuthGuard for public routes with session)
    const userId = req.user?.id;
    
    // Explicit logging to see what's happening
    console.log('[BlogController] req.user:', req.user);
    console.log('[BlogController] req.user?.id:', req.user?.id);
    console.log('[BlogController] query.authorId:', query.authorId);
    console.log('[BlogController] query.status:', query.status);
    this.logger.debug(`Blog findAll - authorId: ${query.authorId}, userId: ${userId}, status: ${query.status}`);
    
    // If authorId is provided, this might be "My Blogs" - check if user is authenticated
    // If user is authenticated and authorId matches, allow status filtering
    // Otherwise, only show APPROVED and published posts
    return this.blogService.findAll(query, userId);
  }

  @Get('published')
  @ApiOperation({ summary: 'Get all published blog posts' })
  @ApiResponse({
    status: 200,
    description: 'Published blog posts retrieved successfully',
    type: BlogPostListResponseDto,
  })
  async findPublished(@Query() query: BlogPostQueryDto) {
    return this.blogService.findAll({ ...query, published: true });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a blog post by ID or slug' })
  @ApiResponse({
    status: 200,
    description: 'Blog post retrieved successfully',
    type: BlogPostResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Blog post not found' })
  async findOne(
    @Param('id') id: string,
    @Query('incrementViews') incrementViews?: string,
  ) {
    const shouldIncrement = incrementViews === 'true';
    return this.blogService.findOne(id, shouldIncrement);
  }

  @Patch(':id')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a blog post' })
  @ApiResponse({
    status: 200,
    description: 'Blog post updated successfully',
    type: BlogPostResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Blog post not found' })
  async update(
    @Param('id') id: string,
    @Body() updateBlogPostDto: UpdateBlogPostDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.blogService.update(id, updateBlogPostDto, user.id);
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a blog post' })
  @ApiResponse({ status: 204, description: 'Blog post deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Blog post not found' })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.blogService.remove(id, user.id);
  }

  @Post(':id/publish')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Publish a blog post' })
  @ApiResponse({
    status: 200,
    description: 'Blog post published successfully',
    type: BlogPostResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Blog post not found' })
  async publish(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.blogService.publish(id, user.id);
  }

  @Post(':id/unpublish')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Unpublish a blog post (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Blog post unpublished successfully',
    type: BlogPostResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Blog post not found' })
  async unpublish(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.blogService.unpublish(id, user.id);
  }

  @Post(':id/approve')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Approve a blog post (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Blog post approved successfully',
    type: BlogPostResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Blog post not found' })
  async approve(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.blogService.approve(id, user.id);
  }

  @Post(':id/reject')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reject a blog post (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Blog post rejected',
    type: BlogPostResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Blog post not found' })
  async reject(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @CurrentUser() user: { id: string },
  ) {
    return this.blogService.reject(id, user.id, body.reason);
  }

  // Comments endpoints
  @Post(':id/comments')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a comment on a blog post' })
  @ApiResponse({ status: 201, description: 'Comment created successfully' })
  async createComment(
    @Param('id') blogPostId: string,
    @Body() createCommentDto: CreateCommentDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.commentsService.create(blogPostId, createCommentDto, user.id);
  }

  @Get(':id/comments')
  @ApiOperation({ summary: 'Get all comments for a blog post' })
  @ApiResponse({ status: 200, description: 'Comments retrieved successfully' })
  async getComments(
    @Param('id') blogPostId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.commentsService.findAll(blogPostId, page || 1, limit || 20);
  }

  @Patch('comments/:commentId')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a comment' })
  @ApiResponse({ status: 200, description: 'Comment updated successfully' })
  async updateComment(
    @Param('commentId') commentId: string,
    @Body() updateCommentDto: UpdateCommentDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.commentsService.update(commentId, updateCommentDto, user.id);
  }

  @Delete('comments/:commentId')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a comment' })
  @ApiResponse({ status: 204, description: 'Comment deleted successfully' })
  async deleteComment(
    @Param('commentId') commentId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.commentsService.remove(commentId, user.id);
  }

  // Votes endpoints
  @Post(':id/vote')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Vote (like/dislike) on a blog post' })
  @ApiResponse({ status: 200, description: 'Vote recorded successfully' })
  async vote(
    @Param('id') blogPostId: string,
    @Body() voteDto: VoteDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.votesService.vote(blogPostId, voteDto, user.id);
  }

  @Get(':id/vote')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user vote on a blog post' })
  @ApiResponse({ status: 200, description: 'User vote retrieved' })
  async getUserVote(
    @Param('id') blogPostId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.votesService.getUserVote(blogPostId, user.id);
  }

  // Shares endpoints
  @Post(':id/share')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Share a blog post (authenticated users only)' })
  @ApiResponse({ status: 200, description: 'Blog post shared successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async share(
    @Param('id') blogPostId: string,
    @Body() shareDto: ShareDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.sharesService.share(blogPostId, shareDto, user.id);
  }

  @Get(':id/share-stats')
  @ApiOperation({ summary: 'Get share statistics for a blog post' })
  @ApiResponse({ status: 200, description: 'Share statistics retrieved' })
  async getShareStats(@Param('id') blogPostId: string) {
    return this.sharesService.getShareStats(blogPostId);
  }
}

