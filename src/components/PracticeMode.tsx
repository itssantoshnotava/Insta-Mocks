import React, { useState } from "react";
import { Question } from "../types";
import { CheckCircle2, XCircle, AlertCircle, ArrowRight, Award, RotateCcw } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface PracticeModeProps {
  questions: Question[];
  quizTitle: string;
  onFinish: (score: number) => void;
  onCancel: () => void;
}

export default function PracticeMode({ questions, quizTitle, onFinish, onCancel }: PracticeModeProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [correctAnswersCount, setCorrectAnswersCount] = useState(0);

  const currentQuestion = questions[currentIndex];

  const handleOptionSelect = (optionIndex: number) => {
    if (selectedOption !== null) return; // Prevent multiple clicks
    setSelectedOption(optionIndex);
    setShowExplanation(true);
    if (optionIndex === currentQuestion.correct_option_index) {
      setCorrectAnswersCount(prev => prev + 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSelectedOption(null);
      setShowExplanation(false);
    } else {
      onFinish(correctAnswersCount);
    }
  };

  const progressPercentage = ((currentIndex) / questions.length) * 100;

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-8" id="practice-container">
      {/* Top Progress bar and Title */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs uppercase font-mono text-[#F27D26] tracking-wider font-bold">Practice Mode</span>
          <span className="text-sm font-semibold text-white/80">Question {currentIndex + 1} of {questions.length}</span>
        </div>
        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div 
            className="h-full bg-[#F27D26] transition-all duration-300"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        <h2 className="text-xl font-serif italic text-white tracking-tight mt-4 line-clamp-1">{quizTitle}</h2>
      </div>

      {/* Question Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -15 }}
          transition={{ duration: 0.3 }}
          className="bg-[#0a0a0a] rounded-2xl border border-white/5 shadow-sm p-6 md:p-8 mb-6"
        >
          <div className="text-xs font-mono font-bold py-1 px-3 bg-white/5 text-white/80 border border-white/10 rounded-full inline-block mb-4">
            QUESTION #{currentIndex + 1}
          </div>
          <p className="text-white text-lg md:text-xl font-medium leading-relaxed mb-8">
            {currentQuestion.question_text}
          </p>

          {/* Options Grid */}
          <div className="space-y-3">
            {currentQuestion.options.map((option, idx) => {
              const isSelected = selectedOption === idx;
              const isCorrectTarget = idx === currentQuestion.correct_option_index;
              const hasAnswered = selectedOption !== null;

              let buttonStyles = "border border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:border-white/20";
              let statusIcon = null;

              if (hasAnswered) {
                if (isCorrectTarget) {
                  buttonStyles = "border-2 border-emerald-500 bg-emerald-950/40 text-emerald-300 font-medium";
                  statusIcon = <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />;
                } else if (isSelected) {
                  buttonStyles = "border-2 border-rose-500 bg-rose-950/40 text-rose-300 font-medium";
                  statusIcon = <XCircle className="w-5 h-5 text-rose-400 shrink-0" />;
                } else {
                  buttonStyles = "opacity-40 border border-white/5 text-white/30 bg-transparent";
                }
              }

              return (
                <button
                  key={idx}
                  onClick={() => handleOptionSelect(idx)}
                  disabled={hasAnswered}
                  className={`w-full text-left p-4 rounded-xl flex justify-between items-center transition-all duration-150 ${buttonStyles}`}
                  id={`option-btn-${idx}`}
                >
                  <span className="flex-1 pr-3">{option}</span>
                  {statusIcon}
                </button>
              );
            })}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Feedback & Step-by-Step Explanation Panel */}
      <AnimatePresence>
        {showExplanation && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden mb-6"
          >
            <div className={`p-6 rounded-2xl border ${selectedOption === currentQuestion.correct_option_index ? 'bg-emerald-950/20 border-emerald-900/30 text-emerald-300' : 'bg-rose-950/20 border-rose-900/35 text-rose-300'}`}>
              <div className="flex items-center gap-2 mb-3">
                {selectedOption === currentQuestion.correct_option_index ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <span className="text-emerald-400 text-sm font-bold font-mono uppercase tracking-wider">CORRECT ANSWER</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5 text-rose-400" />
                    <span className="text-rose-400 text-sm font-bold font-mono uppercase tracking-wider">INCORRECT ANSWER</span>
                  </>
                )}
              </div>

              <div className="border-t border-white/5 pt-3">
                <span className="text-xs uppercase font-mono text-white/40 font-bold block mb-2">Step-by-Step Explanation</span>
                <p className="text-white/70 text-sm md:text-base leading-relaxed whitespace-pre-line font-light">
                  {currentQuestion.explanation}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Control Buttons */}
      <div className="flex justify-between items-center pt-2">
        <button
          onClick={onCancel}
          className="text-sm text-white/60 hover:text-white px-5 py-2 border border-white/10 hover:bg-white/5 rounded-full transition-colors font-medium cursor-pointer"
        >
          Quit Practice
        </button>

        {selectedOption !== null && (
          <button
            onClick={handleNext}
            className="bg-white text-black hover:bg-[#F27D26] hover:text-black font-bold px-6 py-2.5 rounded-full inline-flex items-center gap-2 transition-colors cursor-pointer shadow-sm"
            id="next-question-btn"
          >
            <span>{currentIndex < questions.length - 1 ? "Next Question" : "View Results"}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
