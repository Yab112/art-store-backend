/**
 * Collection Events
 * Event definitions for collection-related actions
 */

export const COLLECTION_EVENTS = {
  // Collection lifecycle
  CREATED: 'collection.created',
  UPDATED: 'collection.updated',
  DELETED: 'collection.deleted',

  // Publication events
  PUBLISHED: 'collection.published',
  UNPUBLISHED: 'collection.unpublished',
  FEATURED: 'collection.featured', // When admin features a collection

  // Artwork management
  ARTWORK_ADDED: 'collection.artwork.added',
  ARTWORK_REMOVED: 'collection.artwork.removed',
  ARTWORKS_BULK_ADDED: 'collection.artworks.bulk_added',

  // Interaction events
  VIEWED: 'collection.viewed',
  SHARED: 'collection.shared',
  CLONED: 'collection.cloned', // When someone creates a copy

  // Collaboration events (future)
  COLLABORATOR_ADDED: 'collection.collaborator.added',
  COLLABORATOR_REMOVED: 'collection.collaborator.removed',
} as const;

// Event payload interfaces
export interface CollectionCreatedEvent {
  collectionId: string;
  userId: string;
  userName: string;
  userEmail: string;
  name: string;
  description?: string;
  visibility: string;
  createdAt: Date;
}

export interface CollectionUpdatedEvent {
  collectionId: string;
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

export interface CollectionDeletedEvent {
  collectionId: string;
  userId: string;
  userName: string;
  userEmail: string;
  name: string;
  artworkCount: number;
  deletedAt: Date;
}

export interface CollectionPublishedEvent {
  collectionId: string;
  userId: string;
  userName: string;
  userEmail: string;
  name: string;
  description?: string;
  artworkCount: number;
  coverImage?: string;
  publicUrl: string;
  publishedAt: Date;
}

export interface CollectionUnpublishedEvent {
  collectionId: string;
  userId: string;
  userName: string;
  userEmail: string;
  name: string;
  unpublishedAt: Date;
  reason?: string;
}

export interface CollectionFeaturedEvent {
  collectionId: string;
  userId: string;
  userName: string;
  userEmail: string;
  name: string;
  featuredBy: string; // Admin who featured it
  featuredAt: Date;
  publicUrl: string;
}

export interface ArtworkAddedToCollectionEvent {
  collectionId: string;
  collectionName: string;
  userId: string;
  userName: string;
  userEmail: string;
  artworkId: string;
  artworkTitle?: string;
  artworkArtist: string;
  artworkPhotoUrl?: string;
  addedAt: Date;
}

export interface ArtworkRemovedFromCollectionEvent {
  collectionId: string;
  collectionName: string;
  userId: string;
  artworkId: string;
  artworkTitle?: string;
  removedAt: Date;
}

export interface ArtworksBulkAddedEvent {
  collectionId: string;
  collectionName: string;
  userId: string;
  userName: string;
  userEmail: string;
  artworkIds: string[];
  artworkCount: number;
  addedAt: Date;
}

export interface CollectionViewedEvent {
  collectionId: string;
  viewerUserId?: string;
  viewerIp: string;
  timestamp: Date;
}

export interface CollectionSharedEvent {
  collectionId: string;
  userId?: string;
  platform: 'email' | 'facebook' | 'twitter' | 'whatsapp' | 'link';
  timestamp: Date;
}

export interface CollectionClonedEvent {
  originalCollectionId: string;
  newCollectionId: string;
  userId: string;
  userName: string;
  userEmail: string;
  clonedAt: Date;
}

export interface CollaboratorAddedEvent {
  collectionId: string;
  collectionName: string;
  ownerId: string;
  ownerName: string;
  collaboratorId: string;
  collaboratorEmail: string;
  collaboratorName: string;
  permissions: string[];
  addedAt: Date;
}

export interface CollaboratorRemovedEvent {
  collectionId: string;
  collectionName: string;
  ownerId: string;
  collaboratorId: string;
  removedAt: Date;
}
