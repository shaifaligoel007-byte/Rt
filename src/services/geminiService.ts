import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export type QuestionType = 'multiple_choice' | 'fill_in_blank' | 'true_false' | 'image_choice';

export interface Question {
  type: QuestionType;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

export interface Quiz {
  title: string;
  questions: Question[];
}

export interface StoryLine {
  character: string;
  text: string;
  translation: string;
}

export interface StoryQuestion {
  type: QuestionType;
  lineIndex: number;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

export interface StoryCharacter {
  name: string;
  role: 'major' | 'minor';
  description: string;
}

export interface Story {
  title: string;
  characters: StoryCharacter[];
  lines: StoryLine[];
  questions: StoryQuestion[];
}

export interface SpecialLesson {
  title: string;
  level: number;
  questions: Question[];
}

export async function generateSpecialLesson(base64Pdfs: string[], level: number): Promise<SpecialLesson> {
  const model = "gemini-3-flash-preview";
  
  const prompt = `
    You are an expert language teacher. 
    Analyze the provided PDF documents and create a "Special Mastery Lesson" at Level ${level} (out of 7).
    
    Level Guidelines:
    - Level 1-2: Basic vocabulary and simple recognition.
    - Level 3-4: Intermediate grammar and sentence structure.
    - Level 5-6: Advanced comprehension and complex usage.
    - Level 7: Mastery level - challenging questions that test deep understanding.
    
    Each level should feel different. Use different patterns, focus on different words from the PDFs, and vary the question styles.
    
    The lesson should have 8-12 questions.
    Include a mix of these question types:
    1. 'multiple_choice': Standard 4-option question.
    2. 'fill_in_blank': A sentence with a blank.
    3. 'true_false': A statement.
    4. 'image_choice': Identify the correct image for a word.
    
    Return the response in strict JSON format.
  `;

  const pdfParts = base64Pdfs.map(data => ({
    inlineData: {
      mimeType: "application/pdf",
      data,
    },
  }));

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        parts: [
          { text: prompt },
          ...pdfParts
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          questions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                type: { 
                  type: Type.STRING, 
                  description: "One of: multiple_choice, fill_in_blank, true_false, image_choice" 
                },
                question: { type: Type.STRING },
                options: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                correctAnswer: { type: Type.STRING },
                explanation: { type: Type.STRING },
              },
              required: ["type", "question", "options", "correctAnswer", "explanation"],
            },
          },
        },
        required: ["title", "questions"],
      },
    },
  });

  const text = response.text;
  if (!text) throw new Error("No response from AI");
  const data = JSON.parse(text);
  return { ...data, level };
}

export async function generateQuizFromPdfs(base64Pdfs: string[]): Promise<Quiz> {
  const model = "gemini-3-flash-preview";
  
  const prompt = `
    You are an expert language teacher. 
    Analyze the provided PDF documents (there may be multiple) and create a fun, engaging language learning quiz.
    The quiz should have 5-10 questions.
    Include a mix of these question types:
    1. 'multiple_choice': Standard 4-option question.
    2. 'fill_in_blank': A sentence with a blank (e.g., "The cat ___ on the mat") where the answer is the missing word. Provide 4 options.
    3. 'true_false': A statement that is either True or False. Provide only 2 options: "True" and "False".
    4. 'image_choice': A question where the user must identify the correct image for a given word. The 'question' should be something like "Which image represents 'Apple'?" and the 'options' should be 4 descriptive keywords for images (e.g., ["Apple", "Banana", "Orange", "Grape"]).
    
    Focus on vocabulary, grammar, and comprehension based on the content of all provided PDFs.
    Make it feel like a Duolingo lesson.
    
    Return the response in strict JSON format.
  `;

  const pdfParts = base64Pdfs.map(data => ({
    inlineData: {
      mimeType: "application/pdf",
      data,
    },
  }));

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        parts: [
          { text: prompt },
          ...pdfParts
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          questions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                type: { 
                  type: Type.STRING, 
                  description: "One of: multiple_choice, fill_in_blank, true_false" 
                },
                question: { type: Type.STRING },
                options: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                correctAnswer: { type: Type.STRING },
                explanation: { type: Type.STRING },
              },
              required: ["type", "question", "options", "correctAnswer", "explanation"],
            },
          },
        },
        required: ["title", "questions"],
      },
    },
  });

  const text = response.text;
  if (!text) throw new Error("No response from AI");
  return JSON.parse(text);
}

export async function generateStoryFromPdfs(base64Pdfs: string[]): Promise<Story> {
  const model = "gemini-3-flash-preview";
  
  const prompt = `
    You are an expert language teacher. 
    Analyze the provided PDF documents. The PDFs contain normal text or prose.
    
    Your task is to TRANSFORM this text into an interactive Duolingo-style story dialogue.
    
    1. Create 2-4 distinct characters based on the themes of the PDF.
    2. Take the information, facts, or narrative from the PDF and DISTRIBUTE them among these characters as a conversation.
    3. Even if the PDF is just a list of facts or a story in third-person, REWRITE it so the characters are discussing these facts or living the story through dialogue.
    4. Assign different sentences or pieces of information from the text to different characters to make the conversation feel like a natural, random, and dynamic exchange.
    
    The story should have 10-15 lines of dialogue.
    Include 3-4 questions interspersed throughout the story.
    Mix these question types: 'multiple_choice', 'fill_in_blank', 'true_false'.
    Each question should reference a specific 'lineIndex' (0-indexed) after which the question should appear.
    
    Return the response in strict JSON format.
  `;

  const pdfParts = base64Pdfs.map(data => ({
    inlineData: {
      mimeType: "application/pdf",
      data,
    },
  }));

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        parts: [
          { text: prompt },
          ...pdfParts
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          characters: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                role: { type: Type.STRING, description: "One of: major, minor" },
                description: { type: Type.STRING },
              },
              required: ["name", "role", "description"],
            },
          },
          lines: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                character: { type: Type.STRING },
                text: { type: Type.STRING },
                translation: { type: Type.STRING },
              },
              required: ["character", "text", "translation"],
            },
          },
          questions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                type: { 
                  type: Type.STRING, 
                  description: "One of: multiple_choice, fill_in_blank, true_false" 
                },
                lineIndex: { type: Type.NUMBER },
                question: { type: Type.STRING },
                options: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                correctAnswer: { type: Type.STRING },
                explanation: { type: Type.STRING },
              },
              required: ["type", "lineIndex", "question", "options", "correctAnswer", "explanation"],
            },
          },
        },
        required: ["title", "characters", "lines", "questions"],
      },
    },
  });

  const text = response.text;
  if (!text) throw new Error("No response from AI");
  return JSON.parse(text);
}

export async function generateSpeech(text: string): Promise<string | undefined> {
  const model = "gemini-2.5-flash-preview-tts";
  
  try {
    const response = await ai.models.generateContent({
      model,
      contents: [{ parts: [{ text: `Pronounce this clearly: ${text}` }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: "Kore" },
          },
        },
      },
    });

    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  } catch (error) {
    console.error("TTS Error:", error);
    return undefined;
  }
}
