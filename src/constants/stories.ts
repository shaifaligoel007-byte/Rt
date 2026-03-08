import { Story } from "../services/geminiService";

export const BUILTIN_STORIES: Story[] = [
  {
    title: "A Surprise Visit",
    characters: [
      { name: "Anna", role: "major", description: "A friendly friend who loves surprises." },
      { name: "Ben", role: "major", description: "A welcoming host who is easily surprised." }
    ],
    lines: [
      { character: "Anna", text: "¡Hola! ¿Hay alguien en casa?", translation: "Hello! Is anyone home?" },
      { character: "Ben", text: "¡Anna! ¿Qué haces aquí?", translation: "Anna! What are you doing here?" },
      { character: "Anna", text: "Quería darte una sorpresa.", translation: "I wanted to give you a surprise." },
      { character: "Ben", text: "¡Es una gran sorpresa! Pasa, por favor.", translation: "It's a great surprise! Come in, please." }
    ],
    questions: [
      {
        type: "multiple_choice",
        lineIndex: 1,
        question: "Why is Ben surprised?",
        options: ["He didn't expect Anna", "He is busy", "He lost his keys", "He is tired"],
        correctAnswer: "He didn't expect Anna",
        explanation: "Ben asks 'What are you doing here?' which indicates he was not expecting her."
      }
    ]
  },
  {
    title: "The Lost Key",
    characters: [
      { name: "Sarah", role: "major", description: "A bit forgetful but very kind." },
      { name: "Tom", role: "major", description: "Helpful and observant." }
    ],
    lines: [
      { character: "Sarah", text: "Oh no, where are my keys?", translation: "Oh no, where are my keys?" },
      { character: "Tom", text: "Did you check your bag?", translation: "Did you check your bag?" },
      { character: "Sarah", text: "Yes, they aren't there.", translation: "Yes, they aren't there." },
      { character: "Tom", text: "Look, they are on the table!", translation: "Look, they are on the table!" }
    ],
    questions: [
      {
        type: "multiple_choice",
        lineIndex: 3,
        question: "Where were the keys?",
        options: ["In the bag", "On the table", "In the car", "Under the sofa"],
        correctAnswer: "On the table",
        explanation: "Tom points out that they are on the table."
      }
    ]
  }
];
