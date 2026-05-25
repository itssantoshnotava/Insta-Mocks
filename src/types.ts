export interface Question {
  id: string | number;
  question_text: string;
  options: string[];
  correct_option_index: number;
  explanation: string;
}

export interface Quiz {
  id: string;
  userId: string;
  title: string;
  questions: Question[];
  createdAt: any; // Firestore Timestamp context
}

export interface Performance {
  id: string;
  userId: string;
  quizId: string;
  quizTitle: string;
  score: number;
  totalQuestions: number;
  mode: "practice" | "exam";
  timeTaken: number; // in seconds
  createdAt: any; // Firestore Timestamp context
}
