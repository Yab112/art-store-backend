export const BLOG_EVENTS = {
  CREATED: "blog.created",
  UPDATED: "blog.updated",
  DELETED: "blog.deleted",
  PUBLISHED: "blog.published",
  UNPUBLISHED: "blog.unpublished",
  APPROVED: "blog.approved",
  REJECTED: "blog.rejected",
} as const;

export class BlogPostCreatedEvent {
  constructor(
    public readonly blogPostId: string,
    public readonly title: string,
    public readonly slug: string,
    public readonly authorId: string,
    public readonly authorName: string,
    public readonly authorEmail: string,
    public readonly published: boolean,
    public readonly createdAt: Date
  ) {}
}

export class BlogPostUpdatedEvent {
  constructor(
    public readonly blogPostId: string,
    public readonly title: string,
    public readonly slug: string,
    public readonly authorId: string,
    public readonly published: boolean,
    public readonly updatedAt: Date
  ) {}
}

export class BlogPostDeletedEvent {
  constructor(
    public readonly blogPostId: string,
    public readonly title: string,
    public readonly authorId: string,
    public readonly deletedAt: Date
  ) {}
}

export class BlogPostPublishedEvent {
  constructor(
    public readonly blogPostId: string,
    public readonly title: string,
    public readonly slug: string,
    public readonly publishedAt: Date,
    public readonly excerpt?: string,
    public readonly featuredImage?: string
  ) {}
}

export class BlogPostUnpublishedEvent {
  constructor(
    public readonly blogPostId: string,
    public readonly title: string,
    public readonly slug: string,
    public readonly authorId: string,
    public readonly authorName: string,
    public readonly authorEmail: string,
    public readonly unpublishedAt: Date
  ) {}
}

export class BlogPostApprovedEvent {
  constructor(
    public readonly blogPostId: string,
    public readonly title: string,
    public readonly slug: string,
    public readonly authorId: string,
    public readonly authorName: string,
    public readonly authorEmail: string,
    public readonly approvedAt: Date,
    public readonly approvedBy: string
  ) {}
}

export class BlogPostRejectedEvent {
  constructor(
    public readonly blogPostId: string,
    public readonly title: string,
    public readonly slug: string,
    public readonly authorId: string,
    public readonly authorName: string,
    public readonly authorEmail: string,
    public readonly rejectedAt: Date,
    public readonly rejectedBy: string,
    public readonly reason?: string
  ) {}
}
