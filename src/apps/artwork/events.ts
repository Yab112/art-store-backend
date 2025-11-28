/**
 * Artwork Events
 * Event definitions for artwork-related actions
 */

export const ARTWORK_EVENTS = {
  // Submission events
  SUBMITTED: 'artwork.submitted',
  UPDATED: 'artwork.updated',
  DELETED: 'artwork.deleted',

  // Status change events
  APPROVED: 'artwork.approved',
  REJECTED: 'artwork.rejected',
  SOLD: 'artwork.sold',
  WITHDRAWN: 'artwork.withdrawn',

  // Price events
  PRICE_UPDATED: 'artwork.price.updated',
  PRICE_NEGOTIATION_TOGGLED: 'artwork.price.negotiation.toggled',

  // Interaction events
  VIEWED: 'artwork.viewed',
  FAVORITED: 'artwork.favorited',
  SHARED: 'artwork.shared',

  // Comment events
  COMMENT_ADDED: 'artwork.comment.added',
  COMMENT_UPDATED: 'artwork.comment.updated',
  COMMENT_DELETED: 'artwork.comment.deleted',

  // Like events
  LIKED: 'artwork.liked',
  UNLIKED: 'artwork.unliked',

  // File events
  PHOTOS_UPLOADED: 'artwork.photos.uploaded',
  PROOF_UPLOADED: 'artwork.proof.uploaded',
} as const;

// Event payload interfaces
export interface ArtworkSubmittedEvent {
  artworkId: string;
  userId: string;
  userName: string;
  userEmail: string;
  artist: string;
  title?: string;
  desiredPrice: number;
  photos: string[];
  proofOfOrigin?: string;
  submittedAt: Date;
}

export interface ArtworkUpdatedEvent {
  artworkId: string;
  userId: string;
  userName: string;
  userEmail: string;
  changes: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];
  updatedAt: Date;
}

export interface ArtworkDeletedEvent {
  artworkId: string;
  userId: string;
  userName: string;
  userEmail: string;
  artist: string;
  title?: string;
  deletedAt: Date;
  reason?: string;
}

export interface ArtworkApprovedEvent {
  artworkId: string;
  userId: string;
  userName: string;
  userEmail: string;
  artist: string;
  title?: string;
  approvedBy: string;
  approvedAt: Date;
  publicUrl?: string; // URL to view the artwork
}

export interface ArtworkRejectedEvent {
  artworkId: string;
  userId: string;
  userName: string;
  userEmail: string;
  artist: string;
  title?: string;
  rejectedBy: string;
  rejectedAt: Date;
  reason: string;
  canResubmit: boolean;
}

export interface ArtworkSoldEvent {
  artworkId: string;
  userId: string; // Seller
  userName: string;
  userEmail: string;
  buyerId?: string;
  buyerEmail?: string;
  artist: string;
  title?: string;
  salePrice: number;
  soldAt: Date;
  transactionId?: string;
}

export interface ArtworkWithdrawnEvent {
  artworkId: string;
  userId: string;
  userName: string;
  userEmail: string;
  artist: string;
  title?: string;
  withdrawnAt: Date;
  reason?: string;
}

export interface ArtworkPriceUpdatedEvent {
  artworkId: string;
  userId: string;
  userName: string;
  userEmail: string;
  artist: string;
  title?: string;
  oldPrice: number;
  newPrice: number;
  updatedAt: Date;
}

export interface ArtworkViewedEvent {
  artworkId: string;
  viewerUserId?: string;
  viewerIp: string;
  viewerUserAgent?: string;
  timestamp: Date;
}

export interface ArtworkFavoritedEvent {
  artworkId: string;
  userId: string;
  userName: string;
  timestamp: Date;
}

export interface ArtworkSharedEvent {
  artworkId: string;
  userId?: string;
  platform: 'email' | 'facebook' | 'twitter' | 'whatsapp' | 'link';
  timestamp: Date;
}

export interface ArtworkPhotosUploadedEvent {
  artworkId: string;
  userId: string;
  photoUrls: string[];
  uploadedAt: Date;
}

export interface ArtworkProofUploadedEvent {
  artworkId: string;
  userId: string;
  proofUrl: string;
  uploadedAt: Date;
}

export interface ArtworkCommentAddedEvent {
  commentId: string;
  artworkId: string;
  artworkTitle?: string;
  artworkOwnerId: string;
  artworkOwnerName: string;
  artworkOwnerEmail: string;
  commenterUserId: string;
  commenterName: string;
  commenterEmail: string;
  commenterAvatar?: string;
  comment: string;
  createdAt: Date;
}

export interface ArtworkCommentUpdatedEvent {
  commentId: string;
  artworkId: string;
  userId: string;
  oldComment: string;
  newComment: string;
  updatedAt: Date;
}

export interface ArtworkCommentDeletedEvent {
  commentId: string;
  artworkId: string;
  userId: string;
  deletedAt: Date;
}

export interface ArtworkLikedEvent {
  artworkId: string;
  artworkTitle?: string;
  artworkOwnerId: string;
  artworkOwnerName: string;
  artworkOwnerEmail: string;
  likerUserId: string;
  likerName: string;
  likerEmail: string;
  likerAvatar?: string;
  likedAt: Date;
  totalLikes: number;
}

export interface ArtworkUnlikedEvent {
  artworkId: string;
  userId: string;
  unlikedAt: Date;
  totalLikes: number;
}
