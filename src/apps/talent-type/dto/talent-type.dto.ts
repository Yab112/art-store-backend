export class CreateTalentTypeDto {
  name: string;
  slug?: string;
  description?: string;
  image?: string;
  isActive?: boolean;
  sortOrder?: number;
}

export class UpdateTalentTypeDto {
  name?: string;
  slug?: string;
  description?: string;
  image?: string;
  isActive?: boolean;
  sortOrder?: number;
}

export class TalentTypeResponseDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}
