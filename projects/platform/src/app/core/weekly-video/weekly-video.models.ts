export interface WeeklyVideoPublic {
  id: string;
  weekStart: string;
  weekEnd: string;
  weekLabel: string;
  title: string;
  description: string;
  youtubeId: string;
  thumbnailUrl: string;
  durationSeconds: number;
  status: 'published';
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WeeklyVideoProgress {
  id: string;
  videoId: string;
  partnerId: string;
  watchedSeconds: number;
  lastPositionSeconds: number;
  durationSeconds: number;
  percent: number;
  completed: boolean;
  completedAt: string | null;
  reflectionAt: string | null;
  startedAt: string | null;
  lastHeartbeatAt: string | null;
  heartbeatCount: number;
}

export interface WeeklyVideoAuthor {
  id: string;
  username: string;
  name: string;
  profileImage: string | null;
  commissionRank?: string;
}

export interface WeeklyVideoReflection {
  id: string;
  videoId: string;
  partnerId: string;
  body: string;
  status: 'visible' | 'hidden';
  editedAt: string | null;
  createdAt: string;
  updatedAt: string;
  author: WeeklyVideoAuthor | null;
}

export interface WeeklyEngagement {
  currentWeek: string;
  publishedCount: number;
  totalCompleted: number;
  totalReflections: number;
  completionRate: number;
  currentStreak: number;
  bestStreak: number;
  currentWeekCommitted: boolean;
  currentWeekPending: boolean;
  currentVideoId: string | null;
  currentVideoCompleted: boolean;
  currentVideoReflected: boolean;
  completionPercent: number;
}

export interface CurrentWeeklyVideo {
  video: WeeklyVideoPublic | null;
  progress: WeeklyVideoProgress | null;
  reflection: WeeklyVideoReflection | null;
  commentCount: number;
  commentsUnlocked: boolean;
  engagement: WeeklyEngagement;
}

export interface WeeklyVideoHistoryItem extends WeeklyVideoPublic {
  progress: WeeklyVideoProgress | null;
  reflected: boolean;
}

export interface WeeklyVideoList {
  items: WeeklyVideoHistoryItem[];
  engagement: WeeklyEngagement;
}

export interface WeeklyVideoComments {
  unlocked: boolean;
  count: number;
  total: number;
  items: WeeklyVideoReflection[];
  message?: string;
}

export interface WeeklyVideoWatchStart {
  video: WeeklyVideoPublic;
  progress: WeeklyVideoProgress;
  sessionId: string;
}
