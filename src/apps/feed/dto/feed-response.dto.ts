import { ApiProperty } from "@nestjs/swagger";

export class FeedArtworkItem {
  @ApiProperty({ description: "Artwork ID" })
  id: string;

  @ApiProperty({ description: "Artwork title" })
  title?: string;

  @ApiProperty({ description: "Artist name" })
  artist: string;

  @ApiProperty({ description: "Artwork photos", type: [String] })
  photos: string[];

  @ApiProperty({ description: "Desired price" })
  desiredPrice: number;

  @ApiProperty({ description: "Artwork status" })
  status: string;

  @ApiProperty({ description: "Created at timestamp" })
  createdAt: Date;

  @ApiProperty({ description: "User who created the artwork" })
  user: {
    id: string;
    name: string;
    image?: string;
  };
}

export class FeedBlogPostItem {
  @ApiProperty({ description: "Blog post ID" })
  id: string;

  @ApiProperty({ description: "Blog post title" })
  title: string;

  @ApiProperty({ description: "Blog post slug" })
  slug: string;

  @ApiProperty({ description: "Blog post excerpt", required: false })
  excerpt?: string;

  @ApiProperty({ description: "Featured image URL", required: false })
  featuredImage?: string;

  @ApiProperty({ description: "Published at timestamp", required: false })
  publishedAt?: Date;

  @ApiProperty({ description: "Created at timestamp" })
  createdAt: Date;

  @ApiProperty({ description: "Author information" })
  author: {
    id: string;
    name: string;
    image?: string;
  };

  @ApiProperty({ description: "View count" })
  views: number;

  @ApiProperty({ description: "Like count" })
  likes: number;
}

export class FeedItem {
  @ApiProperty({ description: "Content type: artwork or blog_post" })
  type: "artwork" | "blog_post";

  @ApiProperty({ description: "Content ID" })
  id: string;

  @ApiProperty({ description: "Created at timestamp" })
  createdAt: Date;

  @ApiProperty({
    description: "Artwork data (if type is artwork)",
    required: false,
  })
  artwork?: FeedArtworkItem;

  @ApiProperty({
    description: "Blog post data (if type is blog_post)",
    required: false,
  })
  blogPost?: FeedBlogPostItem;
}

export class FeedResponseDto {
  @ApiProperty({ description: "List of feed items", type: [FeedItem] })
  items: FeedItem[];

  @ApiProperty({ description: "Total number of items" })
  total: number;

  @ApiProperty({ description: "Current page number" })
  page: number;

  @ApiProperty({ description: "Number of items per page" })
  limit: number;

  @ApiProperty({ description: "Total number of pages" })
  totalPages: number;
}
