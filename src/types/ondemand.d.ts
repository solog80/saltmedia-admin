export interface Season {
  id: string;
  title: string;
  order: number;
  episodeCount: number;
  episodes?: any[];
  published?: boolean;
}

export interface OnDemandContent {
  id: string;
  image: string;
  title: string;
  description: string;
  published?: boolean;
  seasons?: Season[];
  seasonCount?: number;
  thumbnail?: string;
  type?: string;
  posterUrl16x9?: string;
  posterUrl2x3?: string;
  bunnyGuid?: string;
}
