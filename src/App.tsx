/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Upload, 
  FileText, 
  CheckCircle2, 
  XCircle, 
  ArrowRight, 
  RotateCcw, 
  Loader2,
  Trophy,
  ChevronLeft,
  BookOpen,
  MessageSquare,
  Play,
  Volume2,
  Star,
  Zap
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { 
  generateQuizFromPdfs, 
  generateStoryFromPdfs, 
  generateSpeech, 
  generateSpecialLesson,
  Quiz, 
  Question, 
  Story, 
  StoryLine, 
  StoryQuestion,
  SpecialLesson
} from './services/geminiService';
import { BUILTIN_STORIES } from './constants/stories';

type AppState = 'home' | 'upload' | 'loading' | 'quiz' | 'story' | 'special_lesson' | 'result';

interface Unit {
  id: number;
  title: string;
  description: string;
  status: 'locked' | 'available' | 'completed';
}

interface Section {
  id: string;
  title: string;
  color: string;
  units: Unit[];
}

const SECTIONS: Section[] = [
  {
    id: 'beginner',
    title: 'Beginner',
    color: 'bg-emerald-500',
    units: Array.from({ length: 55 }, (_, i) => ({
      id: i + 1,
      title: `Unit ${i + 1}`,
      description: i === 0 ? 'Basics & Greetings' : 'Continue your journey',
      status: i === 0 ? 'available' : 'locked',
    })),
  },
  {
    id: 'intermediate',
    title: 'Intermediate',
    color: 'bg-sky-500',
    units: Array.from({ length: 30 }, (_, i) => ({
      id: i + 56,
      title: `Unit ${i + 56}`,
      description: 'Expanding horizons',
      status: 'locked',
    })),
  },
  {
    id: 'high',
    title: 'High (Advanced)',
    color: 'bg-violet-500',
    units: Array.from({ length: 20 }, (_, i) => ({
      id: i + 86,
      title: `Unit ${i + 86}`,
      description: 'Mastery & Nuance',
      status: 'locked',
    })),
  },
];

