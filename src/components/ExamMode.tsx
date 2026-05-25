import React, { useState, useEffect } from "react";
import { Question } from "../types";
import { Clock, Flag, Check, ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
import { motion } from "motion/react";

interface ExamModeProps {
  questions: Question[];
  quizTitle: string;
  onFinish: (score: number, timeTakenMinutes: number, answersMap: Record<string | number, number>) => void;
  onCancel: () => void;
}

export default function ExamMode({ questions, quizTitle, onFinish, onCancel }: ExamModeProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string | number, number>>({});
  const [flagged, setFlagged] = useState<Record<string | number, boolean>>({});
  const [timeLeft, setTimeLeft] = useState(questions.length * 60); // 1 minute per question as a high-stakes default
  const [confirmSubmit, setConfirmSubmit] = useState(false);

  const currentQuestion = questions[currentIndex];

  // Countdown timer logic
  useEffect(() => {
    if (timeLeft <= 0) {
      handleSubmit();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  const handleOptionSelect = (optionIndex: number) => {
    setAnswers(prev => ({
      ...prev,
      [currentQuestion.id]: optionIndex
    }));
  };

  const toggleFlag = () => {
    setFlagged(prev => ({
      ...prev,
      [currentQuestion.id]: !prev[currentQuestion.id]
    }));
  };

  const getScore = () => {
    let score = 0;
    questions.forEach(q => {
      if (answers[q.id] === q.correct_option_index) {
        score += 1;
      }
    });
    return score;
  };

  const formatTime = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const handleSubmit = () => {
    const totalTimeTakenSeconds = (questions.length * 60) - timeLeft;
    const finalScore = getScore();
    onFinish(finalScore, totalTimeTakenSeconds, answers);
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8" id="exam-container">
      {/* Timer & Exam Title Row */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 bg-[#0a0a0a] border border-white/5 rounded-2xl p-4">
        <div>
          <span className="text-xs uppercase font-mono text-[#F27D26] font-bold bg-[#F27D26]/10 border border-[#F27D26]/20 px-2 py-0.5 rounded mr-2">Exam Simulator</span>
          <span className="text-sm text-white/50 font-medium font-mono">DYNAMIC MOCK EXAM</span>
          <h1 className="text-xl font-serif italic text-white mt-1 line-clamp-1">{quizTitle}</h1>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-rose-950/20 border border-rose-900/35 rounded-xl text-rose-400 font-mono font-bold text-lg animate-pulse">
            <Clock className="w-5 h-5 text-rose-400" />
            <span>{formatTime(timeLeft)}</span>
          </div>

          <button
            onClick={() => setConfirmSubmit(true)}
            className="bg-white hover:bg-[#F27D26] hover:text-black text-black px-5 py-2.5 rounded-full text-xs font-bold leading-none cursor-pointer transition-colors duration-150"
          >
            Submit Exam
          </button>
        </div>
      </div>

      {/* Main Grid: Navigation Sidebar + Question Area */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Navigation Sidebar */}
        <div className="order-2 lg:order-1 lg:col-span-1 bg-[#0a0a0a] border border-white/5 rounded-2xl p-5 shadow-sm">
          <h2 className="text-xs uppercase font-mono text-white/40 font-bold mb-4 tracking-wider">Exam Navigation</h2>
          
          <div className="grid grid-cols-4 gap-2 mb-6">
            {questions.map((q, idx) => {
              const isCurrent = currentIndex === idx;
              const isAnswered = answers[q.id] !== undefined;
              const isFlagged = flagged[q.id] === true;

              let btnStyle = "border-white/10 text-white/60 hover:bg-white/5 hover:border-white/20";
              if (isAnswered) {
                btnStyle = "bg-[#F27D26] border-transparent text-black font-bold";
              }
              if (isFlagged) {
                btnStyle = "bg-amber-600/20 border-amber-600/40 border text-amber-200 font-bold";
              }
              if (isCurrent) {
                btnStyle = "ring-2 ring-white border-transparent font-bold " + (isAnswered ? "bg-[#F27D26]" : isFlagged ? "bg-amber-600/20" : "");
              }

              return (
                <button
                  key={q.id}
                  onClick={() => setCurrentIndex(idx)}
                  className={`relative h-10 w-full rounded-xl flex items-center justify-center font-mono text-sm border font-medium cursor-pointer transition-all ${btnStyle}`}
                >
                  <span>{idx + 1}</span>
                  {isFlagged && (
                    <span className="absolute top-0 right-0 w-2 h-2 bg-amber-500 rounded-full border border-black" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="space-y-2 border-t border-white/5 pt-4 text-xs text-white/40 font-mono">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-transparent border border-white/20 rounded block" />
              <span>Unanswered / Skipped</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-[#F27D26] rounded block" />
              <span>Selected Option Logged</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-amber-600/20 border border-amber-600/40 rounded block" />
              <span>Flagged for Review</span>
            </div>
          </div>
        </div>

        {/* Current Question Block */}
        <div className="order-1 lg:order-2 lg:col-span-3">
          <div className="bg-[#0a0a0a] border border-white/5 rounded-2xl p-6 md:p-8 shadow-sm mb-6">
            <div className="flex justify-between items-center mb-6">
              <span className="text-xs font-mono text-white/40 font-bold uppercase">QUESTION {currentIndex + 1} OF {questions.length}</span>
              
              <button
                onClick={toggleFlag}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold uppercase font-mono transition-colors border ${
                  flagged[currentQuestion.id] 
                    ? "bg-amber-950/20 border-amber-900/30 text-amber-300" 
                    : "border-white/10 text-white/60 hover:text-white hover:bg-white/5 bg-transparent"
                }`}
              >
                <Flag className={`w-3.5 h-3.5 ${flagged[currentQuestion.id] ? "fill-amber-400" : ""}`} />
                <span>{flagged[currentQuestion.id] ? "Flagged" : "Flag for Review"}</span>
              </button>
            </div>

            <p className="text-white text-lg md:text-xl font-medium leading-relaxed mb-8">
              {currentQuestion.question_text}
            </p>

            {/* Answer Options */}
            <div className="space-y-3">
              {currentQuestion.options.map((option, idx) => {
                const isSelected = answers[currentQuestion.id] === idx;

                const borderClass = isSelected 
                  ? "border-2 border-[#F27D26] bg-[#F27D26]/10 text-white font-bold" 
                  : "border border-white/10 hover:border-white/20 bg-white/5 text-white/80 hover:bg-white/10";

                return (
                  <button
                    key={idx}
                    onClick={() => handleOptionSelect(idx)}
                    className={`w-full text-left p-4 rounded-xl flex items-center gap-3 transition-all ${borderClass}`}
                  >
                    <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-mono text-xs font-bold ${
                      isSelected ? "bg-[#F27D26] text-black" : "bg-white/10 text-white/50"
                    }`}>
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span>{option}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Nav Controls */}
          <div className="flex justify-between items-center">
            <button
              onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
              disabled={currentIndex === 0}
              className="px-5 py-2.5 border border-white/10 text-white/60 rounded-full hover:bg-white/5 disabled:opacity-40 transition-colors inline-flex items-center gap-1.5 text-xs font-bold font-sans cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back</span>
            </button>

            {currentIndex < questions.length - 1 ? (
              <button
                onClick={() => setCurrentIndex(prev => prev + 1)}
                className="px-6 py-2.5 bg-white text-black rounded-full hover:bg-[#F27D26] hover:text-black transition-colors inline-flex items-center gap-1.5 text-xs font-bold font-sans cursor-pointer"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => setConfirmSubmit(true)}
                className="px-6 py-2.5 bg-[#F27D26] text-black font-bold rounded-full hover:bg-[#d0671c] hover:text-white transition-colors text-xs cursor-pointer"
              >
                Submit Exam
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal overlay */}
      {confirmSubmit && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-zoomIn text-center">
            <div className="w-12 h-12 rounded-full bg-[#F27D26]/10 text-[#F27D26] flex items-center justify-center mb-4 mx-auto border border-[#F27D26]/20">
              <Check className="w-6 h-6" />
            </div>

            <h3 className="text-xl font-serif italic text-white mb-2">Submit Exam Paper?</h3>
            <p className="text-white/60 text-sm mb-6 leading-relaxed">
              Are you sure you want to grade your exam? You have answered {Object.keys(answers).length} out of {questions.length} questions.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setConfirmSubmit(false)}
                className="flex-1 py-2.5 border border-white/10 rounded-full text-xs font-bold hover:bg-white/5 text-white/80 transition cursor-pointer"
              >
                Go Back
              </button>
              <button
                onClick={handleSubmit}
                className="flex-1 py-2.5 bg-white hover:bg-[#F27D26] hover:text-black text-black font-bold rounded-full text-xs transition cursor-pointer"
              >
                Yes, Grade Me
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
