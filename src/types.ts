export interface Era {
  id: string;
  title: string;
  monologue: string;
  pullQuote: string;
  imageUrl: string;
  imagePrompt: string;
  videoUrl?: string;
  videoPrompt?: string;
  mapLinks?: { title: string; uri: string }[];
  coordinates?: { lat: number; lng: number };
}

export interface GenerationResponse {
  eras: Era[];
}
