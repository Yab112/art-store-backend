export class AnalyticsDto {
  userId: string;
  profileViews: number;
  heatScore: number;
  lastActiveAt: Date | null;
  artworkLikes: number;
  artworkViews: number;
  salesCount: number;
  comments: number;
  followerGrowth: number;
  recentActivityScore: number;
  recentArtworkUploads: number;
  recentBlogPosts: number;
  recentComments: number;
  recentLogins: number;
}

export class TrackProfileViewDto {
  viewerId?: string;
  ip?: string;
}












