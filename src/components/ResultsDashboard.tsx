import React, { useState } from "react";
import { Question } from "../types";
import { Award, Clock, Flame, ListFilter, AlertCircle, ChevronDown, Check, X, BookOpen, BrainCircuit } from "lucide-react";
import { motion } from "motion/react";

interface ResultsDashboardProps {
  questions: Question[];
  score: number;
  mode: "practice" | "exam";
  timeTakenSeconds: number;
  userAnswers?: Record<string | number, number>; // Optional selected option map for review
  onBackToQuizzes: () => void;
}

export default function ResultsDashboard({
  questions,
  score,
  mode,
  timeTakenSeconds,
  userAnswers = {},
  onBackToQuizzes
}: ResultsDashboardProps) {
  const [filter, setFilter] = useState<"all" | "incorrect" | "correct">("all");
  const [expandedId, setExpandedId] = useState<string | number | null>(null);

  const percentage = Math.round((score / questions.length) * 100);

  // Performance Bracket evaluation
  let performanceTier = "Keep Practicing!";
  let tierColor = "text-[#F27D26] bg-[#F27D26]/10 border-[#F27D26]/20";
  let greeting = "You can do this! Review the explanations to reinforce your core understanding.";

  if (percentage >= 90) {
    performanceTier = "Masterful Accomplishment!";
    tierColor = "text-emerald-400 bg-emerald-950/40 border border-emerald-900/30";
    greeting = "Stellar score! You have completely internalized these Next-Gen concepts.";
  } else if (percentage >= 70) {
    performanceTier = "Superb Performance!";
    tierColor = "text-sky-400 bg-sky-950/40 border border-sky-900/30";
    greeting = "Outstanding effort. A little more revision and you will lock down a perfect score.";
  } else if (percentage >= 40) {
    performanceTier = "Healthy Progress";
    tierColor = "text-[#F27D26] bg-[#F27D26]/10 border border-[#F27D26]/20";
    greeting = "Solid attempt. We recommend retaking the quiz to iron out the remaining gaps.";
  }

  const formatDuration = (secs: number) => {
    const minutes = Math.floor(secs / 60);
    const remainder = secs % 60;
    if (minutes === 0) return `${remainder}s`;
    return `${minutes}m ${remainder}s`;
  };

  // Filter items in Incorrect Answer Review Hub
  const reviewItems = questions.filter(q => {
    const isAnswered = userAnswers[q.id] !== undefined;
    const isCorrect = userAnswers[q.id] === q.correct_option_index;

    if (filter === "incorrect") {
      return !isCorrect;
    }
    if (filter === "correct") {
      return isCorrect;
    }
    return true; // "all"
  });

  const toggleExpand = (id: string | number) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8" id="results-dashboard">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
        
        {/* Score Card Panel */}
        <div className="md:col-span-1 bg-[#0a0a0a] border border-white/5 rounded-3xl p-6 shadow-md flex flex-col items-center justify-center text-center">
          <div className="relative w-36 h-36 flex items-center justify-center mb-4">
            <svg className="absolute w-full h-full transform -rotate-90">
              <circle
                cx="72"
                cy="72"
                r="64"
                className="stroke-white/5"
                strokeWidth="8"
                fill="transparent"
              />
              <circle
                cx="72"
                cy="72"
                r="64"
                className="stroke-[#F27D26] transition-all duration-1000"
                strokeWidth="10"
                strokeDasharray={2 * Math.PI * 64}
                strokeDashoffset={2 * Math.PI * 64 * (1 - percentage / 100)}
                strokeLinecap="round"
                fill="transparent"
              />
            </svg>
            <div className="flex flex-col items-center">
              <span className="text-3xl font-black text-white font-mono">{percentage}%</span>
              <span className="text-[10px] font-bold uppercase text-white/40 font-mono tracking-wider">Completed</span>
            </div>
          </div>

          <div className={`px-4 py-1.5 rounded-full font-mono font-bold text-xs ${tierColor} mb-3`}>
            {performanceTier}
          </div>
          
          <div className="text-white font-bold text-base mb-1">
            {score} / {questions.length} Correct
          </div>
          <p className="text-xs text-white/40 font-mono">
            Mode: <span className="uppercase text-[#F27D26] font-bold">{mode}</span>
          </p>
        </div>

        {/* Breakdown Card / Message */}
        <div className="md:col-span-2 bg-[#0a0a0a] border border-white/5 rounded-3xl p-6 shadow-md flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-white/5 text-[#F27D26] flex items-center justify-center border border-white/10">
                <BrainCircuit className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-serif italic text-white tracking-tight">Scorecard Insights</h2>
            </div>
            
            <p className="text-white/70 text-sm md:text-base leading-relaxed mb-6 font-light">
              {greeting}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-white/5 rounded-lg flex items-center justify-center shrink-0 border border-white/10 text-white/60">
                <Clock className="w-5 h-5 text-[#F27D26]" />
              </div>
              <div>
                <span className="text-[10px] text-white/40 font-mono font-bold block">TIME ELAPSED</span>
                <span className="text-sm font-bold text-white font-mono">{formatDuration(timeTakenSeconds)}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-white/5 rounded-lg flex items-center justify-center shrink-0 border border-white/10 text-white/60">
                <Flame className="w-5 h-5 text-[#F27D26]" />
              </div>
              <div>
                <span className="text-[10px] text-white/40 font-mono font-bold block">STABILIZED RATE</span>
                <span className="text-sm font-bold text-white font-mono">{(timeTakenSeconds ? Math.round(questions.length / (timeTakenSeconds / 60)) : 0)} Quest/Min</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Review Hub */}
      <div className="bg-[#0a0a0a] border border-white/5 rounded-3xl p-6 shadow-sm mb-8" id="review-hub">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b border-white/5 pb-4">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#F27D26]" />
            <h3 className="text-lg font-serif italic text-white tracking-tight">Answer Review & Concepts Hub</h3>
          </div>

          <div className="flex gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
            {(["all", "incorrect", "correct"] as const).map(option => (
              <button
                key={option}
                onClick={() => setFilter(option)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize font-mono transition cursor-pointer ${
                  filter === option 
                    ? "bg-white text-black font-bold" 
                    : "text-white/60 hover:text-white"
                }`}
              >
                {option === "all" ? "All Questions" : option}
              </button>
            ))}
          </div>
        </div>

        {/* Review list */}
        {reviewItems.length === 0 ? (
          <div className="text-center py-12 text-white/30">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50 text-[#F27D26]" />
            <p className="text-sm font-mono">No questions match your current filter.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reviewItems.map((q, idx) => {
              const selectedIdx = userAnswers[q.id];
              const isCorrect = selectedIdx === q.correct_option_index;
              const hasSelected = selectedIdx !== undefined;
              const originalIndex = questions.findIndex(item => item.id === q.id);

              return (
                <div 
                  key={q.id}
                  className="border border-white/5 rounded-2xl overflow-hidden hover:border-white/10 transition-all bg-white/[0.02]"
                >
                  <button
                    onClick={() => toggleExpand(q.id)}
                    className="w-full font-sans text-left p-4 flex justify-between items-start gap-4 hover:bg-white/5 transition cursor-pointer"
                  >
                    <div className="flex-1 pr-2">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-bold font-mono text-white/35">Q#{originalIndex + 1}</span>
                        {hasSelected ? (
                          isCorrect ? (
                            <span className="bg-emerald-950/40 text-emerald-400 border border-emerald-900/30 text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded">Correct</span>
                          ) : (
                            <span className="bg-rose-950/40 text-rose-400 border border-rose-900/30 text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded">Incorrect</span>
                          )
                        ) : (
                          <span className="bg-white/5 text-white/50 border border-white/10 text-[10px] uppercase font-mono font-semibold px-2 py-0.5 rounded">Not Evaluated</span>
                        )}
                      </div>
                      <p className="text-white font-medium text-sm md:text-base line-clamp-2">
                        {q.question_text}
                      </p>
                    </div>
                    <ChevronDown className={`w-5 h-5 text-white/40 shrink-0 transform transition-transform duration-200 mt-1 ${expandedId === q.id ? "rotate-180" : ""}`} />
                  </button>

                  {/* Expanded Section showing explanation and options */}
                  {expandedId === q.id && (
                    <div className="bg-white/[0.03] p-4 border-t border-white/5 md:p-6 text-sm">
                      <p className="text-white font-medium mb-4">{q.question_text}</p>
                      
                      {/* Options breakdown */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                        {q.options.map((option, oIdx) => {
                          const isOptionCorrect = oIdx === q.correct_option_index;
                          const isOptionSelected = oIdx === selectedIdx;

                          let bgClass = "bg-white/5 border-white/10 text-white/80";
                          let sideMark = null;

                          if (isOptionCorrect) {
                            bgClass = "bg-emerald-950/40 border-2 border-emerald-500 text-emerald-300 font-medium";
                            sideMark = <Check className="w-4 h-4 text-emerald-400 shrink-0" />;
                          } else if (isOptionSelected) {
                            bgClass = "bg-rose-950/40 border-2 border-rose-500 text-rose-300 font-medium";
                            sideMark = <X className="w-4 h-4 text-rose-400 shrink-0" />;
                          }

                          return (
                            <div 
                              key={oIdx}
                              className={`p-3 rounded-xl border flex justify-between items-center ${bgClass}`}
                            >
                              <span>{option}</span>
                              {sideMark}
                            </div>
                          );
                        })}
                      </div>

                      {/* Explanation */}
                      <div className="bg-emerald-950/20 border border-emerald-900/30 rounded-xl p-4">
                        <span className="text-xs uppercase font-mono text-emerald-400 font-bold block mb-2">Step-by-step Explanation</span>
                        <p className="text-white/70 leading-relaxed font-light whitespace-pre-line text-sm">
                          {q.explanation}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer controls */}
      <div className="flex justify-center mb-12">
        <button
          onClick={onBackToQuizzes}
          className="bg-white text-black hover:bg-[#F27D26] hover:text-black px-8 py-3.5 rounded-full font-bold cursor-pointer shadow-md transition-colors duration-150 text-sm"
        >
          Return to Hub Portal
        </button>
      </div>
    </div>
  );
}
