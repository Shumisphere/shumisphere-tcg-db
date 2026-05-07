import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: (process.env.GEMINI_API_KEY || "") as string });

export interface ExtractedLottery {
    productName: string;
    storeName: string;
    applicationStart: string | null;
    applicationEnd: string | null;
    resultDate: string | null;
    purchaseStart: string | null;
    purchaseEnd: string | null;
    status: string;
    notes: string;
    sourceUrl: string;
    imageUrl: string | null;
}

export async function extractLotteryInfo(text: string): Promise<ExtractedLottery[]> {
    const prompt = `
    Extract lottery-related information from the following Japanese text. 
    Look for product names, store names, and key dates (application, results, purchase).
    Normalize all dates to ISO-8601 format (YYYY-MM-DDTHH:mm:ssZ). 
    Assume JST (UTC+9) and current year (2025/2026) if not specified.

    Rules for URLs:
    - If a link is explicitly provided for a store, extract it.
    - If no link is provided but it says "Apply via App" (アプリ), use "(APP_ONLY)" as the sourceUrl and add instructions to "notes".
    - If multiple stores are listed, return one object per store event.
    
    Status should be one of: UPCOMING, ACTIVE, CLOSED.
    
    Text:
    ${text}
    
    Return a JSON array of objects with the following keys:
    productName, storeName, applicationStart, applicationEnd, resultDate, purchaseStart, purchaseEnd, status, notes, sourceUrl, imageUrl (if an image or poster link is found)
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: [{ parts: [{ text: prompt }] }],
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            productName: { type: Type.STRING },
                            storeName: { type: Type.STRING },
                            applicationStart: { type: Type.STRING, nullable: true },
                            applicationEnd: { type: Type.STRING, nullable: true },
                            resultDate: { type: Type.STRING, nullable: true },
                            purchaseStart: { type: Type.STRING, nullable: true },
                            purchaseEnd: { type: Type.STRING, nullable: true },
                            status: { type: Type.STRING },
                            notes: { type: Type.STRING },
                            sourceUrl: { type: Type.STRING },
                            imageUrl: { type: Type.STRING, nullable: true }
                        },
                        required: ["productName", "storeName", "status", "sourceUrl"]
                    }
                }
            }
        });
        
        const content = response.text || "";
        // Clean any potential markdown if the model ignores responseMimeType (rare but happens)
        const jsonStr = content.replace(/```json|```/g, "").trim();
        
        try {
            return JSON.parse(jsonStr);
        } catch (parseError) {
            // Fallback: try to find the start and end of the array
            const firstBracket = jsonStr.indexOf("[");
            const lastBracket = jsonStr.lastIndexOf("]");
            if (firstBracket !== -1 && lastBracket !== -1) {
                const innerJson = jsonStr.substring(firstBracket, lastBracket + 1);
                return JSON.parse(innerJson);
            }
            throw parseError;
        }
    } catch (error) {
        console.error("Gemini extraction error:", error);
        return [];
    }
}
