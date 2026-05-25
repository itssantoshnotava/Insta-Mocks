import React, { useState, useEffect, useRef } from "react";
import { onAuthStateChanged, signInWithPopup, signOut, User, GoogleAuthProvider } from "firebase/auth";
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
  AlertTriangle,
  Key,
  Settings,
  RefreshCw,
  Search,
  FolderOpen,
  Cloud,
  HardDrive
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { GoogleGenAI, Type } from "@google/genai";

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
  const [userGeminiKey, setUserGeminiKey] = useState<string>(() => localStorage.getItem("user_gemini_key") || "");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showKeyWarning, setShowKeyWarning] = useState(false);
  
  // Google Drive integration states
  const [driveToken, setDriveToken] = useState<string>(() => localStorage.getItem("drive_wristband") || "");
  const [driveFiles, setDriveFiles] = useState<any[]>([]);
  const [driveSearch, setDriveSearch] = useState<string>("");
  const [isFetchingDrive, setIsFetchingDrive] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"upload" | "drive">("upload");

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

  // Google Drive listing and directory sync methods
  const fetchDriveFiles = async (token: string) => {
    if (!token) return;
    setIsFetchingDrive(true);
    try {
      const url = "https://www.googleapis.com/drive/v3/files?q=mimeType%3D%27application%2Fpdf%27+and+trashed%3Dfalse&fields=files%28id%2Cname%2CmimeType%2Csize%2CcreatedTime%29&pageSize=40&orderBy=createdTime+desc";
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (res.status === 401) {
        handleDriveTokenExpiry();
        return;
      }
      if (!res.ok) {
        throw new Error("Unable to fetch documents from Google Drive.");
      }
      const data = await res.json();
      setDriveFiles(data.files || []);
    } catch (err: any) {
      console.error("Drive Fetch Error:", err);
      setErrorAlert("Failed to load Google Drive files. Click 'Connect Google Drive' to refresh access.");
    } finally {
      setIsFetchingDrive(false);
    }
  };

  const handleDriveTokenExpiry = () => {
    localStorage.removeItem("drive_wristband");
    setDriveToken("");
    setDriveFiles([]);
    setErrorAlert("Your Google Drive validation expired or was revoked. Please reconnect to restore cloud operations.");
  };

  const fetchFolderId = async (token: string): Promise<string> => {
    const safeSearchUrl = `https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.folder'+and+name='InstaMocks_PYQs'+and+trashed=false&fields=files(id)&pageSize=1`;
    const res = await fetch(safeSearchUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.status === 401) {
      handleDriveTokenExpiry();
      throw new Error("Google Drive Token Expired");
    }
    if (!res.ok) {
      throw new Error("Failed to search folder structure in Google Drive.");
    }
    const data = await res.json();
    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }
    
    // Create Folder
    const createUrl = "https://www.googleapis.com/drive/v3/files";
    const createRes = await fetch(createUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: "InstaMocks_PYQs",
        mimeType: "application/vnd.google-apps.folder"
      })
    });
    if (!createRes.ok) {
      throw new Error("Unable to create base folder 'InstaMocks_PYQs' in Google Drive.");
    }
    const folderData = await createRes.json();
    return folderData.id;
  };

  const uploadFileToFolder = async (token: string, file: File, folderId: string) => {
    const metadata = {
      name: file.name,
      parents: [folderId]
    };
    const boundary = "multipart_boundary_drive_upload";
    const delimiter = `\r\n--${boundary}\r\n`;
    const close_delim = `\r\n--${boundary}--`;

    const fileBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as ArrayBuffer);
      r.onerror = () => reject(r.error);
      r.readAsArrayBuffer(file);
    });

    const metadataPart = 'Content-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(metadata) + '\r\n';
    const fileHeader = `Content-Type: ${file.type || 'application/pdf'}\r\n\r\n`;
    
    const multipartBody = new Blob([
      delimiter,
      metadataPart,
      delimiter,
      fileHeader,
      new Uint8Array(fileBuffer),
      close_delim
    ], { type: `multipart/related; boundary=${boundary}` });

    const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`
      },
      body: multipartBody
    });

    if (!response.ok) {
      throw new Error("Google Drive upload request failed.");
    }
    return await response.json();
  };

  const autoSaveToDrive = async (file: File) => {
    const token = localStorage.getItem("drive_wristband") || driveToken;
    if (!token) {
      console.log("Drive background auto-save matches skipped: no token stored.");
      return;
    }
    try {
      const folderId = await fetchFolderId(token);
      await uploadFileToFolder(token, file, folderId);
      console.log("File auto-saved to Google Drive folder 'InstaMocks_PYQs' successfully.");
    } catch (err) {
      console.error("Auto-Save to Google Drive Error:", err);
    }
  };

  // Auth observer initialization
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (loggedUser) => {
      setUser(loggedUser);
      setAuthLoading(false);
      if (loggedUser) {
        fetchUserData(loggedUser.uid);
        const storedToken = localStorage.getItem("drive_wristband");
        if (storedToken) {
          setDriveToken(storedToken);
          fetchDriveFiles(storedToken);
        }
      } else {
        setQuizzes([COMPREHENSIVE_DEMO_QUIZ]);
        setPerformances([]);
        setDriveToken("");
        setDriveFiles([]);
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

  // Google Single Sign-In popup with security exception catch and Drive Token interception
  const handleSignIn = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token = credential?.accessToken;
      if (token) {
        localStorage.setItem("drive_wristband", token);
        setDriveToken(token);
        fetchDriveFiles(token);
      }
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
      localStorage.removeItem("drive_wristband");
      setDriveToken("");
      setDriveFiles([]);
      setView("hub");
      setActiveQuiz(null);
    } catch (err: any) {
      console.error("Sign Out Error:", err);
    }
  };

  // Fetch file media from drive or parse it directly
  const fetchFileBlobFromDrive = async (token: string, fileId: string): Promise<Blob> => {
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    if (!res.ok) {
      if (res.status === 401) {
        handleDriveTokenExpiry();
      }
      throw new Error("Failed to fetch PDF bytes from Google Drive.");
    }
    return await res.blob();
  };

  const processDriveFile = async (driveFileId: string, fileName: string) => {
    try {
      setErrorAlert(null);
      setIsUploading(true);
      setUploadProgressText("Connecting to Google Drive to download PDF...");

      const token = localStorage.getItem("drive_wristband") || driveToken;
      if (!token) {
        throw new Error("Missing active Google Drive authorization token.");
      }

      const blob = await fetchFileBlobFromDrive(token, driveFileId);
      const mockFile = new File([blob], fileName, { type: "application/pdf" });
      
      // Pass copy processing without uploading back again to avoid duplicates
      await processFile(mockFile, { skipDriveUpload: true });

    } catch (err: any) {
      console.error("Google Drive Import Error:", err);
      setErrorAlert(err.message || "An error occurred while importing file from Google Drive.");
      setIsUploading(false);
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

  // File Upload, Read As Data URL, and client-side AI processing pipeline
  const processFile = async (file: File, options?: { skipDriveUpload?: boolean }) => {
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

    // State Check: Before processing request, check if the key exists.
    const activeKey = localStorage.getItem("user_gemini_key");
    if (!activeKey) {
      setShowKeyWarning(true);
      return;
    }

    setErrorAlert(null);
    setIsUploading(true);
    setUploadProgressText("Reading file bytes natively in browser...");

    try {
      const reader = new FileReader();
      
      // Promisified file reader loop
      const readPromise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Local file conversion failed."));
        reader.readAsDataURL(file);
      });

      const base64WithHeader = await readPromise;
      let cleanBase64 = base64WithHeader;
      if (base64WithHeader.includes(";base64,")) {
        cleanBase64 = base64WithHeader.split(";base64,")[1];
      }

      setUploadProgressText("Analyzing PDF & generating quiz structure with gemini-2.5-flash...");

      // Initialize the official @google/genai client on the client-side
      const ai = new GoogleGenAI({ apiKey: activeKey });

      // Structured Output Schema mapping
      const responseSchema = {
        type: Type.OBJECT,
        properties: {
          quiz_title: {
            type: Type.STRING,
            description: "A clear, descriptive title of the quiz extracted from the document header or content topic."
          },
          questions: {
            type: Type.ARRAY,
            description: "An array of standard multiple choice questions parsed from the document.",
            items: {
              type: Type.OBJECT,
              properties: {
                id: {
                  type: Type.STRING,
                  description: "A unique short string or index identifier for this question (e.g., 'q1', 'q2')."
                },
                question_text: {
                  type: Type.STRING,
                  description: "The full text of the question. Extract the exact text cleanly without numbering prefix."
                },
                options: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "Exactly 4 multiple choice options extracted from the question."
                },
                correct_option_index: {
                  type: Type.INTEGER,
                  description: "The zero-based index of the correct option (0 to 3)."
                },
                explanation: {
                  type: Type.STRING,
                  description: "A comprehensive, pedagogical step-by-step explanation detailing why the chosen option is correct."
                }
              },
              required: ["id", "question_text", "options", "correct_option_index", "explanation"]
            }
          }
        },
        required: ["quiz_title", "questions"]
      };

      const promptText = `Analyze the uploaded PDF document (Previous Year Questions) and extract its contents into a fully-structured interactive quiz conforming exactly to the responseSchema format.
