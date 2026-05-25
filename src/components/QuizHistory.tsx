import React from "react";
import { Quiz, Performance } from "../types";
import { BookOpen, Award, BarChart3, HelpCircle, GraduationCap, Zap, PlayCircle, History, Clock, BrainCircuit, Trash2 } from "lucide-react";

interface QuizHistoryProps {
  quizzes: Quiz[];
  performances: Performance[];
  onStartQuiz: (quiz: Quiz, mode: "practice" | "exam") => void;
  onDeleteQuiz: (quizId: string) => void;
  isLoading: boolean;
}

export default function QuizHistory({ quizzes, performances, onStartQuiz, onDeleteQuiz, isLoading }: QuizHistoryProps) {
  
  // Calculate aggregate stats
  const totalQuizzes = quizzes.length;
  const totalAttempts = performances.length;
  
  const averageScore = totalAttempts > 0 
    ? Math.round(
        (performances.reduce((acc, curr) => acc + (curr.score / curr.totalQuestions), 0) / totalAttempts) * 100
      ) 
    : 0;

  const totalQuestionsDone = performances.reduce((acc, curr) => acc + curr.totalQuestions, 0);

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8" id="history-container">
      
      {/* Dynamic Statistics Block */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        
        <div className="bg-[#0a0a0a] border border-white/5 rounded-2xl p-5 shadow-xs shrink-0">
          <div className="flex justify-between items-start mb-3">
            <span className="text-xs uppercase font-mono text-white/40 font-bold">Quizzes Synced</span>
            <div className="w-8 h-8 rounded-lg bg-white/5 text-[#F27D26] flex items-center justify-center border border-white/10">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-white font-mono">{totalQuizzes}</div>
          <span className="text-[10px] text-white/40 font-medium">Synced Cloud-wide</span>
        </div>

        <div className="bg-[#0a0a0a] border border-white/5 rounded-2xl p-5 shadow-xs shrink-0">
          <div className="flex justify-between items-start mb-3">
            <span className="text-xs uppercase font-mono text-white/40 font-bold">Completed Runs</span>
            <div className="w-8 h-8 rounded-lg bg-white/5 text-[#F27D26] flex items-center justify-center border border-white/10">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-white font-mono">{totalAttempts}</div>
          <span className="text-[10px] text-white/40 font-medium">Practiced or Mock Exams</span>
        </div>

        <div className="bg-[#0a0a0a] border border-white/5 rounded-2xl p-5 shadow-xs shrink-0">
          <div className="flex justify-between items-start mb-3">
            <span className="text-xs uppercase font-mono text-white/40 font-bold">Average Core Accuracy</span>
            <div className="w-8 h-8 rounded-lg bg-white/5 text-[#F27D26] flex items-center justify-center border border-white/10">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-white font-mono">{averageScore}%</div>
          <span className="text-[10px] text-white/40 font-medium">All attempts graded</span>
        </div>

        <div className="bg-[#0a0a0a] border border-white/5 rounded-2xl p-5 shadow-xs shrink-0">
          <div className="flex justify-between items-start mb-3">
            <span className="text-xs uppercase font-mono text-white/40 font-bold">Solved Exercises</span>
            <div className="w-8 h-8 rounded-lg bg-white/5 text-[#F27D26] flex items-center justify-center border border-white/10">
              <GraduationCap className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-white font-mono">{totalQuestionsDone}</div>
          <span className="text-[10px] text-white/40 font-medium">Grand total questions</span>
        </div>

      </div>

      {/* Main Section Grid: Quizzes Hub and Performance log side-by-side */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Sync Quizzes Directory (2/3 width) */}
        <div className="lg:col-span-2">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-white/60" />
              <h2 className="text-xl font-serif italic text-white tracking-tight">Quiz Directory</h2>
            </div>
            <span className="text-xs text-white/45 font-mono">{quizzes.length} files parsed</span>
          </div>

          {isLoading ? (
            <div className="bg-[#0a0a0a] border border-white/5 rounded-2xl p-12 text-center shadow-xs">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#F27D26] mx-auto mb-4" />
              <p className="text-white/60 text-sm">Querying databases...</p>
            </div>
          ) : quizzes.length === 0 ? (
            <div className="bg-[#0a0a0a] border border-dashed border-white/10 rounded-2xl p-12 text-center">
              <HelpCircle className="w-12 h-12 text-white/20 mx-auto mb-4" />
              <p className="text-white font-serif italic text-lg mb-1">Your Quiz Directory is Empty</p>
              <p className="text-white/40 text-xs max-w-sm mx-auto leading-relaxed">
                Drag-and-drop a Previous Year Question (PYQ) PDF in the parser widget above to generate your first AI mock quiz instantly.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {quizzes.map((quiz) => {
                // Find performances for this quiz
                const quizPerformances = performances.filter(p => p.quizId === quiz.id);

                return (
                  <div 
                    key={quiz.id}
                    className="bg-[#0a0a0a] border border-white/5 rounded-2xl p-5 shadow-sm hover:border-white/10 transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
                  >
                    <div className="flex-1 min-w-0 pr-4">
                      <h3 className="text-base font-bold text-white hover:text-[#F27D26] transition-colors truncate mb-1">
                        {quiz.title}
                      </h3>
                      
                      <div className="flex items-center gap-3 text-xs text-white/45 font-mono">
                        <span className="bg-white/5 text-white/80 border border-white/10 font-bold px-2 py-0.5 rounded">
                          {quiz.questions.length} Questions
                        </span>
                        <span>•</span>
                        <span>Created: {new Date(quiz.createdAt?.seconds * 1000 || quiz.createdAt || Date.now()).toLocaleDateString()}</span>
                      </div>

                      {/* Best Performance Badge */}
                      {quizPerformances.length > 0 && (
                        <div className="mt-3 flex items-center gap-1.5 text-xs">
                          <span className="text-white/40 font-medium">History:</span>
                          {quizPerformances.slice(0, 3).map((p, pIdx) => {
                            const rate = Math.round((p.score / p.totalQuestions) * 100);
                            return (
                              <span 
                                key={p.id}
                                className={`px-2 py-0.5 rounded-full font-mono font-bold text-[10px] ${
                                  rate >= 90 
                                    ? "bg-emerald-950/40 text-emerald-400 border border-emerald-900/30" 
                                    : rate >= 70 
                                      ? "bg-[#F27D26]/10 text-[#F27D26] border border-[#F27D26]/20" 
                                      : "bg-white/5 text-white/60 border border-white/10"
                                }`}
                                title={`Mode: ${p.mode}`}
                              >
                                {rate}%
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 w-full md:w-auto shrink-0 border-t md:border-t-0 border-white/5 pt-3 md:pt-0 justify-end">
                      <button
                        onClick={() => onStartQuiz(quiz, "practice")}
                        className="flex-1 md:flex-initial text-xs font-semibold px-4 py-2 text-white border border-white/10 hover:bg-white/5 rounded-full transition cursor-pointer flex items-center justify-center gap-1.5"
                        title="Practice Mode"
                      >
                        <GraduationCap className="w-3.5 h-3.5 text-[#F27D26]" />
                        <span>Practice</span>
                      </button>

                      <button
                        onClick={() => onStartQuiz(quiz, "exam")}
                        className="flex-1 md:flex-initial text-xs font-bold px-5 py-2 bg-white text-black hover:bg-[#F27D26] hover:text-black rounded-full transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                        title="Exam Mode"
                      >
                        <PlayCircle className="w-3.5 h-3.5" />
                        <span>Simulate Exam</span>
                      </button>

                      <button
                        onClick={() => onDeleteQuiz(quiz.id)}
                        className="p-2 text-white/40 hover:text-rose-450 hover:bg-rose-950/20 rounded-xl transition cursor-pointer ml-1"
                        title="Delete Quiz"
                      >
                        <Trash2 className="w-4 h-4 hover:text-rose-500 text-white/40" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Detailed Performance History (1/3 width) */}
        <div>
          <div className="flex items-center gap-2 mb-6">
            <History className="w-5 h-5 text-white/60" />
            <h2 className="text-xl font-serif italic text-white tracking-tight">Historic Logs</h2>
          </div>

          <div className="bg-[#0a0a0a] border border-white/5 rounded-3xl p-5 shadow-sm max-h-[480px] overflow-y-auto space-y-4">
            {performances.length === 0 ? (
              <div className="text-center py-12 text-white/30">
                <BrainCircuit className="w-8 h-8 opacity-40 mx-auto mb-2 text-[#F27D26]" />
                <p className="text-xs font-mono">No exam history logged yet.</p>
              </div>
            ) : (
              performances.map((perf) => {
                const rate = Math.round((perf.score / perf.totalQuestions) * 100);
                
                let performanceColor = "text-white/60 bg-white/5 border-white/10";
                if (rate >= 90) performanceColor = "text-emerald-400 bg-emerald-950/40 border-emerald-900/30";
                else if (rate >= 70) performanceColor = "text-[#F27D26] bg-[#F27D26]/10 border-[#F27D26]/20";

                return (
                  <div 
                    key={perf.id}
                    className="border border-white/5 p-3.5 rounded-xl hover:border-white/10 transition-all flex flex-col gap-2"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <span className="font-semibold text-white/90 text-sm truncate max-w-[140px] block" title={perf.quizTitle}>
                        {perf.quizTitle}
                      </span>
                      <span className={`text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded border ${performanceColor}`}>
                        {perf.score}/{perf.totalQuestions} ({rate}%)
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-[10px] text-white/40 font-mono">
                      <div className="flex items-center gap-1.5">
                        <span className="uppercase text-[#F27D26] font-bold">{perf.mode}</span>
                        <span>•</span>
                        <div className="flex items-center gap-0.5">
                          <Clock className="w-3 h-3 text-[#F27D26]" />
                          <span>{perf.timeTaken ? `${Math.round(perf.timeTaken / 60)}m` : "N/A"}</span>
                        </div>
                      </div>
                      
                      <span>
                        {new Date(perf.createdAt?.seconds * 1000 || perf.createdAt || Date.now()).toLocaleDateString(undefined, {month: "short", day: "numeric"})}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