export default function App() {
  const [state, setState] = useState<AppState>('home');
  const [homeTab, setHomeTab] = useState<'path' | 'stories' | 'special'>('path');
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [activeSection, setActiveSection] = useState<string>('beginner');
  const [mode, setMode] = useState<'quiz' | 'story' | 'special'>('quiz');
  const [userLibrary, setUserLibrary] = useState<{ id: string, type: 'quiz' | 'story' | 'special', data: Quiz | Story | SpecialLesson, date: string }[]>(() => {
    const saved = localStorage.getItem('linguo_library');
    return saved ? JSON.parse(saved) : [];
  });
  const [userProgress, setUserProgress] = useState<{
    completedUnits: number[];
    unitScores: Record<number, number>;
    totalXP: number;
    streak: number;
    lastActiveDate: string | null;
    specialLessons: Record<string, { level: number, completedCount: number }>;
  }>(() => {
    const saved = localStorage.getItem('linguo_progress');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (!parsed.specialLessons) parsed.specialLessons = {};
      // Basic streak logic
      const today = new Date().toLocaleDateString();
      if (parsed.lastActiveDate && parsed.lastActiveDate !== today) {
        const lastDate = new Date(parsed.lastActiveDate);
        const diff = Math.floor((new Date().getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diff > 1) parsed.streak = 0;
      }
      return parsed;
    }
    return {
      completedUnits: [],
      unitScores: {},
      totalXP: 0,
      streak: 0,
      lastActiveDate: null,
      specialLessons: {}
    };
  });
  const [quizQueue, setQuizQueue] = useState<Quiz[]>([]);
  const [storyQueue, setStoryQueue] = useState<Story[]>([]);
  const [specialLesson, setSpecialLesson] = useState<SpecialLesson | null>(null);
  const [currentQueueIndex, setCurrentQueueIndex] = useState(0);
  const [loadingProgress, setLoadingProgress] = useState({ current: 0, total: 0 });
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [story, setStory] = useState<Story | null>(null);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [visibleLines, setVisibleLines] = useState<number>(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState<string | null>(null);
  const [uploadedPdfs, setUploadedPdfs] = useState<string[]>([]);
  const [activeSpecialLessonId, setActiveSpecialLessonId] = useState<string | null>(null);

  const playPronunciation = async (text: string) => {
    if (isSpeaking) return;
    setIsSpeaking(text);
    try {
      const base64Audio = await generateSpeech(text);
      if (base64Audio) {
        const audio = new Audio(`data:audio/wav;base64,${base64Audio}`);
        audio.onended = () => setIsSpeaking(null);
        await audio.play();
      } else {
        setIsSpeaking(null);
      }
    } catch (err) {
      console.error("Failed to play audio:", err);
      setIsSpeaking(null);
    }
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    setState('loading');
    setError(null);
    setLoadingProgress({ current: 0, total: acceptedFiles.length });

    try {
      const generatedQuizzes: Quiz[] = [];
      const generatedStories: Story[] = [];

      for (let i = 0; i < acceptedFiles.length; i++) {
        setLoadingProgress({ current: i + 1, total: acceptedFiles.length });
        const file = acceptedFiles[i];
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        try {
          if (mode === 'quiz') {
            const result = await generateQuizFromPdfs([base64]);
            generatedQuizzes.push(result);
          } else if (mode === 'story') {
            const result = await generateStoryFromPdfs([base64]);
            generatedStories.push(result);
          } else if (mode === 'special') {
            const result = await generateSpecialLesson([base64], 1);
            const lessonId = Math.random().toString(36).substr(2, 9);
            
            const newProgress = { ...userProgress };
            newProgress.specialLessons[lessonId] = { level: 1, completedCount: 0 };
            setUserProgress(newProgress);
            localStorage.setItem('linguo_progress', JSON.stringify(newProgress));

            const newLibraryItem = {
              id: lessonId,
              type: 'special' as const,
              data: result,
              date: new Date().toLocaleDateString(),
              pdfs: [base64] // Store PDF for regeneration
            };
            const updatedLibrary = [newLibraryItem, ...userLibrary];
            setUserLibrary(updatedLibrary as any);
            localStorage.setItem('linguo_library', JSON.stringify(updatedLibrary));

            setSpecialLesson(result);
            setActiveSpecialLessonId(lessonId);
            setUploadedPdfs([base64]);
            setState('special_lesson');
            return; // Exit early for special lesson
          }
        } catch (err) {
          console.error(`Error generating for file ${i + 1}:`, err);
          // Continue with other files if one fails, or handle error
        }
      }

      if (mode === 'quiz' && generatedQuizzes.length > 0) {
        const newLibraryItems = generatedQuizzes.map(q => ({
          id: Math.random().toString(36).substr(2, 9),
          type: 'quiz' as const,
          data: q,
          date: new Date().toLocaleDateString()
        }));
        const updatedLibrary = [...newLibraryItems, ...userLibrary];
        setUserLibrary(updatedLibrary);
        localStorage.setItem('linguo_library', JSON.stringify(updatedLibrary));

        setQuizQueue(generatedQuizzes);
        setQuiz(generatedQuizzes[0]);
        setCurrentQueueIndex(0);
        setState('quiz');
      } else if (mode === 'story' && generatedStories.length > 0) {
        const newLibraryItems = generatedStories.map(s => ({
          id: Math.random().toString(36).substr(2, 9),
          type: 'story' as const,
          data: s,
          date: new Date().toLocaleDateString()
        }));
        const updatedLibrary = [...newLibraryItems, ...userLibrary];
        setUserLibrary(updatedLibrary);
        localStorage.setItem('linguo_library', JSON.stringify(updatedLibrary));

        setStoryQueue(generatedStories);
        setStory(generatedStories[0]);
        setCurrentQueueIndex(0);
        setVisibleLines(0);
        setState('story');
      } else {
        throw new Error(`Failed to generate any ${mode}s.`);
      }
    } catch (err) {
      console.error(err);
      setError('Error reading or processing files.');
      setState('upload');
    }
  }, [mode]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (files: File[]) => { onDrop(files); },
    accept: { 'application/pdf': ['.pdf'] },
    multiple: true,
    maxFiles: 20
  } as any);

  const handleOptionSelect = (option: string) => {
    if (isAnswered) return;
    setSelectedOption(option);
  };

  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isAnswered) {
        if (e.key === 'Enter') {
          handleNextQuestion();
        }
        return;
      }

      if (state === 'quiz' && quiz) {
        const options = quiz.questions[currentQuestionIndex].options;
        const key = parseInt(e.key);
        if (key >= 1 && key <= options.length) {
          handleOptionSelect(options[key - 1]);
        }
        if (e.key === 'Enter' && selectedOption) {
          handleCheckAnswer();
        }
      } else if (state === 'story' && story) {
        const currentQ = story.questions.find(q => q.lineIndex === visibleLines - 1);
        if (currentQ) {
          const key = parseInt(e.key);
          if (key >= 1 && key <= currentQ.options.length) {
            handleOptionSelect(currentQ.options[key - 1]);
          }
          if (e.key === 'Enter' && selectedOption) {
            handleCheckAnswer();
          }
        } else if (e.key === 'Enter' || e.key === ' ') {
          handleNextLine();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state, quiz, story, currentQuestionIndex, visibleLines, isAnswered, selectedOption]);

  const handleNextLine = () => {
    if (!story) return;
    
    // Check if there's a question for the current line
    const question = story.questions.find(q => q.lineIndex === visibleLines - 1);
    
    if (question && !isAnswered) {
      // Show question instead of next line
      setIsAnswered(false);
      return;
    }

    if (visibleLines < story.lines.length) {
      setVisibleLines(v => v + 1);
      setIsAnswered(false);
      setSelectedOption(null);
    } else {
      updateProgress(score);
      setState('result');
    }
  };

  const handleCheckAnswer = () => {
    if (!selectedOption) return;
    
    let currentQuestion;
    if (state === 'quiz' && quiz) {
      currentQuestion = quiz.questions[currentQuestionIndex];
    } else if (state === 'story' && story) {
      currentQuestion = story.questions.find(q => q.lineIndex === visibleLines - 1);
    } else if (state === 'special_lesson' && specialLesson) {
      currentQuestion = specialLesson.questions[currentQuestionIndex];
    }

    if (!currentQuestion) return;

    const isCorrect = selectedOption === currentQuestion.correctAnswer;
    
    if (isCorrect) {
      const newScore = score + 1;
      setScore(newScore);
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#58cc02', '#ffc800', '#ce82ff']
      });
    }
    
    setIsAnswered(true);
  };

  const updateProgress = (finalScore: number) => {
    const today = new Date().toLocaleDateString();
    
    setUserProgress(prev => {
      const newProgress = { ...prev };
      
      // Update XP
      const xpGained = finalScore * 10;
      newProgress.totalXP += xpGained;

      // Update Streak
      if (newProgress.lastActiveDate !== today) {
        newProgress.streak += 1;
        newProgress.lastActiveDate = today;
      }

      // Update Unit Completion
      if (selectedUnit) {
        if (!newProgress.completedUnits.includes(selectedUnit.id)) {
          newProgress.completedUnits = [...newProgress.completedUnits, selectedUnit.id];
        }
        const currentBest = newProgress.unitScores[selectedUnit.id] || 0;
        newProgress.unitScores = {
          ...newProgress.unitScores,
          [selectedUnit.id]: Math.max(currentBest, finalScore)
        };
      }

      // Update Special Lessons
      if (state === 'special_lesson' && activeSpecialLessonId) {
        const current = newProgress.specialLessons[activeSpecialLessonId] || { level: 1, completedCount: 0 };
        const totalQuestions = specialLesson?.questions.length || 1;
        const scorePercentage = (finalScore / totalQuestions) * 100;

        if (scorePercentage >= 80) {
          // Advance level if score is high enough
          if (current.level < 7) {
            newProgress.specialLessons[activeSpecialLessonId] = {
              level: current.level + 1,
              completedCount: current.completedCount + 1
            };
          } else {
            newProgress.specialLessons[activeSpecialLessonId] = {
              ...current,
              completedCount: current.completedCount + 1
            };
          }
        } else {
          newProgress.specialLessons[activeSpecialLessonId] = {
            ...current,
            completedCount: current.completedCount + 1
          };
        }
      }

      localStorage.setItem('linguo_progress', JSON.stringify(newProgress));
      return newProgress;
    });
  };

  const handleNextQuestion = () => {
    if (state === 'quiz' && quiz) {
      if (currentQuestionIndex < quiz.questions.length - 1) {
        setCurrentQuestionIndex(i => i + 1);
        setSelectedOption(null);
        setIsAnswered(false);
      } else {
        updateProgress(score);
        setState('result');
      }
    } else if (state === 'special_lesson' && specialLesson) {
      if (currentQuestionIndex < specialLesson.questions.length - 1) {
        setCurrentQuestionIndex(i => i + 1);
        setSelectedOption(null);
        setIsAnswered(false);
      } else {
        updateProgress(score);
        setState('result');
      }
    } else if (state === 'story') {
      handleNextLine();
    }
  };

  const handleNextQueueItem = () => {
    const nextIndex = currentQueueIndex + 1;
    if (mode === 'quiz' && nextIndex < quizQueue.length) {
      setCurrentQueueIndex(nextIndex);
      setQuiz(quizQueue[nextIndex]);
      setCurrentQuestionIndex(0);
      setSelectedOption(null);
      setIsAnswered(false);
      setScore(0);
      setState('quiz');
    } else if (mode === 'story' && nextIndex < storyQueue.length) {
      setCurrentQueueIndex(nextIndex);
      setStory(storyQueue[nextIndex]);
      setVisibleLines(0);
      setSelectedOption(null);
      setIsAnswered(false);
      setScore(0);
      setState('story');
    } else {
      resetQuiz();
    }
  };

  const resetQuiz = () => {
    setState('home');
    setQuiz(null);
    setStory(null);
    setSpecialLesson(null);
    setActiveSpecialLessonId(null);
    setQuizQueue([]);
    setStoryQueue([]);
    setCurrentQueueIndex(0);
    setCurrentQuestionIndex(0);
    setVisibleLines(0);
    setSelectedOption(null);
    setIsAnswered(false);
    setScore(0);
  };

  const progress = quiz ? ((currentQuestionIndex + 1) / quiz.questions.length) * 100 : 0;

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900">
      {/* Header */}
      <header className="border-b border-slate-100 py-4 sticky top-0 bg-white z-10">
        <div className="max-w-2xl mx-auto px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-emerald-200">
              L
            </div>
            <h1 className="text-xl font-bold tracking-tight text-emerald-600">LinguoQuiz</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 bg-orange-50 px-3 py-1 rounded-full border border-orange-100">
              <span className="text-orange-500 font-bold">🔥</span>
              <span className="text-orange-700 font-bold text-sm">{userProgress.streak}</span>
            </div>
            <div className="flex items-center gap-1 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
              <Trophy className="w-4 h-4 text-emerald-500" />
              <span className="text-emerald-700 font-bold text-sm">{userProgress.totalXP} XP</span>
            </div>
            {(state === 'quiz' || state === 'upload' || state === 'story') && (
              <button 
                onClick={resetQuiz}
                className="p-2 hover:bg-slate-50 rounded-full transition-colors text-slate-400"
              >
                <XCircle className="w-6 h-6" />
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {state === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-12 pb-24"
            >
              {/* Main Tabs */}
              <div className="flex border-b border-slate-100">
                <button
                  onClick={() => setHomeTab('path')}
                  className={`flex-1 py-4 font-bold text-lg transition-all border-b-4 ${homeTab === 'path' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                >
                  LEARN
                </button>
                <button
                  onClick={() => setHomeTab('stories')}
                  className={`flex-1 py-4 font-bold text-lg transition-all border-b-4 ${homeTab === 'stories' ? 'border-sky-500 text-sky-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                >
                  STORIES
                </button>
                <button
                  onClick={() => setHomeTab('special')}
                  className={`flex-1 py-4 font-bold text-lg transition-all border-b-4 ${homeTab === 'special' ? 'border-amber-500 text-amber-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                >
                  SPECIAL
                </button>
              </div>

              {homeTab === 'path' ? (
                <div className="space-y-8">
                  {/* Progress Overview Card */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-white border-2 border-slate-100 p-4 rounded-3xl text-center">
                      <p className="text-2xl font-black text-emerald-500">{userProgress.completedUnits.length}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Units Done</p>
                    </div>
                    <div className="bg-white border-2 border-slate-100 p-4 rounded-3xl text-center">
                      <p className="text-2xl font-black text-orange-500">{userProgress.streak}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Day Streak</p>
                    </div>
                    <div className="bg-white border-2 border-slate-100 p-4 rounded-3xl text-center">
                      <p className="text-2xl font-black text-sky-500">{userProgress.totalXP}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total XP</p>
                    </div>
                  </div>

                  {/* Quick Generate Card */}
                  <div className="p-6 bg-emerald-50 rounded-3xl border-2 border-emerald-100 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-white">
                        <Upload className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-emerald-900">Quick Lesson Generator</h3>
                        <p className="text-emerald-700 text-sm">Upload PDFs to create a custom quiz or story</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedUnit(null);
                        setMode('quiz');
                        setState('upload');
                      }}
                      className="w-full py-3 bg-white text-emerald-600 rounded-xl font-bold border-2 border-emerald-200 hover:bg-emerald-100 transition-all flex items-center justify-center gap-2"
                    >
                      <Upload className="w-5 h-5" />
                      UPLOAD PDFS & START
                    </button>
                  </div>

                  {/* Section Tabs */}
                  <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl sticky top-20 z-10 shadow-sm">
                    {SECTIONS.map((section, idx) => (
                      <button
                        key={section.id}
                        onClick={() => setActiveSection(section.id)}
                        className={`
                          flex-1 py-3 px-4 rounded-xl font-bold text-sm transition-all
                          ${activeSection === section.id 
                            ? `${section.color} text-white shadow-md` 
                            : 'text-slate-500 hover:bg-slate-200'}
                        `}
                      >
                        {idx + 1}. {section.title}
                      </button>
                    ))}
                  </div>

                  {/* Units Path */}
                  <div className="flex flex-col items-center gap-8 py-4">
                    {SECTIONS.find(s => s.id === activeSection)?.units.map((unit, index) => {
                      // Duolingo-style zigzag pattern
                      const offset = Math.sin(index * 0.8) * 40;
                      const isCompleted = userProgress.completedUnits.includes(unit.id);
                      
                      // Improved unlocking logic: check if previous unit in the whole path is completed
                      let isUnlocked = false;
                      if (unit.id === 1) {
                        isUnlocked = true;
                      } else {
                        // Find the unit with id - 1
                        isUnlocked = userProgress.completedUnits.includes(unit.id - 1);
                      }
                      
                      return (
                        <motion.div
                          key={unit.id}
                          initial={{ opacity: 0, scale: 0.8 }}
                          whileInView={{ opacity: 1, scale: 1 }}
                          viewport={{ once: true }}
                          style={{ transform: `translateX(${offset}px)` }}
                          className="relative group"
                        >
                          <button
                            onClick={() => {
                              setSelectedUnit(unit);
                              setState('upload');
                            }}
                            className={`
                              w-20 h-20 rounded-full flex items-center justify-center text-white font-black text-2xl shadow-[0_8px_0_rgb(0,0,0,0.1)] transition-all active:translate-y-1 active:shadow-none relative
                              ${!isUnlocked ? 'bg-slate-300 cursor-not-allowed' : (isCompleted ? 'bg-yellow-400' : SECTIONS.find(s => s.id === activeSection)?.color)}
                              ${isUnlocked && !isCompleted ? 'ring-8 ring-emerald-100 animate-pulse' : ''}
                            `}
                            disabled={!isUnlocked}
                          >
                            <div className="flex flex-col items-center">
                              <span className="text-xl leading-none">{unit.id}</span>
                              {isCompleted && <CheckCircle2 className="w-5 h-5 mt-1" />}
                            </div>
                            
                            {/* Score badge if completed */}
                            {isCompleted && userProgress.unitScores[unit.id] !== undefined && (
                              <div className="absolute -top-2 -right-2 bg-white text-emerald-600 text-[10px] font-black px-2 py-1 rounded-full border-2 border-emerald-100 shadow-sm">
                                {userProgress.unitScores[unit.id]}
                              </div>
                            )}
                          </button>
                          
                          {/* Tooltip-style label */}
                          <div className="absolute left-1/2 -translate-x-1/2 top-full mt-4 bg-white border-2 border-slate-200 px-4 py-2 rounded-xl shadow-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                            <p className="font-bold text-slate-800">{unit.title}</p>
                            <p className="text-xs text-slate-500">{isCompleted ? 'Perfect!' : unit.description}</p>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6">
                  <div className="p-6 bg-sky-50 rounded-3xl border-2 border-sky-100 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-sky-500 rounded-2xl flex items-center justify-center text-white">
                        <BookOpen className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-sky-900">AI Story Generator</h3>
                        <p className="text-sky-700 text-sm">Create a story from your own PDF</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedUnit(null);
                        setMode('story');
                        setState('upload');
                      }}
                      className="w-full py-3 bg-white text-sky-600 rounded-xl font-bold border-2 border-sky-200 hover:bg-sky-100 transition-all flex items-center justify-center gap-2"
                    >
                      <Upload className="w-5 h-5" />
                      UPLOAD PDF STORY
                    </button>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-xl font-bold text-slate-800 px-2">Featured Stories</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {BUILTIN_STORIES.map((s, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            setStory(s);
                            setVisibleLines(0);
                            setState('story');
                          }}
                          className="p-6 bg-white border-2 border-slate-100 rounded-3xl hover:border-sky-300 hover:shadow-lg transition-all text-left group"
                        >
                          <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-sky-100 group-hover:text-sky-500 transition-colors mb-4">
                            <Play className="w-5 h-5 fill-current" />
                          </div>
                          <h4 className="text-lg font-bold text-slate-800">{s.title}</h4>
                          <p className="text-sm text-slate-500 mt-1">{s.lines.length} lines • {s.questions.length} questions</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {userLibrary.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between px-2">
                        <h3 className="text-xl font-bold text-slate-800">My Library</h3>
                        <button 
                          onClick={() => {
                            if (confirm('Reset all your progress, XP, and streaks? This cannot be undone.')) {
                              const reset = {
                                completedUnits: [],
                                unitScores: {},
                                totalXP: 0,
                                streak: 0,
                                lastActiveDate: null,
                                specialLessons: {}
                              };
                              setUserProgress(reset);
                              localStorage.setItem('linguo_progress', JSON.stringify(reset));
                            }
                          }}
                          className="text-xs font-bold text-slate-400 hover:text-red-600 uppercase tracking-wider ml-4"
                        >
                          Reset Progress
                        </button>
                        <button 
                          onClick={() => {
                            if (confirm('Clear your library?')) {
                              setUserLibrary([]);
                              localStorage.removeItem('linguo_library');
                            }
                          }}
                          className="text-xs font-bold text-red-400 hover:text-red-600 uppercase tracking-wider"
                        >
                          Clear Library
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {userLibrary.map((item, idx) => (
                          <button
                            key={item.id}
                            onClick={async () => {
                              if (item.type === 'quiz') {
                                setQuiz(item.data as Quiz);
                                setQuizQueue([item.data as Quiz]);
                                setCurrentQueueIndex(0);
                                setState('quiz');
                              } else if (item.type === 'story') {
                                setStory(item.data as Story);
                                setStoryQueue([item.data as Story]);
                                setCurrentQueueIndex(0);
                                setVisibleLines(0);
                                setState('story');
                              } else if (item.type === 'special') {
                                const progress = userProgress.specialLessons[item.id] || { level: 1, completedCount: 0 };
                                const pdfs = (item as any).pdfs;
                                if (pdfs && pdfs.length > 0) {
                                  setState('loading');
                                  try {
                                    const lesson = await generateSpecialLesson(pdfs, progress.level);
                                    setSpecialLesson(lesson);
                                    setActiveSpecialLessonId(item.id);
                                    setUploadedPdfs(pdfs);
                                    setState('special_lesson');
                                  } catch (err) {
                                    setError("Failed to regenerate lesson. Please try again.");
                                    setState('home');
                                  }
                                }
                              }
                            }}
                            className={`p-6 bg-white border-2 border-slate-100 rounded-3xl transition-all text-left group relative overflow-hidden ${item.type === 'quiz' ? 'hover:border-emerald-300' : item.type === 'story' ? 'hover:border-sky-300' : 'hover:border-amber-300'} hover:shadow-lg`}
                          >
                            <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                              <span className="text-6xl font-black text-slate-800">{idx + 1}</span>
                            </div>
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${item.type === 'quiz' ? 'bg-emerald-50 text-emerald-500' : item.type === 'story' ? 'bg-sky-50 text-sky-500' : 'bg-amber-50 text-amber-500'}`}>
                              {item.type === 'quiz' ? <MessageSquare className="w-5 h-5" /> : item.type === 'story' ? <BookOpen className="w-5 h-5" /> : <Zap className="w-5 h-5" />}
                            </div>
                            <h4 className="text-lg font-bold text-slate-800 line-clamp-1">
                              {idx + 1}. {(item.data as any).title}
                            </h4>
                            <div className="flex items-center justify-between mt-2">
                              <p className="text-xs text-slate-400 font-medium uppercase">
                                {item.type} • {item.date}
                                {item.type === 'special' && ` • Level ${(userProgress.specialLessons[item.id] || { level: 1 }).level}`}
                              </p>
                              <Play className={`w-4 h-4 text-slate-300 transition-colors ${item.type === 'quiz' ? 'group-hover:text-emerald-500' : item.type === 'story' ? 'group-hover:text-sky-500' : 'group-hover:text-amber-500'}`} />
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {homeTab === 'special' && (
                <div className="space-y-8">
                  <div className="p-6 bg-amber-50 rounded-3xl border-2 border-amber-100 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center text-white">
                        <Zap className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-amber-900">Mastery Lessons</h3>
                        <p className="text-amber-700 text-sm">Progress through 7 levels of mastery for each PDF</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setMode('special');
                        setState('upload');
                      }}
                      className="w-full py-3 bg-white text-amber-600 rounded-xl font-bold border-2 border-amber-200 hover:bg-amber-100 transition-all flex items-center justify-center gap-2"
                    >
                      <Upload className="w-5 h-5" />
                      START NEW MASTERY PATH
                    </button>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                      <Star className="w-6 h-6 text-amber-500 fill-amber-500" />
                      Your Mastery Paths
                    </h3>
                    {userLibrary.filter(item => item.type === 'special').length === 0 ? (
                      <div className="text-center py-12 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                        <Zap className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <p className="text-slate-500 font-medium">No mastery paths yet. Upload a PDF to start!</p>
                      </div>
                    ) : (
                      <div className="grid gap-4">
                        {userLibrary.filter(item => item.type === 'special').map((item, idx) => {
                          const progress = userProgress.specialLessons[item.id] || { level: 1, completedCount: 0 };
                          return (
                            <motion.div
                              key={item.id}
                              whileHover={{ scale: 1.02 }}
                              className="bg-white border-2 border-slate-100 p-6 rounded-3xl flex items-center justify-between group cursor-pointer"
                              onClick={async () => {
                                const pdfs = (item as any).pdfs;
                                if (pdfs && pdfs.length > 0) {
                                  setState('loading');
                                  try {
                                    const lesson = await generateSpecialLesson(pdfs, progress.level);
                                    setSpecialLesson(lesson);
                                    setActiveSpecialLessonId(item.id);
                                    setUploadedPdfs(pdfs);
                                    setState('special_lesson');
                                  } catch (err) {
                                    setError("Failed to regenerate lesson. Please try again.");
                                    setState('home');
                                  }
                                }
                              }}
                            >
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600 font-bold">
                                  {idx + 1}
                                </div>
                                <div>
                                  <h4 className="font-bold text-slate-800 group-hover:text-amber-600 transition-colors">
                                    {item.data.title}
                                  </h4>
                                  <div className="flex items-center gap-2 mt-1">
                                    <div className="flex gap-0.5">
                                      {Array.from({ length: 7 }).map((_, i) => (
                                        <Star 
                                          key={i} 
                                          className={`w-3 h-3 ${i < progress.level - 1 ? 'text-amber-500 fill-amber-500' : i === progress.level - 1 ? 'text-amber-500' : 'text-slate-200'}`} 
                                        />
                                      ))}
                                    </div>
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                      Level {progress.level} / 7
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <Play className="w-6 h-6 text-slate-300 group-hover:text-amber-500 transition-colors" />
                            </motion.div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {state === 'upload' && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <button 
                onClick={() => setState('home')}
                className="flex items-center gap-2 text-slate-500 font-bold hover:text-emerald-600 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
                BACK TO PATH
              </button>
              <div className="text-center space-y-4">
                <h2 className="text-3xl font-bold text-slate-800">
                  {selectedUnit ? `Unit ${selectedUnit.id}: ${selectedUnit.title}` : 'Learn from your own content'}
                </h2>
                <p className="text-slate-500 text-lg">Choose a mode and upload a PDF to start.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setMode('quiz')}
                  className={`p-6 rounded-3xl border-2 transition-all flex flex-col items-center gap-3 ${mode === 'quiz' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-100 hover:border-slate-200'}`}
                >
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${mode === 'quiz' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                    <MessageSquare className="w-6 h-6" />
                  </div>
                  <span className={`font-bold ${mode === 'quiz' ? 'text-emerald-700' : 'text-slate-500'}`}>Quiz Mode</span>
                </button>
                <button
                  onClick={() => setMode('story')}
                  className={`p-6 rounded-3xl border-2 transition-all flex flex-col items-center gap-3 ${mode === 'story' ? 'border-sky-500 bg-sky-50' : 'border-slate-100 hover:border-slate-200'}`}
                >
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${mode === 'story' ? 'bg-sky-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <span className={`font-bold ${mode === 'story' ? 'text-sky-700' : 'text-slate-500'}`}>Story Mode</span>
                </button>
              </div>

              <div 
                {...getRootProps()} 
                className={`
                  border-4 border-dashed rounded-3xl p-12 text-center cursor-pointer transition-all
                  ${isDragActive ? 'border-emerald-500 bg-emerald-50 scale-105' : 'border-slate-200 hover:border-emerald-300 hover:bg-slate-50'}
                `}
              >
                <input {...getInputProps()} />
                <div className="flex flex-col items-center gap-4">
                  <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                    <Upload className="w-10 h-10" />
                  </div>
                  <div>
                    <p className="text-xl font-semibold text-slate-700">
                      {isDragActive ? 'Drop your PDFs here' : 'Click or drag up to 20 PDFs here'}
                    </p>
                    <p className="text-slate-400 mt-1">Study guides, articles, or books</p>
                  </div>
                </div>
              </div>

              {error && (
                <div className="p-4 bg-red-50 text-red-600 rounded-2xl flex items-center gap-3 border border-red-100">
                  <XCircle className="w-5 h-5" />
                  <p className="font-medium">{error}</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-8">
                {[
                  { icon: FileText, title: 'Upload PDF', desc: 'Any language works' },
                  { icon: Loader2, title: 'AI Processing', desc: 'Instant quiz generation' },
                  { icon: Trophy, title: 'Master It', desc: 'Track your progress' },
                ].map((item, i) => (
                  <div key={i} className="p-6 bg-slate-50 rounded-2xl space-y-2 border border-slate-100">
                    <item.icon className="w-6 h-6 text-emerald-500" />
                    <h3 className="font-bold text-slate-800">{item.title}</h3>
                    <p className="text-sm text-slate-500">{item.desc}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {state === 'loading' && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20 space-y-8"
            >
              <div className="relative">
                <div className="w-24 h-24 border-8 border-slate-100 border-t-emerald-500 rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <FileText className="w-8 h-8 text-emerald-500" />
                </div>
              </div>
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold text-slate-800">
                  Creating {mode} {loadingProgress.current} of {loadingProgress.total}...
                </h2>
                <p className="text-slate-500 animate-pulse">Our AI is reading your PDF and crafting questions.</p>
                <div className="w-full max-w-xs bg-slate-100 h-2 rounded-full overflow-hidden mt-4">
                  <motion.div 
                    className="h-full bg-emerald-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${(loadingProgress.current / loadingProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            </motion.div>
          )}

          {state === 'quiz' && quiz && (
            <motion.div
              key="quiz"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="space-y-8"
            >
              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm font-bold text-slate-400 uppercase tracking-wider">
                  <span>Question {currentQuestionIndex + 1} of {quiz.questions.length}</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <div className="h-4 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-emerald-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ type: 'spring', stiffness: 50 }}
                  />
                </div>
              </div>

              {/* Question */}
              <div className="space-y-6">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest ${
                    quiz.questions[currentQuestionIndex].type === 'fill_in_blank' ? 'bg-orange-100 text-orange-600' :
                    quiz.questions[currentQuestionIndex].type === 'true_false' ? 'bg-sky-100 text-sky-600' :
                    'bg-emerald-100 text-emerald-600'
                  }`}>
                    {quiz.questions[currentQuestionIndex].type?.replace('_', ' ') || 'Question'}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <h2 className="text-2xl font-bold text-slate-800 leading-tight flex-1">
                    {currentQuestionIndex + 1}. {quiz.questions[currentQuestionIndex].question}
                  </h2>
                  <button
                    onClick={() => playPronunciation(quiz.questions[currentQuestionIndex].question)}
                    disabled={isSpeaking !== null}
                    className={`p-3 rounded-xl transition-all flex-shrink-0 ${isSpeaking === quiz.questions[currentQuestionIndex].question ? 'bg-emerald-100 text-emerald-600 animate-pulse' : 'bg-slate-100 text-slate-400 hover:bg-emerald-50 hover:text-emerald-500'}`}
                  >
                    <Volume2 className="w-6 h-6" />
                  </button>
                </div>

                <div className={`
                  grid gap-3 
                  ${quiz.questions[currentQuestionIndex].type === 'true_false' ? 'grid-cols-2' : 
                    quiz.questions[currentQuestionIndex].type === 'image_choice' ? 'grid-cols-2' : 'grid-cols-1'}
                `}>
                  {quiz.questions[currentQuestionIndex].options.map((option, idx) => {
                    const isSelected = selectedOption === option;
                    const isCorrect = isAnswered && option === quiz.questions[currentQuestionIndex].correctAnswer;
                    const isWrong = isAnswered && isSelected && option !== quiz.questions[currentQuestionIndex].correctAnswer;
                    const isImageChoice = quiz.questions[currentQuestionIndex].type === 'image_choice';

                    return (
                      <button
                        key={idx}
                        onClick={() => handleOptionSelect(option)}
                        disabled={isAnswered}
                        className={`
                          p-5 text-left rounded-2xl border-2 transition-all text-lg font-medium relative group
                          ${isSelected && !isAnswered ? 'border-sky-400 bg-sky-50 text-sky-700 shadow-md' : ''}
                          ${isCorrect ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : ''}
                          ${isWrong ? 'border-red-500 bg-red-50 text-red-700' : ''}
                          ${!isSelected && !isAnswered ? 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-600' : ''}
                          ${isAnswered && !isSelected && !isCorrect ? 'opacity-50 border-slate-100' : ''}
                          ${isImageChoice ? 'flex flex-col items-center gap-4 text-center' : ''}
                        `}
                      >
                        {isImageChoice && (
                          <div className="w-full aspect-video rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
                            <img 
                              src={`https://picsum.photos/seed/${encodeURIComponent(option)}/400/300`} 
                              alt={option}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        )}
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-3">
                            <span className={`
                              w-6 h-6 rounded-md border flex items-center justify-center text-xs font-bold transition-colors
                              ${isSelected ? 'bg-sky-500 border-sky-500 text-white' : 'border-slate-200 text-slate-400 group-hover:border-sky-300 group-hover:text-sky-500'}
                              ${isCorrect ? 'bg-emerald-500 border-emerald-500 text-white' : ''}
                              ${isWrong ? 'bg-red-500 border-red-500 text-white' : ''}
                            `}>
                              {idx + 1}
                            </span>
                            <span className="font-bold text-slate-400">{String.fromCharCode(65 + idx)}.</span>
                            <span>{option}</span>
                          </div>
                          {isCorrect && <CheckCircle2 className="w-6 h-6 text-emerald-500" />}
                          {isWrong && <XCircle className="w-6 h-6 text-red-500" />}
                        </div>
                        <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl ${isSelected ? 'bg-sky-400' : 'bg-transparent'}`} />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Feedback Footer */}
              <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 p-6 z-20">
                <div className="max-w-2xl mx-auto flex items-center justify-between">
                  <div className="flex-1">
                    {isAnswered && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex items-center gap-3 ${selectedOption === quiz.questions[currentQuestionIndex].correctAnswer ? 'text-emerald-600' : 'text-red-600'}`}
                      >
                        {selectedOption === quiz.questions[currentQuestionIndex].correctAnswer ? (
                          <>
                            <CheckCircle2 className="w-8 h-8" />
                            <div>
                              <p className="font-bold text-xl">Excellent!</p>
                              <p className="text-sm opacity-80">{quiz.questions[currentQuestionIndex].explanation}</p>
                            </div>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-8 h-8" />
                            <div>
                              <p className="font-bold text-xl">Correct solution:</p>
                              <p className="font-medium">{quiz.questions[currentQuestionIndex].correctAnswer}</p>
                              <p className="text-sm opacity-80 mt-1">{quiz.questions[currentQuestionIndex].explanation}</p>
                            </div>
                          </>
                        )}
                      </motion.div>
                    )}
                  </div>
                  
                  {!isAnswered ? (
                    <button
                      onClick={handleCheckAnswer}
                      disabled={!selectedOption}
                      className={`
                        px-12 py-4 rounded-2xl font-bold text-lg transition-all shadow-lg
                        ${selectedOption 
                          ? 'bg-emerald-500 text-white hover:bg-emerald-600 active:scale-95 shadow-emerald-200' 
                          : 'bg-slate-200 text-slate-400 cursor-not-allowed'}
                      `}
                    >
                      CHECK
                    </button>
                  ) : (
                    <button
                      onClick={handleNextQuestion}
                      className={`
                        px-12 py-4 rounded-2xl font-bold text-lg transition-all shadow-lg text-white active:scale-95
                        ${selectedOption === quiz.questions[currentQuestionIndex].correctAnswer 
                          ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-200' 
                          : 'bg-red-500 hover:bg-red-600 shadow-red-200'}
                      `}
                    >
                      CONTINUE
                    </button>
                  )}
                </div>
              </div>
              {/* Spacer for fixed footer */}
              <div className="h-32" />
            </motion.div>
          )}

          {state === 'special_lesson' && specialLesson && (
            <motion.div
              key="special_lesson"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="space-y-8"
            >
              {/* Header with Level Info */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-amber-200">
                    <Zap className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-800">{specialLesson.title}</h2>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 7 }).map((_, i) => (
                        <Star 
                          key={i} 
                          className={`w-4 h-4 ${i < specialLesson.level - 1 ? 'text-amber-500 fill-amber-500' : i === specialLesson.level - 1 ? 'text-amber-500' : 'text-slate-200'}`} 
                        />
                      ))}
                      <span className="text-xs font-bold text-amber-600 ml-1">Level {specialLesson.level}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Mastery Progress</p>
                  <p className="text-lg font-black text-amber-500">{Math.round(((currentQuestionIndex + 1) / specialLesson.questions.length) * 100)}%</p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="h-4 bg-slate-100 rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-amber-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${((currentQuestionIndex + 1) / specialLesson.questions.length) * 100}%` }}
                  transition={{ type: 'spring', stiffness: 50 }}
                />
              </div>

              {/* Question */}
              <div className="space-y-6">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest ${
                    specialLesson.questions[currentQuestionIndex].type === 'fill_in_blank' ? 'bg-orange-100 text-orange-600' :
                    specialLesson.questions[currentQuestionIndex].type === 'true_false' ? 'bg-sky-100 text-sky-600' :
                    'bg-amber-100 text-amber-600'
                  }`}>
                    {specialLesson.questions[currentQuestionIndex].type?.replace('_', ' ') || 'Question'}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <h2 className="text-2xl font-bold text-slate-800 leading-tight flex-1">
                    {currentQuestionIndex + 1}. {specialLesson.questions[currentQuestionIndex].question}
                  </h2>
                  <button
                    onClick={() => playPronunciation(specialLesson.questions[currentQuestionIndex].question)}
                    disabled={isSpeaking !== null}
                    className={`p-3 rounded-xl transition-all flex-shrink-0 ${isSpeaking === specialLesson.questions[currentQuestionIndex].question ? 'bg-amber-100 text-amber-600 animate-pulse' : 'bg-slate-100 text-slate-400 hover:bg-amber-50 hover:text-amber-500'}`}
                  >
                    <Volume2 className="w-6 h-6" />
                  </button>
                </div>

                <div className={`
                  grid gap-3 
                  ${specialLesson.questions[currentQuestionIndex].type === 'true_false' ? 'grid-cols-2' : 
                    specialLesson.questions[currentQuestionIndex].type === 'image_choice' ? 'grid-cols-2' : 'grid-cols-1'}
                `}>
                  {specialLesson.questions[currentQuestionIndex].options.map((option, idx) => {
                    const isSelected = selectedOption === option;
                    const isCorrect = isAnswered && option === specialLesson.questions[currentQuestionIndex].correctAnswer;
                    const isWrong = isAnswered && isSelected && option !== specialLesson.questions[currentQuestionIndex].correctAnswer;
                    const isImageChoice = specialLesson.questions[currentQuestionIndex].type === 'image_choice';

                    return (
                      <button
                        key={idx}
                        onClick={() => handleOptionSelect(option)}
                        disabled={isAnswered}
                        className={`
                          p-5 text-left rounded-2xl border-2 transition-all text-lg font-medium relative group
                          ${isSelected && !isAnswered ? 'border-amber-400 bg-amber-50 text-amber-700 shadow-md' : ''}
                          ${isCorrect ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : ''}
                          ${isWrong ? 'border-red-500 bg-red-50 text-red-700' : ''}
                          ${!isSelected && !isAnswered ? 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-600' : ''}
                          ${isAnswered && !isSelected && !isCorrect ? 'opacity-50 border-slate-100' : ''}
                          ${isImageChoice ? 'flex flex-col items-center gap-4 text-center' : ''}
                        `}
                      >
                        {isImageChoice && (
                          <div className="w-full aspect-video rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
                            <img 
                              src={`https://picsum.photos/seed/${encodeURIComponent(option)}/400/300`} 
                              alt={option}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        )}
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-3">
                            <span className={`
                              w-6 h-6 rounded-md border flex items-center justify-center text-xs font-bold transition-colors
                              ${isSelected ? 'bg-amber-500 border-amber-500 text-white' : 'border-slate-200 text-slate-400 group-hover:border-amber-300 group-hover:text-amber-500'}
                              ${isCorrect ? 'bg-emerald-500 border-emerald-500 text-white' : ''}
                              ${isWrong ? 'bg-red-500 border-red-500 text-white' : ''}
                            `}>
                              {idx + 1}
                            </span>
                            <span className="font-bold text-slate-400">{String.fromCharCode(65 + idx)}.</span>
                            <span>{option}</span>
                          </div>
                          {isCorrect && <CheckCircle2 className="w-6 h-6 text-emerald-500" />}
                          {isWrong && <XCircle className="w-6 h-6 text-red-500" />}
                        </div>
                        <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl ${isSelected ? 'bg-amber-400' : 'bg-transparent'}`} />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Feedback Footer */}
              <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 p-6 z-20">
                <div className="max-w-2xl mx-auto flex items-center justify-between">
                  <div className="flex-1">
                    {isAnswered && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex items-center gap-3 ${selectedOption === specialLesson.questions[currentQuestionIndex].correctAnswer ? 'text-emerald-600' : 'text-red-600'}`}
                      >
                        {selectedOption === specialLesson.questions[currentQuestionIndex].correctAnswer ? (
                          <>
                            <CheckCircle2 className="w-8 h-8" />
                            <div>
                              <p className="font-bold text-xl">Masterful!</p>
                              <p className="text-sm opacity-80">{specialLesson.questions[currentQuestionIndex].explanation}</p>
                            </div>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-8 h-8" />
                            <div>
                              <p className="font-bold text-xl">Keep learning:</p>
                              <p className="font-medium">{specialLesson.questions[currentQuestionIndex].correctAnswer}</p>
                              <p className="text-sm opacity-80 mt-1">{specialLesson.questions[currentQuestionIndex].explanation}</p>
                            </div>
                          </>
                        )}
                      </motion.div>
                    )}
                  </div>
                  
                  {!isAnswered ? (
                    <button
                      onClick={handleCheckAnswer}
                      disabled={!selectedOption}
                      className={`
                        px-12 py-4 rounded-2xl font-bold text-lg transition-all shadow-lg
                        ${selectedOption 
                          ? 'bg-amber-500 text-white hover:bg-amber-600 active:scale-95 shadow-amber-200' 
                          : 'bg-slate-200 text-slate-400 cursor-not-allowed'}
                      `}
                    >
                      CHECK
                    </button>
                  ) : (
                    <button
                      onClick={handleNextQuestion}
                      className={`
                        px-12 py-4 rounded-2xl font-bold text-lg transition-all shadow-lg text-white active:scale-95
                        ${selectedOption === specialLesson.questions[currentQuestionIndex].correctAnswer 
                          ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-200' 
                          : 'bg-red-500 hover:bg-red-600 shadow-red-200'}
                      `}
                    >
                      CONTINUE
                    </button>
                  )}
                </div>
              </div>
              {/* Spacer for fixed footer */}
              <div className="h-32" />
            </motion.div>
          )}

          {state === 'story' && story && (
            <motion.div
              key="story"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-8 pb-32"
            >
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold text-slate-800">{story.title}</h2>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-sky-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${(visibleLines / story.lines.length) * 100}%` }}
                  />
                </div>
              </div>

              {/* Characters Section */}
              {story.characters && story.characters.length > 0 && visibleLines === 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 bg-sky-100 rounded-lg flex items-center justify-center">
                      <BookOpen className="w-4 h-4 text-sky-600" />
                    </div>
                    <h3 className="font-bold text-slate-800 uppercase tracking-wider text-sm">Meet the Characters</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {story.characters.map((char, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shrink-0 ${char.role === 'major' ? 'bg-sky-500' : 'bg-slate-400'}`}>
                          {char.name[0]}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-slate-800">{char.name}</p>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase ${char.role === 'major' ? 'bg-sky-100 text-sky-600' : 'bg-slate-200 text-slate-500'}`}>
                              {char.role === 'major' ? 'Lead' : 'Guest'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 line-clamp-2">{char.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={handleNextLine}
                    className="w-full py-3 bg-sky-500 text-white rounded-2xl font-bold hover:bg-sky-600 transition-colors"
                  >
                    START STORY
                  </button>
                </motion.div>
              )}

              <div className="space-y-6">
                {story.lines.slice(0, visibleLines).map((line, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: idx % 2 === 0 ? -20 : 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`flex flex-col ${idx % 2 === 0 ? 'items-start' : 'items-end'}`}
                  >
                    <div className={`max-w-[80%] p-4 rounded-2xl shadow-sm border ${idx % 2 === 0 ? 'bg-white border-slate-100 rounded-bl-none' : 'bg-sky-50 border-sky-100 rounded-br-none'}`}>
                      <div className="flex items-center justify-between gap-4 mb-1">
                        <p className="text-xs font-bold text-slate-400 uppercase">{line.character}</p>
                        <button
                          onClick={() => playPronunciation(line.text)}
                          disabled={isSpeaking !== null}
                          className={`p-1.5 rounded-lg transition-all ${isSpeaking === line.text ? 'bg-sky-200 text-sky-700 animate-pulse' : 'text-slate-300 hover:bg-sky-100 hover:text-sky-500'}`}
                        >
                          <Volume2 className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-lg font-medium text-slate-800">{line.text}</p>
                      <p className="text-sm text-slate-400 italic mt-1">{line.translation}</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Question Overlay */}
              {story.questions.find(q => q.lineIndex === visibleLines - 1) && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-6 bg-white border-2 border-sky-200 rounded-3xl shadow-xl space-y-6"
                >
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest ${
                      story.questions.find(q => q.lineIndex === visibleLines - 1)?.type === 'fill_in_blank' ? 'bg-orange-100 text-orange-600' :
                      story.questions.find(q => q.lineIndex === visibleLines - 1)?.type === 'true_false' ? 'bg-sky-100 text-sky-600' :
                      'bg-emerald-100 text-emerald-600'
                    }`}>
                      {story.questions.find(q => q.lineIndex === visibleLines - 1)?.type?.replace('_', ' ') || 'Question'}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-800">
                    {story.questions.filter((q, i) => q.lineIndex < visibleLines).length}. {story.questions.find(q => q.lineIndex === visibleLines - 1)?.question}
                  </h3>
                  <div className={`grid gap-3 ${story.questions.find(q => q.lineIndex === visibleLines - 1)?.type === 'true_false' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    {story.questions.find(q => q.lineIndex === visibleLines - 1)?.options.map((option, idx) => {
                      const currentQ = story.questions.find(q => q.lineIndex === visibleLines - 1);
                      const isSelected = selectedOption === option;
                      const isCorrect = isAnswered && option === currentQ?.correctAnswer;
                      const isWrong = isAnswered && isSelected && option !== currentQ?.correctAnswer;

                      return (
                        <button
                          key={idx}
                          onClick={() => handleOptionSelect(option)}
                          disabled={isAnswered}
                          className={`
                            p-4 text-left rounded-xl border-2 transition-all font-medium flex items-center gap-3 group
                            ${isSelected && !isAnswered ? 'border-sky-400 bg-sky-50' : ''}
                            ${isCorrect ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : ''}
                            ${isWrong ? 'border-red-500 bg-red-50 text-red-700' : ''}
                            ${!isSelected && !isAnswered ? 'border-slate-100 hover:border-slate-200' : ''}
                          `}
                        >
                          <span className={`
                            w-6 h-6 rounded-md border flex items-center justify-center text-xs font-bold transition-colors
                            ${isSelected ? 'bg-sky-500 border-sky-500 text-white' : 'border-slate-200 text-slate-400 group-hover:border-sky-300 group-hover:text-sky-500'}
                            ${isCorrect ? 'bg-emerald-500 border-emerald-500 text-white' : ''}
                            ${isWrong ? 'bg-red-500 border-red-500 text-white' : ''}
                          `}>
                            {idx + 1}
                          </span>
                          <span className="font-bold text-slate-400">{String.fromCharCode(65 + idx)}.</span>
                          {option}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 p-6 z-20">
                <div className="max-w-2xl mx-auto flex items-center justify-between">
                  <div className="flex-1">
                    {isAnswered && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-3"
                      >
                        {selectedOption === story.questions.find(q => q.lineIndex === visibleLines - 1)?.correctAnswer ? (
                          <div className="text-emerald-600">
                            <p className="font-bold">Correct!</p>
                            <p className="text-xs">{story.questions.find(q => q.lineIndex === visibleLines - 1)?.explanation}</p>
                          </div>
                        ) : (
                          <div className="text-red-600">
                            <p className="font-bold">Oops!</p>
                            <p className="text-xs">Correct: {story.questions.find(q => q.lineIndex === visibleLines - 1)?.correctAnswer}</p>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </div>

                  {story.questions.find(q => q.lineIndex === visibleLines - 1) ? (
                    !isAnswered ? (
                      <button
                        onClick={handleCheckAnswer}
                        disabled={!selectedOption}
                        className="px-12 py-4 bg-sky-500 text-white rounded-2xl font-bold disabled:bg-slate-200"
                      >
                        CHECK
                      </button>
                    ) : (
                      <button
                        onClick={handleNextQuestion}
                        className="px-12 py-4 bg-sky-500 text-white rounded-2xl font-bold"
                      >
                        CONTINUE
                      </button>
                    )
                  ) : (
                    <button
                      onClick={handleNextLine}
                      className="px-12 py-4 bg-sky-500 text-white rounded-2xl font-bold flex items-center gap-2"
                    >
                      {visibleLines === story.lines.length ? 'FINISH' : 'NEXT'}
                      <ArrowRight className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {state === 'result' && (quiz || story || specialLesson) && (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-8 py-12"
            >
              <div className="relative inline-block">
                <div className={`w-48 h-48 rounded-full flex items-center justify-center mx-auto ${state === 'special_lesson' ? 'bg-amber-100' : 'bg-emerald-100'}`}>
                  <Trophy className={`w-24 h-24 ${state === 'special_lesson' ? 'text-amber-500' : 'text-emerald-500'}`} />
                </div>
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.5, type: 'spring' }}
                  className="absolute -top-4 -right-4 w-16 h-16 bg-yellow-400 rounded-full border-4 border-white flex items-center justify-center text-white font-bold text-xl shadow-lg"
                >
                  {Math.round((score / (quiz?.questions.length || story?.questions.length || specialLesson?.questions.length || 1)) * 100)}%
                </motion.div>
              </div>

              <div className="space-y-2">
                <h2 className="text-4xl font-black text-slate-800 uppercase tracking-tight">
                  {state === 'special_lesson' ? 'Mastery Level Complete!' : 'Lesson Complete!'}
                </h2>
                <p className="text-xl text-slate-500">
                  You scored {score} out of {quiz?.questions.length || story?.questions.length || specialLesson?.questions.length} correct.
                </p>
                {state === 'special_lesson' && activeSpecialLessonId && (
                  <div className="mt-4 p-4 bg-amber-50 rounded-2xl border border-amber-100 inline-block">
                    <p className="text-amber-800 font-bold">
                      {(score / (specialLesson?.questions.length || 1)) >= 0.8 
                        ? (userProgress.specialLessons[activeSpecialLessonId]?.level === 7 
                            ? "You've reached maximum mastery!" 
                            : `Level Up! Next: Level ${userProgress.specialLessons[activeSpecialLessonId]?.level}`)
                        : "Keep practicing to reach the next level!"}
                    </p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto">
                <div className={`p-6 rounded-3xl border ${state === 'special_lesson' ? 'bg-amber-50 border-amber-100' : 'bg-emerald-50 border-emerald-100'}`}>
                  <p className={`font-bold text-3xl ${state === 'special_lesson' ? 'text-amber-600' : 'text-emerald-600'}`}>{score}</p>
                  <p className={`${state === 'special_lesson' ? 'text-amber-800' : 'text-emerald-800'} text-sm font-medium uppercase tracking-wider`}>Correct</p>
                </div>
                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                  <p className="text-slate-600 font-bold text-3xl">
                    {(quiz?.questions.length || story?.questions.length || specialLesson?.questions.length || 0) - score}
                  </p>
                  <p className="text-slate-800 text-sm font-medium uppercase tracking-wider">Missed</p>
                </div>
              </div>

              <div className="flex flex-col gap-4 max-w-sm mx-auto pt-8">
                {((mode === 'quiz' && currentQueueIndex < quizQueue.length - 1) || 
                  (mode === 'story' && currentQueueIndex < storyQueue.length - 1)) ? (
                  <button
                    onClick={handleNextQueueItem}
                    className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-bold text-xl shadow-lg shadow-emerald-200 hover:bg-emerald-600 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    NEXT {mode.toUpperCase()} ({currentQueueIndex + 2}/{mode === 'quiz' ? quizQueue.length : storyQueue.length})
                    <ArrowRight className="w-6 h-6" />
                  </button>
                ) : (
                  <button
                    onClick={resetQuiz}
                    className={`w-full py-4 text-white rounded-2xl font-bold text-xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 ${state === 'special_lesson' ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-200' : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-200'}`}
                  >
                    <RotateCcw className="w-6 h-6" />
                    {state === 'special_lesson' ? 'BACK TO MASTERY' : 'FINISH ALL'}
                  </button>
                )}
                <button
                  onClick={() => {
                    setCurrentQuestionIndex(0);
                    setSelectedOption(null);
                    setIsAnswered(false);
                    setScore(0);
                    setState(state === 'special_lesson' ? 'special_lesson' : mode);
                  }}
                  className={`w-full py-4 bg-white border-2 rounded-2xl font-bold text-xl active:scale-95 transition-all ${state === 'special_lesson' ? 'text-amber-500 border-amber-500 hover:bg-amber-50' : 'text-emerald-500 border-emerald-500 hover:bg-emerald-50'}`}
                >
                  REVIEW THIS {state === 'special_lesson' ? 'MASTERY' : mode.toUpperCase()}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
