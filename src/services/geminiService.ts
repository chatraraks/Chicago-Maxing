import { GoogleGenAI } from "@google/genai";
import { Era } from "../types";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export async function generateMemoir(address: string, neighborhood?: string): Promise<Era[]> {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

  const eras = [
    { id: "origins", title: "Origins (1830s–1900)", period: "1830s to 1900" },
    { id: "boom", title: "The Boom (1900–1940)", period: "1900 to 1940" },
    { id: "turning-point", title: "The Turning Point (1940–1970)", period: "1940 to 1970" },
    { id: "struggle", title: "The Struggle (1970–2000)", period: "1970 to 2000" },
    { id: "today", title: "Today & What's Next (2000–present)", period: "2000 to present day" },
  ];

  const generationPromises = eras.map(async (era) => {
    const prompt = `You are the location at ${address} (Neighborhood: ${neighborhood || 'Chicago'}). 
    Write a first-person memoir of your life during the era: ${era.title} (${era.period}).
    Adopt a candid, proud, specific, and emotionally honest tone inspired by Studs Terkel and Chicago historian Shermann "Dilla" Thomas.
    Include at least 3 specific, verifiable historical facts about this exact location or its immediate neighborhood during this time.
    If specific facts for this exact address are unavailable, expand to the broader neighborhood context of ${neighborhood || 'this part of Chicago'}.
    
    Return the response in JSON format with the following fields:
    - monologue: The first-person narrative (approx 150-200 words).
    - pullQuote: The most emotional peak sentence from the monologue.
    - imagePrompt: A detailed prompt for an AI image generator to create a photorealistic, historically accurate, and archival-style photograph of this location during this era. For the 'Today' era, ensure it looks like a real, modern-day high-resolution photograph of the area.
    - videoPrompt: A detailed prompt for a video generator (Veo) to create a cinematic, slow-motion panning shot of this location during this era, capturing the atmosphere, lighting, and historical details described in the monologue.
    
    IMPORTANT: Use the provided tools to find REAL historical sources, archive links, or map locations relevant to this era and address. 
    The grounding metadata should include links to historical societies, news archives, or specific landmarks.`;

    // Using gemini-2.5-flash for Maps grounding support as per guidelines
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        temperature: 0.85,
        tools: [{ googleSearch: {} }, { googleMaps: {} }],
      },
    });

    // Extract JSON from text response (handling potential markdown blocks)
    const text = response.text || "{}";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const result = JSON.parse(jsonMatch ? jsonMatch[0] : "{}");
    
    // Extract map grounding chunks
    const mapLinks: { title: string; uri: string }[] = [];
    let coordinates: { lat: number; lng: number } | undefined;

    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (groundingChunks) {
      groundingChunks.forEach((chunk: any) => {
        if (chunk.maps) {
          mapLinks.push({
            title: chunk.maps.title || "View on Maps",
            uri: chunk.maps.uri
          });
          
          if (!coordinates && chunk.maps.uri) {
            const match = chunk.maps.uri.match(/ll=([-.\d]+),([-.\d]+)/) || chunk.maps.uri.match(/@([-.\d]+),([-.\d]+)/);
            if (match) {
              coordinates = { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
            }
          }
        } else if (chunk.web) {
          mapLinks.push({
            title: chunk.web.title || "Historical Source",
            uri: chunk.web.uri
          });
        }
      });
    }

    // Generate the image
    const imageResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: [{ parts: [{ text: result.imagePrompt }] }],
      config: {
        imageConfig: {
          aspectRatio: "16:9",
        }
      }
    });

    let imageUrl = "";
    for (const part of imageResponse.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        imageUrl = `data:image/png;base64,${part.inlineData.data}`;
        break;
      }
    }

    return {
      ...era,
      ...result,
      imageUrl,
      videoUrl: "/evolution.mp4",
      mapLinks,
      coordinates,
    } as Era;
  });

  return Promise.all(generationPromises);
}
