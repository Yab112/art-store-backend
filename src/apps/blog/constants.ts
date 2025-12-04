export const BLOG_MESSAGES = {
  CREATED: "Blog post created successfully",
  UPDATED: "Blog post updated successfully",
  DELETED: "Blog post deleted successfully",
  NOT_FOUND: "Blog post not found",
  FORBIDDEN: "You do not have permission to perform this action",
  PUBLISHED: "Blog post published successfully",
  UNPUBLISHED: "Blog post unpublished successfully",
  SLUG_EXISTS: "A blog post with this slug already exists",
  INVALID_SLUG: "Invalid slug format",
} as const;

export const BLOG_CONSTANTS = {
  MIN_TITLE_LENGTH: 3,
  MAX_TITLE_LENGTH: 200,
  MIN_CONTENT_LENGTH: 50,
  MAX_EXCERPT_LENGTH: 500,
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,
} as const;

export const BLOG_EMAIL_SUBJECTS = {
  NEW_POST: "New Blog Post: {{title}}",
  POST_CREATED: "Blog Post Created: {{title}}",
  POST_UPDATED: "Blog Post Updated: {{title}}",
  POST_DELETED: "Blog Post Deleted: {{title}}",
  POST_APPROVED: "Blog Post Approved: {{title}}",
  POST_REJECTED: "Blog Post Rejected: {{title}}",
  POST_UNPUBLISHED: "Blog Post Unpublished: {{title}}",
} as const;