Ensure all questions have exactly 4 multiple-choice options.
Provide a descriptive title for this quiz based on the file name "${file.name}" or the document contents.
Deduce the correct_option_index (0, 1, 2, or 3) logically.
Write a supportive, elaborate, and pedagogical explanation for each answer.`;

      const pdfPart = {
        inlineData: {
          mimeType: "application/pdf",
          data: cleanBase64,
        },
      };

      // Perform direct client-side model generation
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [pdfPart, promptText],
        config: {
          responseMimeType: "application/json",
          responseSchema: responseSchema,
        }
      });

      const resultText = response.text;
      if (!resultText) {
        throw new Error("Empty response returned from the Gemini model.");
      }

      const generatedQuizRes = JSON.parse(resultText);
      setUploadProgressText("Saving quiz to cloud Firestore...");

      // Write parsed quiz document to Firestore securely
      const quizId = "quiz-" + Date.now().toString() + "-" + Math.random().toString(36).substr(2, 5);
      const newQuizTitle = generatedQuizRes.quiz_title || file.name.replace(/\.[^/.]+$/, "");

      try {
        const docRef = doc(db, "quizzes", quizId);
        await setDoc(docRef, {
          userId: user.uid,
          title: newQuizTitle,
          questions: generatedQuizRes.questions,
          createdAt: serverTimestamp()
        });
      } catch (fErr) {
        handleFirestoreError(fErr, OperationType.WRITE, `quizzes/${quizId}`);
      }

      // Re-query database to show new list
      await fetchUserData(user.uid);
      
      // Auto-save backup copy to Google Drive 'InstaMocks_PYQs' in background
      if (!options?.skipDriveUpload && driveToken) {
        setUploadProgressText("Auto-saving source PDF directly to secure InstaMocks_PYQs folder...");
        await autoSaveToDrive(file);
      }
      
      setUploadProgressText("Quiz successfully created!");

    } catch (err: any) {
      console.error("Client-Side PDF Processing Pipeline Error:", err);
      let userFriendlyMsg = err.message || "An error occurred while generating the quiz schema.";
      if (err.status === 401 || err.message?.includes("API key") || err.message?.includes("key is invalid")) {
        userFriendlyMsg = "Invalid API Key. Please verify your Google AI Studio Gemini API Key prefix or structure in the settings config.";
      } else if (err.status === 429) {
        userFriendlyMsg = "Gemini API rate limit exceeded. Please try again in a few moments.";
      }
      setErrorAlert(userFriendlyMsg);
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

  const filteredDriveFiles = driveFiles.filter(file =>
    file.name.toLowerCase().includes(driveSearch.toLowerCase())
  );

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
            {/* Gemini API Key config button */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 border border-white/10 hover:border-white/20 bg-[#F27D26]/10 text-[#F27D26] hover:bg-[#F27D26]/25 rounded-full cursor-pointer transition-colors duration-150 shadow-sm"
              title="Gemini API Key Settings"
            >
              <Key className="w-3.5 h-3.5" />
              <span>Gemini Key</span>
            </button>

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

                  {/* Tab Selector */}
                  <div className="flex border-b border-white/5 mb-8 relative z-10" id="portal-tab-selector">
                    <button
                      onClick={() => setActiveTab("upload")}
                      className={`pb-3 text-xs uppercase font-mono font-bold tracking-wider relative transition-colors cursor-pointer mr-6 ${
                        activeTab === "upload" ? "text-[#F27D26]" : "text-white/40 hover:text-white/70"
                      }`}
                    >
                      Local File Sync
                      {activeTab === "upload" && (
                        <motion.div layoutId="activeTabLine" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#F27D26]" />
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setActiveTab("drive");
                        if (driveToken) {
                          fetchDriveFiles(driveToken);
                        }
                      }}
                      className={`pb-3 text-xs uppercase font-mono font-bold tracking-wider relative transition-colors cursor-pointer flex items-center gap-1.5 ${
                        activeTab === "drive" ? "text-[#F27D26]" : "text-white/40 hover:text-white/70"
                      }`}
                    >
                      Google Drive Library
                      {activeTab === "drive" && (
                        <motion.div layoutId="activeTabLine" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#F27D26]" />
                      )}
                    </button>
                  </div>

                  {activeTab === "upload" ? (
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
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-center relative z-10" id="google-drive-interface">
                      
                      {/* Left Informational Column */}
                      <div className="lg:col-span-2">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#F27D26]/10 text-[#F27D26] rounded-full text-xs font-mono uppercase mb-4 border border-[#F27D26]/20">
                          <Cloud className="w-3.5 h-3.5" />
                          <span>Google Drive Sync</span>
                        </div>
                        <h2 className="text-2xl font-serif italic text-white tracking-tight mb-4">
                          Connected Cloud Library
                        </h2>
                        
                        {!driveToken ? (
                          <>
                            <p className="text-white/60 text-xs leading-relaxed font-light mb-6">
                              Establish direct browser integration with your Google Drive. Natively browse PDFs and sync generated quizzes to Firestore instantly.
                            </p>
                            <button
                              onClick={handleSignIn}
                              className="px-5 py-2.5 bg-white text-black font-bold text-xs rounded-full cursor-pointer hover:bg-[#F27D26] hover:text-black transition duration-150"
                            >
                              Connect Google Drive
                            </button>
                          </>
                        ) : (
                          <div className="space-y-4">
                            <div className="bg-white/5 border border-white/5 rounded-2xl p-4">
                              <p className="text-xs text-white/40 font-mono">ACCOUNT CLOUD LINK</p>
                              <p className="text-sm font-bold text-white mt-1 truncate">
                                {user?.displayName || user?.email || "Google Drive Connected"}
                              </p>
                              <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-mono mt-1 font-bold uppercase">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                <span>Active Bearer Wristband</span>
                              </div>
                            </div>
                            <div className="text-xs text-white/55 leading-relaxed font-light">
                              Your manual PDF uploads are automatically processed and duplicated inside the safe <span className="text-[#F27D26] font-mono">InstaMocks_PYQs</span> folder in your Google Drive.
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Right File Picker Column */}
                      <div className="lg:col-span-3">
                        {!driveToken ? (
                          <div className="border border-dashed border-white/10 rounded-2xl p-8 text-center bg-white/5 min-h-[220px] flex flex-col items-center justify-center">
                            <HardDrive className="w-10 h-10 text-white/20 mb-3" />
                            <h4 className="font-serif italic text-sm text-white mb-1">Access Restrained</h4>
                            <p className="text-xs text-white/40 max-w-xs scale-95 font-light leading-relaxed">
                              Please click "Connect Google Drive" to fetch documents synchronously carrying temporary sandbox wristband.
                            </p>
                          </div>
                        ) : (
                          <div className="bg-white/5 border border-white/10 rounded-2xl p-5" id="drive-library-explorer">
                            <div className="flex justify-between items-center gap-3 mb-4">
                              <div className="relative flex-1">
                                <Search className="w-3.5 h-3.5 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                  type="text"
                                  value={driveSearch}
                                  onChange={(e) => setDriveSearch(e.target.value)}
                                  placeholder="Search Drive PDFs..."
                                  className="w-full bg-white/5 border border-white/10 rounded-full pl-9 pr-4 py-1.5 text-xs text-white outline-none focus:border-[#F27D26] transition font-mono focus:bg-black/20"
                                />
                              </div>

                              <button
                                onClick={() => fetchDriveFiles(driveToken)}
                                disabled={isFetchingDrive || isUploading}
                                className="p-2 border border-white/10 hover:bg-white/5 text-white/60 hover:text-white rounded-full transition disabled:opacity-50 shrink-0 cursor-pointer"
                                title="Refresh library"
                              >
                                <RefreshCw className={`w-3.5 h-3.5 ${isFetchingDrive ? "animate-spin text-[#F27D26]" : ""}`} />
                              </button>
                            </div>

                            {isFetchingDrive ? (
                              <div className="text-center py-12">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#F27D26] mx-auto mb-3" />
                                <p className="text-xs text-white/40 font-mono">RETRIEVING FILES FROM GOOGLE DRIVE...</p>
                              </div>
                            ) : isUploading ? (
                              <div className="text-center py-12 bg-black/10 rounded-xl border border-white/5">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#F27D26] mx-auto mb-3" />
                                <p className="text-xs text-white font-mono font-medium tracking-tight">AI DOCUMENT PARSING PIPELINE IN PROCESS</p>
                                <p className="text-[10px] text-white/55 mt-1 font-mono">{uploadProgressText}</p>
                              </div>
                            ) : filteredDriveFiles.length === 0 ? (
                              <div className="text-center py-10 bg-white/5 border border-dashed border-white/10 rounded-xl">
                                <FileText className="w-8 h-8 text-white/20 mx-auto mb-2" />
                                <p className="text-white/60 text-xs font-medium">No PDF documents identified</p>
                                <p className="text-white/30 text-[10px] mt-1 max-w-[240px] mx-auto leading-normal">
                                  Try adjusting search triggers or upload new PDFs manually to save and sync them directly.
                                </p>
                              </div>
                            ) : (
                              <div className="space-y-2 max-h-[190px] overflow-y-auto pr-1">
                                {filteredDriveFiles.map((f: any) => {
                                  const sizeInMb = f.size ? (Number(f.size) / (1024 * 1024)).toFixed(1) + " MB" : "Unknown size";
                                  const formattedTime = f.createdTime ? new Date(f.createdTime).toLocaleDateString() : "Unknown date";
                                  
                                  return (
                                    <div
                                      key={f.id}
                                      className="bg-white/5 border border-white/5 rounded-xl p-3 flex justify-between items-center hover:border-white/15 transition group"
                                    >
                                      <div className="min-w-0 pr-4">
                                        <p className="text-xs font-bold text-white truncate max-w-[180px] sm:max-w-xs group-hover:text-[#F27D26] transition font-sans" title={f.name}>
                                          {f.name}
                                        </p>
                                        <div className="flex items-center gap-2 text-[9px] text-white/40 font-mono mt-0.5">
                                          <span>{sizeInMb}</span>
                                          <span>•</span>
                                          <span>Created: {formattedTime}</span>
                                        </div>
                                      </div>

                                      <button
                                        disabled={isUploading}
                                        onClick={() => processDriveFile(f.id, f.name)}
                                        className="px-3 py-1 bg-white hover:bg-[#F27D26] text-black font-extrabold text-[10px] rounded-full cursor-pointer transition flex items-center gap-1.5 shrink-0"
                                      >
                                        <Sparkles className="w-2.5 h-2.5" />
                                        <span>Parse</span>
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                    </div>
                  )}

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

      {/* Settings Modal overlay */}
      <AnimatePresence>
        {isSettingsOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-[#0a0a0a] border border-white/10 rounded-3xl max-w-lg w-full p-6 md:p-8 shadow-2xl relative"
            >
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="absolute top-4 right-4 p-1.5 bg-white/5 hover:bg-white/10 rounded-full text-white/60 hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-[#F27D26]/10 text-[#F27D26] border border-[#F27D26]/20 rounded-xl flex items-center justify-center">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-serif italic text-white">Gemini Settings</h3>
                  <p className="text-[10px] font-mono font-bold text-[#F27D26] tracking-wider uppercase">Browser-Side Key Storage</p>
                </div>
              </div>

              <p className="text-white/60 text-xs md:text-sm leading-relaxed mb-6 font-light">
                This applet processes all PDF documents directly on your machine. Your API Key is stored safely inside your browser's <code className="font-mono bg-white/5 px-1 py-0.5 rounded text-white/80">localStorage</code> and never transmitted to our servers or secondary backends.
              </p>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-xs uppercase font-mono font-bold tracking-wider text-white/40 mb-2">
                    Google AI Studio Gemini API Key
                  </label>
                  <input
                    type="password"
                    value={userGeminiKey}
                    onChange={(e) => setUserGeminiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="font-mono bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white w-full text-sm outline-none focus:border-[#F27D26] focus:ring-1 focus:ring-[#F27D26] transition-all"
                  />
                </div>
                
                <div className="bg-amber-600/10 border border-amber-600/20 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-200">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="leading-relaxed font-light">
                    <strong>Security Warning:</strong> High-risk keys should be handled with care. Ensure you are on a trustworthy system when entering API keys.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem("user_gemini_key");
                    setUserGeminiKey("");
                    setIsSettingsOpen(false);
                  }}
                  className="flex-1 py-2.5 border border-white/10 text-white/60 hover:text-white/80 hover:bg-white/5 rounded-full text-xs font-bold font-sans transition cursor-pointer"
                >
                  Clear Key
                </button>
                <button
                  type="button"
                  onClick={() => {
                    localStorage.setItem("user_gemini_key", userGeminiKey.trim());
                    setIsSettingsOpen(false);
                  }}
                  className="flex-1 py-2.5 bg-white text-black hover:bg-[#F27D26] hover:text-black font-bold rounded-full text-xs transition cursor-pointer"
                >
                  Save & Apply
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Warning Key Modal overlay */}
      <AnimatePresence>
        {showKeyWarning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/85 backdrop-blur-xs flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-[#0a0a0a] border border-white/10 rounded-3xl max-w-md w-full p-6 text-center shadow-2xl relative"
            >
              <button 
                onClick={() => setShowKeyWarning(false)}
                className="absolute top-4 right-4 p-1.5 bg-white/5 hover:bg-white/10 rounded-full text-white/60 hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="w-12 h-12 rounded-full bg-[#F27D26]/10 text-[#F27D26] flex items-center justify-center mb-4 mx-auto border border-[#F27D26]/20">
                <Key className="w-6 h-6" />
              </div>

              <h3 className="text-xl font-serif italic text-white mb-2">Gemini API Key Required</h3>
              <p className="text-white/60 text-xs md:text-sm mb-6 leading-relaxed font-light">
                This portal processes PDF documents natively inside your browser. To extract questions and build mock exams, you must supply your personal Google AI Studio Gemini API Key.
              </p>

              <div className="flex flex-col gap-2.5">
                <button
                  onClick={() => {
                    setShowKeyWarning(false);
                    setIsSettingsOpen(true);
                  }}
                  className="w-full py-2.5 bg-[#F27D26] text-black font-bold rounded-full text-xs hover:bg-[#d0671c] transition cursor-pointer"
                >
                  Configure API Key Now
                </button>
                <button
                  onClick={() => setShowKeyWarning(false)}
                  className="w-full py-2.5 border border-white/10 hover:bg-white/5 text-white/80 rounded-full text-xs font-bold transition cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
