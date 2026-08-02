"use client";

import { useState, useEffect } from "react";
import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";
import { 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Circle, 
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  HelpCircle,
  X,
  GripVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";

export interface QuizQuestion {
  id: string;
  question: string;
  type: "MULTIPLE_CHOICE" | "TRUE_FALSE";
  orderIndex: number;
  options: { id: string; text: string; isCorrect: boolean }[];
}

interface QuizBuilderProps {
  quizId: string;
  onQuestionsChange: (questions: QuizQuestion[]) => void;
  onValidationChange?: (isValid: boolean) => void;
  onInit?: () => void;
}

export const QuizBuilder = ({ 
  quizId, 
  onQuestionsChange, 
  onValidationChange,
  onInit 
}: QuizBuilderProps) => {
  const { data: serverQuestions, isLoading } = useQuery(
    orpc.instructor.getQuestions.queryOptions({ input: { quizId } })
  );

  const [localQuestions, setLocalQuestions] = useState<QuizQuestion[]>([]);
  const [initialized, setInitialized] = useState(false);

  // Sync server data to local state
  useEffect(() => {
    if (!isLoading && !initialized) {
      const mapped = (serverQuestions || []).map((q: any) => ({
        id: q.id,
        question: q.question,
        type: (q.type === "TRUE_FALSE" ? "TRUE_FALSE" : "MULTIPLE_CHOICE") as "MULTIPLE_CHOICE" | "TRUE_FALSE",
        orderIndex: q.orderIndex,
        options: (q.options || []).map((o: any) => ({
          id: o.id,
          text: o.text,
          isCorrect: o.isCorrect,
        })),
      }));
      
      setLocalQuestions(mapped);
      setInitialized(true);
      
      // Immediately notify parent so its ref is populated
      onQuestionsChange(mapped);
      onInit?.();
    }
  }, [serverQuestions, isLoading, initialized, onInit, onQuestionsChange]);

  // Notify parent of subsequent local changes
  useEffect(() => {
    if (initialized) {
      onQuestionsChange(localQuestions);

      // Validation logic
      const isValid = localQuestions.every(q => {
        const hasQuestion = q.question.trim().length > 0;
        const hasMinOptions = q.type === "TRUE_FALSE" 
          ? q.options.length === 2 
          : q.options.length >= 2;
        const hasCorrect = q.options.some(o => o.isCorrect);
        const optionsNotEmpty = q.options.every(o => o.text.trim().length > 0);
        
        return hasQuestion && hasMinOptions && hasCorrect && optionsNotEmpty;
      });
      
      onValidationChange?.(isValid);
    }
  }, [localQuestions, initialized, onQuestionsChange, onValidationChange]);

  const update = (newQuestions: QuizQuestion[]) => {
    setLocalQuestions(newQuestions);
  };

  const addQuestion = (type: "MULTIPLE_CHOICE" | "TRUE_FALSE") => {
    const newQ: QuizQuestion = {
      id: `temp-${Date.now()}`,
      question: type === "TRUE_FALSE" ? "Is this statement true?" : "New Question",
      type,
      orderIndex: localQuestions.length,
      options: type === "TRUE_FALSE"
        ? [
            { id: `opt-t-${Date.now()}`, text: "True", isCorrect: true },
            { id: `opt-f-${Date.now()}`, text: "False", isCorrect: false },
          ]
        : [],
    };
    update([...localQuestions, newQ]);
  };

  const removeQuestion = (id: string) => {
    update(localQuestions.filter((q) => q.id !== id));
  };

  const updateQuestion = (id: string, updates: Partial<QuizQuestion>) => {
    update(localQuestions.map((q) => (q.id === id ? { ...q, ...updates } : q)));
  };

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const items = Array.from(localQuestions);
    const [moved] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, moved);
    update(items.map((item, i) => ({ ...item, orderIndex: i })));
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-gray-50/50 rounded-2xl border border-gray-100">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-50 rounded-xl">
            <HelpCircle size={18} className="text-amber-600" />
          </div>
          <div>
            <h3 className="text-[14px] font-bold text-gray-900">Quiz Questions</h3>
            <p className="text-[11px] text-gray-400 font-medium">{localQuestions.length} question{localQuestions.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => addQuestion("MULTIPLE_CHOICE")}
            className="px-3 py-1.5 bg-white border border-gray-100 text-gray-700 rounded-lg text-[11px] font-bold hover:bg-gray-50 transition-all shadow-sm active:scale-[0.98]"
          >
            + Multichoice
          </button>
          <button
            type="button"
            onClick={() => addQuestion("TRUE_FALSE")}
            className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-[11px] font-bold hover:bg-amber-700 transition-all shadow-sm active:scale-[0.98]"
          >
            + True / False
          </button>
        </div>
      </div>

      {/* Questions (DND) */}
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="quiz-questions">
          {(provided) => (
            <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-3">
              {localQuestions.map((q, index) => (
                <Draggable key={q.id} draggableId={q.id} index={index}>
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.draggableProps}>
                      <QuestionCard
                        question={q}
                        index={index}
                        onDelete={() => removeQuestion(q.id)}
                        onUpdate={(updates) => updateQuestion(q.id, updates)}
                        dragHandleProps={provided.dragHandleProps}
                      />
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}

              {localQuestions.length === 0 && (
                <div className="py-12 border-2 border-dashed border-gray-100 rounded-2xl flex flex-col items-center justify-center gap-3">
                  <div className="p-3 bg-gray-50 rounded-xl text-gray-300">
                    <Plus size={24} />
                  </div>
                  <p className="text-[13px] font-bold text-gray-500">Add questions using the buttons above</p>
                </div>
              )}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
};

/* ── Question Card ── */
const QuestionCard = ({
  question,
  index,
  onDelete,
  onUpdate,
  dragHandleProps,
}: {
  question: QuizQuestion;
  index: number;
  onDelete: () => void;
  onUpdate: (u: Partial<QuizQuestion>) => void;
  dragHandleProps: any;
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const addOption = () => {
    onUpdate({
      options: [...question.options, { id: `opt-${Date.now()}`, text: "New Option", isCorrect: false }],
    });
  };

  const removeOption = (optId: string) => {
    onUpdate({ options: question.options.filter((o) => o.id !== optId) });
  };

  const setCorrectAnswer = (optId: string) => {
    onUpdate({
      options: question.options.map((o) => ({ ...o, isCorrect: o.id === optId })),
    });
  };

  const updateOptionText = (optId: string, text: string) => {
    onUpdate({
      options: question.options.map((o) => (o.id === optId ? { ...o, text } : o)),
    });
  };

  const hasCorrect = question.options.some((o) => o.isCorrect);

  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all">
      {/* Header */}
      <div
        className={cn("flex items-center gap-3 px-4 py-3", isExpanded && "border-b border-gray-50")}
      >
        <div {...dragHandleProps} className="p-1.5 text-gray-300 hover:text-gray-600 cursor-grab active:cursor-grabbing">
          <GripVertical size={18} />
        </div>
        <span
          className={cn(
            "w-7 h-7 flex items-center justify-center rounded-lg text-[12px] font-bold shrink-0",
            hasCorrect ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
          )}
        >
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <input
            value={question.question}
            onChange={(e) => onUpdate({ question: e.target.value })}
            className="w-full bg-transparent text-[14px] font-bold text-gray-900 outline-none focus:text-indigo-600 transition-colors"
            placeholder="Type your question…"
          />
          <div className="flex items-center gap-2 mt-0.5">
            <span
              className={cn(
                "text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider",
                question.type === "TRUE_FALSE" ? "bg-amber-100 text-amber-600" : "bg-indigo-100 text-indigo-600"
              )}
            >
              {question.type === "TRUE_FALSE" ? "True / False" : "Multiple Choice"}
            </span>
            {!hasCorrect && (
              <span className="text-[10px] font-bold text-rose-500 flex items-center gap-1">
                <AlertTriangle size={10} /> Needs answer
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button type="button" onClick={() => setIsExpanded(!isExpanded)} className="p-1.5 text-gray-400 hover:bg-gray-50 rounded-lg">
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          <button type="button" onClick={onDelete} className="p-1.5 text-gray-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Options */}
      {isExpanded && (
        <div className="p-5 bg-gray-50/30 space-y-2">
          {question.options.map((opt, optIdx) => (
            <div
              key={opt.id}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all group",
                opt.isCorrect ? "bg-emerald-50 border-emerald-100" : "bg-white border-gray-100 hover:border-gray-200"
              )}
            >
              <button type="button" onClick={() => setCorrectAnswer(opt.id)} className={cn("shrink-0 transition-all", opt.isCorrect ? "text-emerald-500" : "text-gray-300 hover:text-gray-400")}>
                {opt.isCorrect ? <CheckCircle2 size={20} /> : <Circle size={20} />}
              </button>
              <span className="text-[11px] font-bold text-gray-300 w-4 shrink-0">{String.fromCharCode(65 + optIdx)}</span>
              <input
                value={opt.text}
                disabled={question.type === "TRUE_FALSE"}
                onChange={(e) => updateOptionText(opt.id, e.target.value)}
                className={cn(
                  "flex-1 bg-transparent text-[13px] font-medium outline-none",
                  opt.isCorrect ? "text-emerald-900" : "text-gray-700",
                  question.type === "TRUE_FALSE" && "cursor-default select-none"
                )}
                placeholder="Option text…"
              />
              {question.type === "MULTIPLE_CHOICE" && (
                <button type="button" onClick={() => removeOption(opt.id)} className="p-1 text-gray-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all">
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
          {question.type === "MULTIPLE_CHOICE" && (
            <button
              type="button"
              onClick={addOption}
              className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              <Plus size={14} /> Add Option
            </button>
          )}
        </div>
      )}
    </div>
  );
};
