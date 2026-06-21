"use client";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-NG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function ScoreCircle({ score, isPassed, size = 100 }) {
  const color = isPassed ? "#2ecc71" : "#E27447";
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        border: `5px solid ${color}`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#fff",
        flexShrink: 0,
      }}
    >
      <span style={{ fontSize: size * 0.26, fontWeight: 700, color, lineHeight: 1 }}>
        {Math.round(score)}%
      </span>
      <span style={{ fontSize: 10, color: "#aaa", marginTop: 2, textTransform: "uppercase", letterSpacing: 0.5 }}>
        score
      </span>
    </div>
  );
}

// ── Quiz form number box ──────────────────────────────────────────────────────

function FormNumberBox({ index, isCurrent, isAnswered, onClick }) {
  let bg = "#f4f4f4";
  let color = "#666";
  let border = "1.5px solid transparent";
  let boxShadow = "none";

  if (isAnswered) { bg = "#E27447"; color = "#fff"; border = "1.5px solid #E27447"; }
  if (isCurrent && !isAnswered) { bg = "#fff"; color = "#E27447"; border = "1.5px solid #E27447"; }
  if (isCurrent && isAnswered) { boxShadow = "0 0 0 2.5px #fff, 0 0 0 4.5px #E27447"; }

  return (
    <button type="button" onClick={onClick}
      style={{ width: 36, height: 36, borderRadius: 6, border, background: bg, color, fontWeight: 700, fontSize: 13, cursor: "pointer", transition: "all 0.15s", boxShadow }}>
      {index + 1}
    </button>
  );
}

// ── Review number box ─────────────────────────────────────────────────────────

