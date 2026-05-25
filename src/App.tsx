import React, { useState, useEffect, useRef } from "react";
import { onAuthStateChanged, signInWithPopup, signOut, User } from "firebase/auth";
import { collection, query, where, orderBy, getDocs, doc, setDoc, deleteDoc, Timestamp, serverTimestamp } from "firebase/firestore";
import { auth, db, googleProvider, handleFirestoreError, OperationType } from "./lib/firebase";
import { Quiz, Performance, Question } from "./types";
import PracticeMode from "./components/PracticeMode";
import ExamMode from "./components/ExamMode";
import ResultsDashboard from "./components/ResultsDashboard";
import QuizHistory from "./components/QuizHistory";
import { 
  FileUp, 
  HelpCircle, 
  CheckCircle, 
  LogOut, 
  LogIn, 
  BookOpen, 
  FileText, 
  Sparkles, 
  Video, 
  Info, 
  X, 
  AlertTriangle 
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// Preloaded Demo Quiz so unauthenticated or guest users can try out the portal immediately
const COMPREHENSIVE_DEMO_QUIZ: Quiz = {
  id: "demo-astronomy-assessment",
  userId: "demo-guest",
  title: "Astrobiology & Lunar Geology (Demo Test)",
  questions: [
    {
      id: "demo-q1",
      question_text: "Which of the following lunar geological features is primarily composed of dark mare basalt arising from ancient impact-triggered volcanic eruptions?",
      options: [
        "Lunar Highlands (Terrae)",
        "Lunar Maria (Plains)",
        "Anorthositic Slopes",
        "Impact Crater Ejecta blankets"
      ],
      correct_option_index: 1,
      explanation: "Lunar Maria are flat plains of basaltic lava flows on the moon. They are dark due to volcanic rich iron-magnesium contents, formed billions of years ago when massive impacts cracked the crust and released magma from the mantle."
    },
    {
      id: "demo-q2",
      question_text: "What makes carbon and liquid water uniquely well-suited Astrobiological standards for chemical life cycles?",
      options: [
        "Carbon can only form single ionic bonds",
        "Liquid water has an extremely low heat capacity and dipole structure",
        "Carbon forms diverse, stable tetravalent organic chains while water serves as an excellent polar solvent",
        "Water remains entirely frozen across most atmospheric density brackets"
      ],
      correct_option_index: 2,
      explanation: "Carbon's configuration permits it to form four covalent bonds, yielding intricate molecular structures (proteins, lipids). Water's high dipole moment enables it to dissolve polar biomolecules while acting as a stable thermal buffer."
    },
    {
      id: "demo-q3",
      question_text: "In planetary geology, what does the presence of anorthosite rock in the Lunar Highlands indicate?",
      options: [
        "The Moon was once covered in liquid carbon dioxide ice",
        "Early crystallization of feldspar from a primordial Lunar Magma Ocean",
        "Massive, continuous iron meteor landings over 100 million years ago",
        "Recent active water erosion on volcanic ridges"
      ],
      correct_option_index: 1,
      explanation: "The white, heavily cratered Lunar Highlands consist of anorthosite rock. Geologists interpret this as early crystallization products of an anorthite-rich feldspar that floated to the surface of a deep, primordial Moon magma ocean."
    }
  ],
  createdAt: new Date()
};

export default function App() {
  // State definitions
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [errorAlert, setErrorAlert] = useState<string | null>(null);
  const [infoPopup, setInfoPopup] = useState(true);

  // Dynamic lists from Firestore
  const [quizzes, setQuizzes] = useState<Quiz[]>([COMPREHENSIVE_DEMO_QUIZ]);
  const [performances, setPerformances] = useState<Performance[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Flow navigation control states
  const [view, setView] = useState<"hub" | "practice" | "exam" | "results">("hub");
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [activeScore, setActiveScore] = useState(0);
  const [activeMode, setActiveMode] = useState<"practice" | "exam">("practice");
  const [activeTimeTaken, setActiveTimeTaken] = useState(0);
  const [userAnswersLog, setUserAnswersLog] = useState<Record<string | number, number>>({});

  // File reference
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auth observer initialization
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (loggedUser) => {
      setUser(loggedUser);
      setAuthLoading(false);
      if (loggedUser) {
        fetchUserData(loggedUser.uid);
      } else {
        // Fall back to just the preloaded demo quiz for safe clean view
        setQuizzes([COMPREHENSIVE_DEMO_QUIZ]);
        setPerformances([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // Sync firestore queries on success login
  const fetchUserData = async (uid: string) => {
    setIsLoadingHistory(true);
    try {
      // 1. Load Quizzes
      const quizzesRef = collection(db, "quizzes");
      const qQuizzes = query(quizzesRef, where("userId", "==", uid));
      const qSnap = await getDocs(qQuizzes);
      
      const parsedQuizzes: Quiz[] = qSnap.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          userId: d.userId,
          title: d.title,
          questions: d.questions as Question[],
          createdAt: d.createdAt,
        };
      });

      // Always prepend the interactive demonstration quiz for the best user onboarding experience
      setQuizzes([COMPREHENSIVE_DEMO_QUIZ, ...parsedQuizzes]);

      // 2. Load Performances
      const perfRef = collection(db, "performances");
      const qPerf = query(perfRef, where("userId", "==", uid));
      const pSnap = await getDocs(qPerf);
      const parsedPerformances: Performance[] = pSnap.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          userId: d.userId,
          quizId: d.quizId,
          quizTitle: d.quizTitle,
          score: d.score,
          totalQuestions: d.totalQuestions,
          mode: d.mode,
          timeTaken: d.timeTaken,
          createdAt: d.createdAt,
        };
      }).sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds);

      setPerformances(parsedPerformances);

    } catch (error) {
      console.error("Error loading user data:", error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Google Single Sign-In popup with security exception catch
  const handleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      setErrorAlert(null);
    } catch (err: any) {
      console.error("Login Error:", err);
      setErrorAlert(err.message || "Failed to establish Google login flow.");
    }
  };

  // Sign out
  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setView("hub");
      setActiveQuiz(null);
    } catch (err: any) {
      console.error("Sign Out Error:", err);
    }
  };

  // File Drop Handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  // File Upload, Read As Data URL, and backend API transmission pipeline
  const processFile = async (file: File) => {
    // Validate only PDFs
    if (file.type !== "application/pdf" && !file.name.endsWith(".pdf")) {
      setErrorAlert("Invalid file format. Please upload standard .pdf files only.");
      return;
    }

    // Limit to 20MB to prevent timeouts or memory fatigue
    const maxBytes = 20 * 1024 * 1024;
    if (file.size > maxBytes) {
      setErrorAlert("File is too large. Maximum size is 20MB.");
      return;
    }

    if (!user) {
      setErrorAlert("Authentication required. Please sign in with Google in the upper right corner to save quizzes to your Cloud database.");
      return;
    }

    setErrorAlert(null);
    setIsUploading(true);
    setUploadProgressText("Reading file from disk...");

    try {
      const reader = new FileReader();
      
      // Promisified file reader loop
      const readPromise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("File conversion errored."));
        reader.readAsDataURL(file);
      });

      const base64WithHeader = await readPromise;
      setUploadProgressText("Structuring document & generating questions with gemini-2.5-flash...");

      // Send to Express API endpoint (server proxies request to Gemini with secret API Key securely)
      const response = await fetch("/api/generate-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pdfBase64: base64WithHeader,
          fileName: file.name
        })
      });

      if (!response.ok) {
        const errPayload = await response.json();
        throw new Error(errPayload.error || "Server could not process PDF text properly.");
      }

      const generatedQuizRes = await response.json();
      setUploadProgressText("Saving quiz to cloud Firestore...");

      // Write parsed quiz document to Firestore securely
      const quizId = "quiz-" + Date.now().toString() + "-" + Math.random().toString(36).substr(2, 5);
      const newQuizData = {
        userId: user.uid,
        title: generatedQuizRes.quiz_title || file.name.replace(/\.[^/.]+$/, ""),
        questions: generatedQuizRes.questions,
        createdAt: new Date(), // Local fallback date
      };

      try {
        const docRef = doc(db, "quizzes", quizId);
        // Securely write using matching blueprint
        await setDoc(docRef, {
          userId: user.uid,
          title: newQuizData.title,
          questions: newQuizData.questions,
          createdAt: serverTimestamp() // Firestore Server Timestamp
        });
      } catch (fErr) {
        handleFirestoreError(fErr, OperationType.WRITE, `quizzes/${quizId}`);
      }

      // Re-query database to show new list
      await fetchUserData(user.uid);
      setUploadProgressText("Quiz successfully created!");

    } catch (err: any) {
      console.error("PDF Processing Pipeline Error:", err);
      setErrorAlert(err.message || "An error occurred while generating the quiz schema.");
    } finally {
      setIsUploading(false);
    }
  };

  // Launch modes
  const handleStartQuiz = (quiz: Quiz, mode: "practice" | "exam") => {
    setActiveQuiz(quiz);
    setActiveMode(mode);
    setView(mode);
  };

  // Delete quiz
  const handleDeleteQuiz = async (quizId: string) => {
    if (quizId === COMPREHENSIVE_DEMO_QUIZ.id) {
      setErrorAlert("This is a built-in preloaded demonstration and cannot be deleted.");
      return;
    }
    if (!user) return;
    try {
      await deleteDoc(doc(db, "quizzes", quizId));
      await fetchUserData(user.uid);
    } catch (fErr) {
      handleFirestoreError(fErr, OperationType.DELETE, `quizzes/${quizId}`);
    }
  };

  // Practice session finished
  const handleFinishPractice = async (score: number) => {
    if (!activeQuiz) return;
    setActiveScore(score);
    setActiveTimeTaken(0); // Practice is self-paced
    setView("results");

    if (user && activeQuiz.id !== COMPREHENSIVE_DEMO_QUIZ.id) {
      const perfId = "perf-" + Date.now().toString();
      try {
        await setDoc(doc(db, "performances", perfId), {
          userId: user.uid,
          quizId: activeQuiz.id,
          quizTitle: activeQuiz.title,
          score,
          totalQuestions: activeQuiz.questions.length,
          mode: "practice",
          timeTaken: 0,
          createdAt: serverTimestamp()
        });
        await fetchUserData(user.uid);
      } catch (fErr) {
        handleFirestoreError(fErr, OperationType.WRITE, `performances/${perfId}`);
      }
    }
  };

  // Exam session finished (with answers review mapped)
  const handleFinishExam = async (score: number, timeTakenSeconds: number, answersMap: Record<string | number, number>) => {
    if (!activeQuiz) return;
    setActiveScore(score);
    setActiveTimeTaken(timeTakenSeconds);
    setUserAnswersLog(answersMap);
    setView("results");

    if (user && activeQuiz.id !== COMPREHENSIVE_DEMO_QUIZ.id) {
      const perfId = "perf-" + Date.now().toString();
      try {
        await setDoc(doc(db, "performances", perfId), {
          userId: user.uid,
          quizId: activeQuiz.id,
          quizTitle: activeQuiz.title,
          score,
          totalQuestions: activeQuiz.questions.length,
          mode: "exam",
          timeTaken: timeTakenSeconds,
          createdAt: serverTimestamp()
        });
        await fetchUserData(user.uid);
      } catch (fErr) {
        handleFirestoreError(fErr, OperationType.WRITE, `performances/${perfId}`);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-[#e0e0e0] flex flex-col font-sans selection:bg-[#F27D26]/35 selection:text-white" id="main-app">
      
      {/* Decorative Branding header */}
      <header className="bg-[#0a0a0a] border-b border-white/5 py-4 px-6 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#F27D26] rounded flex items-center justify-center font-bold text-black text-xl italic shrink-0" id="brand-logo-icon">
              M
            </div>
            <div>
              <h1 className="text-xl font-serif italic text-white leading-none tracking-tight">Insta Mocks</h1>
              <span className="text-[9px] font-bold font-mono text-[#F27D26] tracking-widest uppercase">Local File AI Quiz Generator</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {authLoading ? (
              <span className="text-xs text-white/40 font-mono">Syncing auth...</span>
            ) : user ? (
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex flex-col text-right">
                  <span className="text-xs font-bold text-white max-w-[150px] truncate">{user.displayName || user.email}</span>
                  <span className="text-[9px] font-mono font-bold text-[#F27D26]">CLOUD SYNC ENABLED</span>
                </div>
                {user.photoURL ? (
                  <img src={user.photoURL} alt="avatar" className="w-8 h-8 rounded-full border border-white/10" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center font-bold text-sm">
                    {user.email?.charAt(0).toUpperCase()}
                  </div>
                )}
                <button 
                  onClick={handleSignOut}
                  className="p-1.5 hover:bg-white/5 rounded-lg text-white/40 hover:text-white/80 transition"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={handleSignIn}
                className="inline-flex items-center gap-2 text-xs font-bold px-4 py-2 bg-white text-black hover:bg-[#F27D26] hover:text-black rounded-full cursor-pointer transition-colors duration-150 shadow-sm"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Connect Google Drive</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Core Body */}
      <main className="flex-1">

        {/* Global Floating Error Alert Panel */}
        {errorAlert && (
          <div className="bg-rose-950/20 border p-4 border-rose-900/35 flex justify-between items-start text-rose-200 font-light text-sm max-w-6xl mx-auto mt-6 rounded-2xl mx-4">
            <div className="flex gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              <span>{errorAlert}</span>
            </div>
            <button onClick={() => setErrorAlert(null)}>
              <X className="w-4 h-4 text-rose-400 hover:text-rose-200 shrink-0" />
            </button>
          </div>
        )}

        <AnimatePresence mode="wait">
          {view === "hub" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="py-8"
            >
              {/* Core Dashboard Pitch - PDF drag/drop parsing box */}
              <div className="max-w-6xl mx-auto px-4 mb-10">
                <div className="bg-[#0a0a0a] border border-white/5 text-[#e0e0e0] rounded-3xl p-6 md:p-10 shadow-xl relative overflow-hidden">
                  
                  {/* Subtle decorative glow */}
                  <div className="absolute top-0 right-0 w-80 h-80 rounded-full bg-[#F27D26]/5 blur-[120px] pointer-events-none" />
                  <div className="absolute bottom-0 left-10 w-60 h-60 rounded-full bg-[#F27D26]/5 blur-[100px] pointer-events-none" />

                  <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-center relative z-10">
                    
                    {/* Instructions and Description */}
                    <div className="lg:col-span-3">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#F27D26]/10 text-[#F27D26] rounded-full text-xs font-mono uppercase mb-4 border border-[#F27D26]/20">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Powered by gemini-2.5-flash</span>
                      </div>
                      <h2 className="text-2xl md:text-4xl font-serif italic text-white tracking-tight mb-4">
                        Convert PYQ PDFs into interactive Mock Exams
                      </h2>
                      <p className="text-white/60 text-sm md:text-base leading-relaxed font-light mb-6">
                        Upload your previous exam question papers, tests, or worksheets. Our AI parses and models complex multiple choice segments, delivering immediate feedback practice grids or strict timed test stimulators.
                      </p>

                      <div className="flex gap-6">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-[#F27D26]" />
                          <span className="text-xs text-white/40 font-mono tracking-wider">100% SECURE TUNNEL</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-[#F27D26]" />
                          <span className="text-xs text-white/40 font-mono tracking-wider">ZERO OVERHEAD</span>
                        </div>
                      </div>
                    </div>

                    {/* Parser Up Box */}
                    <div className="lg:col-span-2">
                      <div 
                        onDragEnter={handleDrag}
                        onDragOver={handleDrag}
                        onDragLeave={handleDrag}
                        onDrop={handleDrop}
                        className={`border rounded-2xl p-6 text-center transition-all flex flex-col items-center justify-center min-h-[220px] ${
                          dragActive 
                            ? "bg-[#F27D26]/10 border-[#F27D26]" 
                            : "bg-white/5 border-white/10 hover:border-white/20"
                        }`}
                      >
                        {isUploading ? (
                          <div className="text-center">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#F27D26] mx-auto mb-4" />
                            <p className="text-sm font-semibold mb-1 text-white font-mono">PARSING PDF DOCUMENT</p>
                            <p className="text-xs text-white/40">{uploadProgressText}</p>
                          </div>
                        ) : (
                          <>
                            <div className="w-12 h-12 rounded-xl bg-white/5 text-[#F27D26] flex items-center justify-center mb-4 border border-white/10">
                              <FileUp className="w-6 h-6" />
                            </div>
                            <h3 className="font-serif italic text-base text-white mb-1">
                              Drag and Drop PYQ PDF
                            </h3>
                            <p className="text-xs text-white/40 mb-4 max-w-xs leading-relaxed font-light">
                              Add standard examination files (up to 20MB)
                            </p>
                            
                            <button
                              onClick={() => fileInputRef.current?.click()}
                              className="px-6 py-2 bg-white hover:bg-[#F27D26] text-black font-bold text-xs rounded-full cursor-pointer transition-colors duration-150 shadow-sm"
                            >
                              Browse Local Files
                            </button>
                            <input 
                              type="file"
                              ref={fileInputRef}
                              onChange={handleFileChange}
                              accept=".pdf"
                              className="hidden"
                            />
                          </>
                        )}
                      </div>
                    </div>

                  </div>
                </div>
              </div>

              {/* Dynamic Quiz history directories & logs */}
              <QuizHistory 
                quizzes={quizzes}
                performances={performances}
                onStartQuiz={handleStartQuiz}
                onDeleteQuiz={handleDeleteQuiz}
                isLoading={isLoadingHistory}
              />
            </motion.div>
          )}

          {view === "practice" && activeQuiz && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <PracticeMode 
                questions={activeQuiz.questions}
                quizTitle={activeQuiz.title}
                onFinish={handleFinishPractice}
                onCancel={() => setView("hub")}
              />
            </motion.div>
          )}

          {view === "exam" && activeQuiz && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <ExamMode 
                questions={activeQuiz.questions}
                quizTitle={activeQuiz.title}
                onFinish={handleFinishExam}
                onCancel={() => setView("hub")}
              />
            </motion.div>
          )}

          {view === "results" && activeQuiz && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <ResultsDashboard 
                questions={activeQuiz.questions}
                score={activeScore}
                mode={activeMode}
                timeTakenSeconds={activeTimeTaken}
                userAnswers={userAnswersLog}
                onBackToQuizzes={() => {
                  setView("hub");
                  setActiveQuiz(null);
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>

      </main>

      {/* Decorative footer */}
      <footer className="border-t border-white/5 bg-[#0a0a0a] py-6 px-6 mt-auto">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="text-xs text-white/40 font-mono">
            &copy; 2026 Insta Mocks Portal • All rights reserved
          </div>
          <div className="flex gap-4 text-xs font-semibold text-white/40 font-mono">
            <span>Enterprise Edition v1.4</span>
            <span>•</span>
            <span className="text-[#F27D26] font-bold">Secure Cloud-native Sync</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
