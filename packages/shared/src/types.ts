export type DisplayMode = 'auto' | 'auto-skip-blurry' | 'approval';
export type ImageStatus = 'pending' | 'approved' | 'excluded' | 'auto-skipped';
export type Transition = 'none' | 'fade' | 'slide-blur';

export interface EventDto {
  id: string;
  name: string;
  slug: string;
  photosDir: string;
  isActive: boolean;
  displayMode: DisplayMode;
  brandingIntroImageId: string | null;
  brandingOutroImageId: string | null;
  createdAt: string;
  archivedAt: string | null;
}

export interface PhotographerDto {
  id: string;
  eventId: string;
  displayName: string;
  color: string;
  ftpUsername: string;
  isActive: boolean;
}

export interface PhotographerWithSecretDto extends PhotographerDto {
  ftpPassword: string;
}

export interface ImageDto {
  id: string;
  eventId: string;
  photographerId: string | null;
  photographerName: string | null;
  photographerColor: string | null;
  hash: string;
  width: number;
  height: number;
  orientation: number;
  takenAt: string | null;
  uploadedAt: string;
  ingestedAt: string;
  displayUrl: string;
  thumbnailUrl: string;
  sharpnessScore: number | null;
  status: ImageStatus;
  exclusionReason: string | null;
  caption: string | null;
  seenCount: number;
}

export interface SettingsDto {
  intervalMs: number;
  transition: Transition;
  transitionDurationMs: number;
  showCaption: boolean;
  showPhotographer: boolean;
  showTimeAgo: boolean;
  showBranding: boolean;
  blurThreshold: number;
}

export const DEFAULT_SETTINGS: SettingsDto = {
  intervalMs: 5000,
  transition: 'fade',
  transitionDurationMs: 600,
  showCaption: true,
  showPhotographer: true,
  showTimeAgo: false,
  showBranding: false,
  blurThreshold: 100,
};

export interface SlideshowState {
  isPlaying: boolean;
  currentImageId: string | null;
  nextImageId: string | null;
  queueLength: number;
  pendingCount: number;
}

export interface AuditLogEntry {
  id: string;
  eventId: string;
  actor: string;
  action: string;
  payload: unknown;
  ts: string;
}