function ReviewNumberBox({ index, isCurrent, isCorrect, onClick }) {
  const bg = isCurrent ? (isCorrect ? "#2ecc71" : "#e53e3e") : (isCorrect ? "rgba(46,204,113,0.12)" : "rgba(229,62,62,0.1)");
  const color = isCurrent ? "#fff" : (isCorrect ? "#2ecc71" : "#e53e3e");
  const border = `1.5px solid ${isCorrect ? "#2ecc71" : "#e53e3e"}`;

  return (
    <button type="button" onClick={onClick}
      style={{ width: 36, height: 36, borderRadius: 6, border, background: bg, color, fontWeight: 700, fontSize: 13, cursor: "pointer", transition: "all 0.15s" }}>
      {index + 1}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function QuizPlayer({ quizId }) {
  const qc = useQueryClient();
  const [answers, setAnswers] = useState({});
  const [formPage, setFormPage] = useState(0);
  const [reviewPage, setReviewPage] = useState(0);
  const [isRetaking, setIsRetaking] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const queryOpts = orpc.student.getQuizData.queryOptions({ input: { quizId } });
  const { data, isLoading, error } = useQuery({ ...queryOpts, retry: false });

  const submitMutation = useMutation(
    orpc.student.submitQuiz.mutationOptions({
      onSuccess: () => {
        setIsRetaking(false);
        qc.invalidateQueries(queryOpts);
      },
    }),
  );

  if (isLoading) {
    const sh = { background: "linear-gradient(90deg,#f0f0f0 25%,#e4e4e4 50%,#f0f0f0 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite", borderRadius: 6 };
    return (
      <>
        <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
        <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 32 : 20, padding: "28px 20px", maxWidth: 900, margin: "0 auto", alignItems: "flex-start" }}>
          {/* Number grid skeleton */}
          <div style={{ width: isMobile ? "100%" : 164, flexShrink: 0 }}>
            <div style={{ background: "#fff", border: "1px solid #eee", borderRadius: 10, padding: "16px 14px" }}>
              <div style={{ height: 10, width: 60, marginBottom: 12, ...sh }} />
              <div style={{ display: "flex", flexWrap: isMobile ? "nowrap" : "wrap", overflowX: isMobile ? "auto" : "visible", gap: 8, paddingBottom: isMobile ? 4 : 0 }}>
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} style={{ width: 36, height: 36, flexShrink: 0, ...sh }} />
                ))}
              </div>
            </div>
          </div>
          {/* Question card skeleton */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ background: "#fff8f5", border: "1px solid #fbd38d", borderRadius: 10, padding: "14px 18px", marginBottom: 18 }}>
              <div style={{ height: 17, width: "50%", marginBottom: 8, ...sh, background: "linear-gradient(90deg,#fde8d8 25%,#fbd38d 50%,#fde8d8 75%)", backgroundSize: "200% 100%" }} />
              <div style={{ height: 12, width: "30%", ...sh, background: "linear-gradient(90deg,#fde8d8 25%,#fbd38d 50%,#fde8d8 75%)", backgroundSize: "200% 100%" }} />
            </div>
            <div style={{ background: "#fff", border: "1.5px solid #e0e0e0", borderRadius: 10, padding: "24px 24px 20px", marginBottom: 18 }}>
              <div style={{ height: 10, width: 70, marginBottom: 14, ...sh }} />
              <div style={{ height: 18, width: "80%", marginBottom: 8, ...sh }} />
              <div style={{ height: 18, width: "55%", marginBottom: 24, ...sh }} />
              {[1, 2, 3, 4].map((n) => (
                <div key={n} style={{ height: 46, marginBottom: 10, ...sh }} />
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div style={{ height: 44, width: 110, ...sh }} />
              <div style={{ height: 44, width: 110, ...sh }} />
            </div>
          </div>
        </div>
      </>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: "60px 30px", textAlign: "center", color: "#888" }}>
        <p style={{ margin: 0 }}>Failed to load quiz. Please refresh the page.</p>
      </div>
    );
  }

  const { quiz, questions, attemptCount, maxAttempts, allAttemptsUsed, submissions, bestSubmission } = data;
  const hasPassed = bestSubmission?.isPassed ?? false;
  const showReview = allAttemptsUsed || hasPassed;
  const showForm = attemptCount === 0 || isRetaking;

  const handleSelect = (questionId, optionId) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
  };

  const handleSubmit = () => {
    if (submitMutation.isPending) return;
    submitMutation.mutate({
      quizId,
      answers: Object.entries(answers).map(([questionId, optionId]) => ({ questionId, optionId })),
    });
  };

  const handleRetake = () => {
    setAnswers({});
    setFormPage(0);
    setIsRetaking(true);
  };

  // ── QUIZ FORM VIEW ─────────────────────────────────────────────────────────
  if (showForm) {
    if (questions.length === 0) {
      return (
        <div style={{ padding: "60px 30px", textAlign: "center", color: "#888" }}>
          <i className="flaticon-question" style={{ fontSize: 48, color: "#ccc", display: "block", marginBottom: 12 }} />
          <p style={{ margin: 0, fontSize: 15 }}>This quiz has no questions yet.</p>
        </div>
      );
    }

    const currentQ = questions[formPage];
    const isLastPage = formPage === questions.length - 1;
    const allAnswered = questions.every((q) => answers[q.id]);
    const answeredCount = Object.keys(answers).length;

    return (
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 32 : 20, padding: isMobile ? "16px 14px" : "28px 20px", maxWidth: 900, margin: "0 auto", alignItems: "flex-start" }}>

        {/* Left: number grid */}
        <div style={{ width: isMobile ? "100%" : 164, flexShrink: 0 }}>
          <div style={{ background: "#fff", border: "1px solid #eee", borderRadius: 10, padding: "16px 14px", position: isMobile ? "relative" : "sticky", top: 20 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#aaa", margin: "0 0 12px", textTransform: "uppercase", letterSpacing: 0.8 }}>
              Questions
            </p>
            <div style={{ display: "flex", flexWrap: isMobile ? "nowrap" : "wrap", overflowX: isMobile ? "auto" : "visible", gap: 8, paddingBottom: isMobile ? 4 : 0 }}>
              {questions.map((q, i) => (
                <FormNumberBox
                  key={q.id}
                  index={i}
                  isCurrent={i === formPage}
                  isAnswered={Boolean(answers[q.id])}
                  onClick={() => setFormPage(i)}
                />
              ))}
            </div>
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #f0f0f0" }}>
              <p style={{ fontSize: 12, color: answeredCount === questions.length ? "#2ecc71" : "#888", margin: isMobile ? 0 : "0 0 10px", fontWeight: 600 }}>
                {answeredCount} / {questions.length} answered
              </p>
              {!isMobile && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 12, height: 12, borderRadius: 3, background: "#E27447", display: "inline-block" }} />
                    <span style={{ fontSize: 11, color: "#888" }}>Answered</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 12, height: 12, borderRadius: 3, background: "#f4f4f4", border: "1px solid #ddd", display: "inline-block" }} />
                    <span style={{ fontSize: 11, color: "#888" }}>Not answered</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: question + nav */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Header */}
          <div style={{ background: "#fff8f5", border: "1px solid #fbd38d", borderRadius: 10, padding: "14px 18px", marginBottom: 18, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <div>
              <h5 style={{ fontWeight: 700, fontSize: 16, margin: "0 0 2px" }}>{quiz.title}</h5>
              <span style={{ fontSize: 13, color: "#888" }}>
                Passing: {quiz.passingScore}%
                {attemptCount > 0 && ` · Attempt ${attemptCount + 1} of ${maxAttempts}`}
              </span>
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#E27447" }}>
              Q {formPage + 1} / {questions.length}
            </span>
          </div>

          {/* Question card */}
          <div style={{ background: "#fff", border: "1.5px solid #e0e0e0", borderRadius: 10, padding: "24px 24px 20px", marginBottom: 18 }}>
            <p style={{ fontSize: 12, color: "#aaa", margin: "0 0 12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Question {formPage + 1}
            </p>
            <p style={{ fontWeight: 600, fontSize: 16, margin: "0 0 20px", lineHeight: 1.6, color: "#222" }}>
              {currentQ.question}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {currentQ.options.map((o) => {
                const selected = answers[currentQ.id] === o.id;
                return (
                  <label key={o.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 8, border: selected ? "1.5px solid #E27447" : "1px solid #e8e8e8", background: selected ? "rgba(226,116,71,0.06)" : "#fafafa", cursor: "pointer", transition: "all 0.15s", userSelect: "none" }}>
                    <input type="radio" name={`q_${currentQ.id}`} value={o.id} checked={selected} onChange={() => handleSelect(currentQ.id, o.id)} style={{ accentColor: "#E27447", flexShrink: 0, width: 16, height: 16 }} />
                    <span style={{ fontSize: 15, color: "#333" }}>{o.text}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Error */}
          {submitMutation.isError && (
            <div style={{ background: "#fff5f5", border: "1px solid #feb2b2", borderRadius: 8, padding: "12px 16px", marginBottom: 14, color: "#c53030", fontSize: 14 }}>
              {submitMutation.error?.message || "Failed to submit. Please try again."}
            </div>
          )}

          {/* Prev / Next / Submit */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <button type="button" className="tf-btn" onClick={() => setFormPage((p) => p - 1)} disabled={formPage === 0}
              style={{ background: "#fff", color: "#E27447", border: "1.5px solid #E27447", opacity: formPage === 0 ? 0.35 : 1, cursor: formPage === 0 ? "not-allowed" : "pointer" }}>
              <i className="icon-arrow-left" style={{ marginRight: 6 }} />Previous
            </button>

            {isLastPage ? (
              <button type="button" className="tf-btn" onClick={handleSubmit} disabled={!allAnswered || submitMutation.isPending}
                style={{ background: allAnswered ? "#2ecc71" : undefined, borderColor: allAnswered ? "#2ecc71" : undefined, opacity: allAnswered ? 1 : 0.45, cursor: allAnswered ? "pointer" : "not-allowed" }}>
                {submitMutation.isPending ? "Submitting..." : "Submit Quiz"}
                <i className="flaticon-check" style={{ marginLeft: 6 }} />
              </button>
            ) : (
              <button type="button" className="tf-btn" onClick={() => setFormPage((p) => p + 1)}>
                Next<i className="icon-arrow-top-right" style={{ marginLeft: 6 }} />
              </button>
            )}
          </div>

          {isLastPage && !allAnswered && (
            <p style={{ textAlign: "right", fontSize: 13, color: "#E27447", margin: "10px 0 0" }}>
              {questions.length - answeredCount} question{questions.length - answeredCount !== 1 ? "s" : ""} still unanswered.
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── ATTEMPTS HISTORY VIEW (failed + attempts remaining) ─────────────────────
  if (!showReview) {
    return (
      <div style={{ padding: "32px 24px", maxWidth: 680, margin: "0 auto" }}>

        {/* Best score banner */}
        {bestSubmission && (
          <div style={{ textAlign: "center", padding: "28px 20px 24px", background: bestSubmission.isPassed ? "#f0fff4" : "#fff8f5", borderRadius: 12, border: `1px solid ${bestSubmission.isPassed ? "#9ae6b4" : "#fbd38d"}`, marginBottom: 28 }}>
            <p style={{ fontSize: 32, margin: "0 0 6px" }}>{bestSubmission.isPassed ? "🎉" : "📝"}</p>
            <h4 style={{ margin: "0 0 16px", fontSize: 20, fontWeight: 700, color: bestSubmission.isPassed ? "#276749" : "#E27447" }}>
              {bestSubmission.isPassed ? "You Passed!" : "Not Passed"}
            </h4>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
              <ScoreCircle score={bestSubmission.score} isPassed={bestSubmission.isPassed} />
            </div>
            <p style={{ margin: "0 0 4px", color: "#555", fontSize: 14 }}>
              Best score · Passing: <strong>{quiz.passingScore}%</strong>
            </p>
            <p style={{ margin: "0 0 20px", color: "#888", fontSize: 13 }}>
              {maxAttempts - attemptCount} attempt{maxAttempts - attemptCount !== 1 ? "s" : ""} remaining
              {" · Answer review unlocks when you pass"}
            </p>
            <button type="button" className="tf-btn" onClick={handleRetake}
              style={{ background: "#fff", color: "#E27447", border: "1.5px solid #E27447" }}>
              Retake Quiz <i className="flaticon-play-1" style={{ marginLeft: 6, fontSize: 11 }} />
            </button>
          </div>
        )}

        {/* All attempts list */}
        <h6 style={{ fontWeight: 600, marginBottom: 14, fontSize: 15 }}>Your Attempts</h6>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {submissions.map((s) => {
            const isBest = s.id === bestSubmission?.id;
            return (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 20px", borderRadius: 10, background: isBest ? (s.isPassed ? "#f0fff4" : "#fff8f5") : "#fafafa", border: `1px solid ${isBest ? (s.isPassed ? "#9ae6b4" : "#fbd38d") : "#eee"}` }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: s.isPassed ? "#2ecc71" : "#E27447", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>{s.attemptNumber}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>Attempt {s.attemptNumber}</p>
                  <p style={{ margin: 0, fontSize: 12, color: "#888" }}>{fmt(s.createdAt)}</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {isBest && (
                    <span style={{ fontSize: 11, fontWeight: 700, background: "#E27447", color: "#fff", padding: "2px 8px", borderRadius: 20 }}>BEST</span>
                  )}
                  <span style={{ fontSize: 18, fontWeight: 700, color: s.isPassed ? "#2ecc71" : "#E27447" }}>
                    {Math.round(s.score)}%
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: s.isPassed ? "#f0fff4" : "#fff5f5", color: s.isPassed ? "#276749" : "#c53030", border: `1px solid ${s.isPassed ? "#9ae6b4" : "#feb2b2"}` }}>
                    {s.isPassed ? "PASS" : "FAIL"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── REVIEW VIEW (all attempts used) ──────────────────────────────────────────
  const currentRQ = questions[reviewPage];
  const questionCorrectness = questions.map((q) => q.options.some((o) => o.isCorrect && o.wasSelectedInBest));

  return (
    <div style={{ padding: isMobile ? "16px 14px" : "32px 24px", maxWidth: 920, margin: "0 auto" }}>

      {/* Best score banner — compact */}
      {bestSubmission && (
        <div style={{ display: "flex", alignItems: "center", gap: 20, padding: "20px 24px", background: bestSubmission.isPassed ? "#f0fff4" : "#fff8f5", borderRadius: 12, border: `1px solid ${bestSubmission.isPassed ? "#9ae6b4" : "#fbd38d"}`, marginBottom: 24 }}>
          <ScoreCircle score={bestSubmission.score} isPassed={bestSubmission.isPassed} size={80} />
          <div style={{ flex: 1 }}>
            <h4 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700, color: bestSubmission.isPassed ? "#276749" : "#E27447" }}>
              {bestSubmission.isPassed ? "🎉 You Passed!" : "📝 Not Passed"}
            </h4>
            <p style={{ margin: "0 0 2px", fontSize: 13, color: "#666" }}>
              Best score: <strong>{Math.round(bestSubmission.score)}%</strong> · Passing: {quiz.passingScore}%
            </p>
            <p style={{ margin: 0, fontSize: 12, color: "#888" }}>All {maxAttempts} attempts used</p>
          </div>
        </div>
      )}

      {/* All attempts list — compact */}
      <div style={{ marginBottom: 24 }}>
        <h6 style={{ fontWeight: 600, marginBottom: 12, fontSize: 15 }}>All Attempts</h6>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {submissions.map((s) => {
            const isBest = s.id === bestSubmission?.id;
            return (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 10, background: isBest ? (s.isPassed ? "#f0fff4" : "#fff8f5") : "#fafafa", border: `1px solid ${isBest ? (s.isPassed ? "#9ae6b4" : "#fbd38d") : "#eee"}`, flex: "1 1 200px" }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: s.isPassed ? "#2ecc71" : "#E27447", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ color: "#fff", fontWeight: 700, fontSize: 12 }}>{s.attemptNumber}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 13 }}>Attempt {s.attemptNumber} {isBest && <span style={{ fontSize: 10, background: "#E27447", color: "#fff", padding: "1px 6px", borderRadius: 10, marginLeft: 4 }}>BEST</span>}</p>
                  <p style={{ margin: 0, fontSize: 11, color: "#888" }}>{fmt(s.createdAt)}</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: s.isPassed ? "#2ecc71" : "#E27447" }}>{Math.round(s.score)}%</p>
                  <span style={{ fontSize: 11, fontWeight: 700, color: s.isPassed ? "#276749" : "#c53030" }}>{s.isPassed ? "PASS" : "FAIL"}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Answer review — paginated */}
      <h6 style={{ fontWeight: 600, marginBottom: 14, fontSize: 15 }}>Answer Review <span style={{ fontSize: 12, color: "#888", fontWeight: 400 }}>(based on best attempt)</span></h6>

      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 32 : 20, alignItems: "flex-start" }}>

        {/* Left: review jump box */}
        <div style={{ width: isMobile ? "100%" : 164, flexShrink: 0 }}>
          <div style={{ background: "#fff", border: "1px solid #eee", borderRadius: 10, padding: "16px 14px", position: isMobile ? "relative" : "sticky", top: 20 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#aaa", margin: "0 0 12px", textTransform: "uppercase", letterSpacing: 0.8 }}>Questions</p>
            <div style={{ display: "flex", flexWrap: isMobile ? "nowrap" : "wrap", overflowX: isMobile ? "auto" : "visible", gap: 8, paddingBottom: isMobile ? 4 : 0 }}>
              {questions.map((q, i) => (
                <ReviewNumberBox
                  key={q.id}
                  index={i}
                  isCurrent={i === reviewPage}
                  isCorrect={questionCorrectness[i]}
                  onClick={() => setReviewPage(i)}
                />
              ))}
            </div>
            {!isMobile && (
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #f0f0f0" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: "#2ecc71", display: "inline-block" }} />
                  <span style={{ fontSize: 11, color: "#888" }}>Correct</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: "#e53e3e", display: "inline-block" }} />
                  <span style={{ fontSize: 11, color: "#888" }}>Wrong</span>
                </div>
              </div>
            </div>
            )}
          </div>
        </div>

        {/* Right: question review */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ background: "#fff", border: "1.5px solid #e0e0e0", borderRadius: 10, padding: "24px 24px 20px", marginBottom: 18 }}>
            <p style={{ fontSize: 12, color: "#aaa", margin: "0 0 12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Question {reviewPage + 1} of {questions.length}
            </p>
            <p style={{ fontWeight: 600, fontSize: 16, margin: "0 0 20px", lineHeight: 1.6, color: "#222" }}>
              {currentRQ.question}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {currentRQ.options.map((o) => {
                const wasSelected = o.wasSelectedInBest;
                const isCorrect = o.isCorrect;

                let bg = "#fafafa";
                let border = "1px solid #e8e8e8";
                let textColor = "#444";
                let iconEl = null;

                if (isCorrect) {
                  bg = "#f0fff4";
                  border = "1.5px solid #9ae6b4";
                  textColor = "#276749";
                  iconEl = <i className="flaticon-check" style={{ color: "#2ecc71", fontSize: 13, flexShrink: 0 }} />;
                } else if (wasSelected) {
                  bg = "#fff5f5";
                  border = "1.5px solid #feb2b2";
                  textColor = "#c53030";
                  iconEl = <i className="flaticon-close-1" style={{ color: "#e53e3e", fontSize: 13, flexShrink: 0 }} />;
                } else {
                  iconEl = <span style={{ width: 13, flexShrink: 0, display: "inline-block" }} />;
                }

                return (
                  <div key={o.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 8, background: bg, border }}>
                    {iconEl}
                    <span style={{ fontSize: 14, color: textColor }}>{o.text}</span>
                    {wasSelected && !isCorrect && (
                      <span style={{ marginLeft: "auto", fontSize: 11, color: "#c53030", fontWeight: 600, flexShrink: 0 }}>Your answer</span>
                    )}
                    {wasSelected && isCorrect && (
                      <span style={{ marginLeft: "auto", fontSize: 11, color: "#276749", fontWeight: 600, flexShrink: 0 }}>Your answer ✓</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Prev / Next in review */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <button type="button" className="tf-btn" onClick={() => setReviewPage((p) => p - 1)} disabled={reviewPage === 0}
              style={{ background: "#fff", color: "#E27447", border: "1.5px solid #E27447", opacity: reviewPage === 0 ? 0.35 : 1, cursor: reviewPage === 0 ? "not-allowed" : "pointer" }}>
              <i className="icon-arrow-left" style={{ marginRight: 6 }} />Previous
            </button>
            <span style={{ fontSize: 13, color: "#888" }}>
              {reviewPage + 1} / {questions.length}
            </span>
            <button type="button" className="tf-btn" onClick={() => setReviewPage((p) => p + 1)} disabled={reviewPage === questions.length - 1}
              style={{ opacity: reviewPage === questions.length - 1 ? 0.35 : 1, cursor: reviewPage === questions.length - 1 ? "not-allowed" : "pointer" }}>
              Next<i className="icon-arrow-top-right" style={{ marginLeft: 6 }} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
