"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  ExternalLink,
  FileText,
  FileUp,
  Loader2,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Radio,
  Send,
  Star,
  Upload,
  UserRound,
  Link2,
} from "lucide-react";
import { API_BASE_URL } from "@/config";
import { jsPDF } from "jspdf";

interface ClassSession {
  id: number;
  title: string;
  topic?: string;
  scheduled_start: string;
  scheduled_end?: string | null;
  status: string;
  is_live: boolean;
  meeting_url?: string | null;
  attendance_status?: string | null;
  progress: { status: string; completion_percent: number; score?: number | null; notes?: string | null };
}

interface CourseProgress {
  enrollment_id: number;
  course_id: number;
  course_title: string;
  batch_id: number;
  batch_name: string;
  batch_status: string;
  enrollment_status: string;
  payment_status: string;
  total_fee?: number | null;
  amount_paid?: number | null;
  amount_due?: number | null;
  slip_number?: string | null;
  admission_slip_generated: boolean;
  advance_slip_generated: boolean;
  start_date?: string | null;
  end_date?: string | null;
  schedule?: string | null;
  room_or_link?: string | null;
  instructor_name?: string | null;
  instructor?: { id: number; name: string; email?: string | null; phone?: string | null; bio?: string | null; expertise?: string | null; qualification?: string | null; experience_years?: number | null; photo_url?: string | null } | null;
  resources: Array<{ id: number; title: string; description?: string | null; filename: string; size_bytes: number }>;
  review?: { rating: number; feedback_text?: string | null } | null;
  progress_percent: number;
  sessions: ClassSession[];
}

interface StudentProfile { id: number; name: string; email?: string | null; phone?: string | null; address?: string | null; gender?: string | null; qualification?: string | null; education_level?: string | null; gpa?: number | null; academic_background?: string | null; career_goal?: string | null; guardian_name?: string | null; guardian_phone?: string | null; source?: string | null; status?: string | null; }
interface StudentNote { id: number; content: string; created_at: string; }

interface StudentTask {
  id: number;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  due_date?: string | null;
  batch_id?: number | null;
  batch_name?: string | null;
  submission_url?: string | null;
  submission_file?: string | null;
  submission_notes?: string | null;
  submitted_at?: string | null;
  is_submitted?: boolean;
}

function formatDate(value?: string | null) {
  if (!value) return "Date to be confirmed";
  return new Date(value).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

const TABS = [
  { key: "learning", label: "My Learning" },
  { key: "tasks", label: "Tasks" },
] as const;
type TabKey = typeof TABS[number]["key"];

export default function LearningPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("learning");
  const [studentName, setStudentName] = useState("");
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [courses, setCourses] = useState<CourseProgress[]>([]);
  const [notes, setNotes] = useState<StudentNote[]>([]);
  const [comment, setComment] = useState("");
  const [reviewBatchId, setReviewBatchId] = useState<number | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [savingAction, setSavingAction] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Tasks tab state
  const [tasks, setTasks] = useState<StudentTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksError, setTasksError] = useState("");
  const [submittingTaskId, setSubmittingTaskId] = useState<number | null>(null);
  const [submitUrl, setSubmitUrl] = useState("");
  const [submitNotes, setSubmitNotes] = useState("");
  const [submitFile, setSubmitFile] = useState<File | null>(null);
  const [submitError, setSubmitError] = useState("");
  const [submitNotice, setSubmitNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/student-portal/learning`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || "Could not load your learning profile.");
        setStudentName(data.student?.name || "Student");
        setStudent(data.student || null);
        setNotes(data.notes || []);
        setCourses(data.courses || []);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Could not load your learning profile.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const loadTasks = useCallback(async () => {
    setTasksLoading(true);
    setTasksError("");
    try {
      const response = await fetch(`${API_BASE_URL}/student-portal/tasks`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Could not load tasks.");
      setTasks(data.tasks || []);
    } catch (e) {
      setTasksError(e instanceof Error ? e.message : "Could not load tasks.");
    } finally {
      setTasksLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "tasks") void loadTasks();
  }, [activeTab, loadTasks]);

  const openSubmitDialog = (task: StudentTask) => {
    setSubmittingTaskId(task.id);
    setSubmitUrl(task.submission_url || "");
    setSubmitNotes(task.submission_notes || "");
    setSubmitFile(null);
    setSubmitError("");
    setSubmitNotice("");
  };

  const handleTaskSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!submittingTaskId) return;
    if (!submitUrl && !submitFile && !submitNotes) {
      setSubmitError("Provide a project URL, upload a file, or write notes before submitting.");
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    try {
      const formData = new FormData();
      if (submitUrl) formData.append("submission_url", submitUrl);
      if (submitNotes) formData.append("submission_notes", submitNotes);
      if (submitFile) formData.append("file", submitFile);
      const response = await fetch(`${API_BASE_URL}/student-portal/tasks/${submittingTaskId}/submit`, {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Could not submit task.");
      setSubmitNotice("Task submitted successfully! ✅");
      setSubmittingTaskId(null);
      await loadTasks();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to submit task.");
    } finally {
      setSubmitting(false);
    }
  };

  const sessions = courses.flatMap(course => course.sessions.map(item => ({ ...item, courseTitle: course.course_title, batchName: course.batch_name, batchId: course.batch_id })));
  const liveSession = sessions.find(item => item.is_live);
  const nextSession = sessions.filter(item => new Date(item.scheduled_start).getTime() >= Date.now() && !item.is_live).sort((a, b) => a.scheduled_start.localeCompare(b.scheduled_start))[0];
  const completedSessions = sessions.filter(item => item.progress.status === "Completed").length;
  const averageProgress = courses.length ? Math.round(courses.reduce((sum, course) => sum + course.progress_percent, 0) / courses.length) : 0;

  const addComment = async () => {
    if (!student || !comment.trim()) return;
    setSavingAction("comment");
    setActionMessage("");
    try {
      const response = await fetch(`${API_BASE_URL}/students/${student.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: comment.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Could not save your comment.");
      setNotes(current => [data.note, ...current]);
      setComment("");
      setActionMessage("Comment saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save your comment.");
    } finally {
      setSavingAction("");
    }
  };

  const submitReview = async (course: CourseProgress) => {
    if (!course.instructor || !reviewText.trim()) return;
    setSavingAction(`review-${course.batch_id}`);
    setActionMessage("");
    try {
      const response = await fetch(`${API_BASE_URL}/instructors/${course.instructor.id}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instructor_id: course.instructor.id, batch_id: course.batch_id, rating: reviewRating, teaching_quality: reviewRating, punctuality: reviewRating, communication: reviewRating, feedback_text: reviewText.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Could not submit your review.");
      setCourses(current => current.map(item => item.batch_id === course.batch_id ? { ...item, review: data.review } : item));
      setReviewBatchId(null);
      setReviewText("");
      setActionMessage("Review submitted. Thank you for your feedback.");
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Could not submit your review.");
    } finally {
      setSavingAction("");
    }
  };

  const downloadResource = async (resource: CourseProgress["resources"][number]) => {
    setSavingAction(`resource-${resource.id}`);
    setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/institute-resources/${resource.id}/download`);
      if (!response.ok) throw new Error("Could not download this resource.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = resource.filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "Could not download this resource.");
    } finally {
      setSavingAction("");
    }
  };

  const downloadSlip = async (course: CourseProgress, type: "admission" | "advance") => {
    setSavingAction(`slip-${course.enrollment_id}`);
    setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/enrollments/${course.enrollment_id}/generate-${type}-slip`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Could not generate this slip.");
      const pdf = new jsPDF();
      const heading = type === "admission" ? "ADMISSION SLIP" : "ADVANCE PAYMENT SLIP";
      pdf.setFontSize(18);
      pdf.text("SERP Hawk Institute", 18, 20);
      pdf.setFontSize(14);
      pdf.text(heading, 18, 31);
      pdf.setFontSize(10);
      pdf.text(`Slip number: ${data.slip_number || course.slip_number || "—"}`, 18, 41);
      pdf.text(`Student: ${student?.name || "Student"}`, 18, 53);
      pdf.text(`Course: ${course.course_title}`, 18, 62);
      pdf.text(`Batch: ${course.batch_name}`, 18, 71);
      pdf.text(`Payment status: ${data.payment_status || course.payment_status}`, 18, 80);
      pdf.text(`Paid: ${data.amount_paid ?? course.amount_paid ?? 0}`, 18, 89);
      if (type === "admission") pdf.text(`Balance due: ${data.amount_due ?? course.amount_due ?? 0}`, 18, 98);
      pdf.save(`${type}-slip-${course.enrollment_id}.pdf`);
      setActionMessage(`${heading.toLowerCase()} downloaded.`);
    } catch (slipError) {
      setError(slipError instanceof Error ? slipError.message : "Could not generate this slip.");
    } finally {
      setSavingAction("");
    }
  };

  if (loading) return <div className="flex min-h-72 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-emerald-700" /></div>;

  const completedTasksCount = tasks.filter(t => t.status === "Done").length;
  const pendingTasksCount = tasks.filter(t => t.status !== "Done").length;

  return (
    <div className="space-y-8">
      <section className="flex flex-col justify-between gap-4 border-b border-[var(--border)] pb-6 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase text-emerald-800 dark:text-emerald-400">Learning overview</p>
          <h1 className="text-3xl font-bold tracking-tight">Welcome back, {studentName}</h1>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">Your courses, class schedule, and progress in one place.</p>
        </div>
        <div className="text-sm text-[var(--text-secondary)]">{courses.length} active {courses.length === 1 ? "course" : "courses"}</div>
      </section>

      {error && <div role="alert" className="flex items-center gap-2 rounded-md border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}
      {actionMessage && <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">{actionMessage}</p>}

      {student && <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[{ label: "Email", value: student.email, icon: Mail }, { label: "Phone", value: student.phone, icon: Phone }, { label: "Program", value: student.qualification || student.education_level, icon: UserRound }, { label: "Student status", value: student.status, icon: CheckCircle2 }].map(({ label, value, icon: Icon }) => <div key={label} className="min-w-0 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4"><p className="flex items-center gap-2 text-xs text-[var(--text-secondary)]"><Icon className="h-4 w-4" />{label}</p><p className="mt-2 truncate text-sm font-semibold">{value || "Not recorded"}</p></div>)}
      </section>}

      {liveSession ? (
        <section className="flex flex-col justify-between gap-5 rounded-lg border border-emerald-800 bg-emerald-950 p-5 text-white sm:flex-row sm:items-center sm:p-6">
          <div className="flex items-start gap-4">
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white/10"><Radio className="h-5 w-5 text-emerald-300" /></span>
            <div><p className="text-xs font-semibold uppercase text-emerald-300">In session now</p><h2 className="mt-1 text-xl font-semibold">{liveSession.title}</h2><p className="mt-1 text-sm text-emerald-100/75">{liveSession.courseTitle} · {liveSession.batchName}</p></div>
          </div>
          {liveSession.meeting_url && <a href={liveSession.meeting_url} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-md bg-white px-4 py-2.5 text-sm font-semibold text-emerald-950 hover:bg-emerald-50">Join class <ArrowUpRight className="h-4 w-4" /></a>}
        </section>
      ) : nextSession ? (
        <section className="flex items-center gap-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300"><CalendarDays className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1"><p className="text-xs font-semibold uppercase text-[var(--text-secondary)]">Next class</p><h2 className="mt-1 truncate font-semibold">{nextSession.title} <span className="font-normal text-[var(--text-secondary)]">· {nextSession.courseTitle}</span></h2><p className="mt-1 text-sm text-[var(--text-secondary)]">{formatDate(nextSession.scheduled_start)}</p></div>
          {nextSession.meeting_url && <a href={nextSession.meeting_url} target="_blank" rel="noreferrer" title="Open class link" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md hover:bg-[var(--background)]"><ArrowUpRight className="h-4 w-4" /></a>}
        </section>
      ) : null}

      {/* Tabs */}
      <div className="border-b border-[var(--border)]">
        <nav className="flex gap-1" role="tablist">
          {TABS.map(tab => (
            <button
              key={tab.key}
              role="tab"
              type="button"
              aria-selected={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "text-emerald-800 dark:text-emerald-300"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {tab.label}
              {tab.key === "tasks" && tasks.length > 0 && (
                <span className={`ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold ${pendingTasksCount > 0 ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"}`}>
                  {pendingTasksCount > 0 ? pendingTasksCount : "✓"}
                </span>
              )}
              {activeTab === tab.key && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-t-full bg-emerald-700" />}
            </button>
          ))}
        </nav>
      </div>

      {/* Tasks Tab */}
      {activeTab === "tasks" && (
        <div className="space-y-6">
          {submitNotice && <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">{submitNotice}</p>}

          {tasksError && <div role="alert" className="flex items-center gap-2 rounded-md border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800"><AlertCircle className="h-4 w-4 shrink-0" />{tasksError}</div>}

          {/* Summary bar */}
          {tasks.length > 0 && (
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-center">
                <p className="text-2xl font-bold">{tasks.length}</p>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">Total tasks</p>
              </div>
              <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-center dark:border-emerald-800 dark:bg-emerald-950/30">
                <p className="text-2xl font-bold text-emerald-800 dark:text-emerald-300">{completedTasksCount}</p>
                <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">Completed</p>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-center dark:border-amber-800 dark:bg-amber-950/30">
                <p className="text-2xl font-bold text-amber-800 dark:text-amber-300">{pendingTasksCount}</p>
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">Pending</p>
              </div>
            </div>
          )}

          {tasksLoading ? (
            <div className="flex min-h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-emerald-700" /></div>
          ) : tasks.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--border)] px-6 py-16 text-center">
              <FileText className="mx-auto h-8 w-8 text-[var(--text-secondary)]" />
              <h3 className="mt-3 font-semibold">No tasks assigned yet</h3>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">Tasks assigned to you from your course batch will appear here for you to submit.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {tasks.map(task => {
                const isDone = task.status === "Done";
                const isOverdue = task.due_date && !isDone && new Date(task.due_date) < new Date();
                return (
                  <article
                    key={task.id}
                    className={`flex flex-col rounded-lg border bg-[var(--surface)] p-5 ${isDone ? "border-emerald-300 dark:border-emerald-800" : isOverdue ? "border-rose-300 dark:border-rose-800" : "border-[var(--border)]"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold ${isDone ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : isOverdue ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300" : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"}`}>
                        {isDone ? <><CheckCircle2 className="h-3 w-3" /> Submitted</> : isOverdue ? "⚠ Overdue" : <><Clock3 className="h-3 w-3" /> Pending</>}
                      </span>
                      <span className="text-xs font-medium text-[var(--text-secondary)]">{task.priority}</span>
                    </div>

                    <h3 className="mt-3 font-semibold leading-snug">{task.title}</h3>
                    {task.description && <p className="mt-1 text-sm text-[var(--text-secondary)]">{task.description}</p>}

                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--text-secondary)]">
                      {task.batch_name && <span className="inline-flex items-center gap-1"><BookOpen className="h-3 w-3" />{task.batch_name}</span>}
                      {task.due_date && <span className="inline-flex items-center gap-1"><CalendarDays className="h-3 w-3" />Due {task.due_date}</span>}
                    </div>

                    {isDone && (task.submission_url || task.submission_file || task.submission_notes) && (
                      <div className="mt-4 space-y-1.5 rounded-md border border-[var(--border)] bg-[var(--background)] p-3 text-xs">
                        <p className="font-semibold text-emerald-700 dark:text-emerald-400">Your submission:</p>
                        {task.submission_url && (
                          <a href={task.submission_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sky-700 hover:underline dark:text-sky-400 truncate">
                            <Link2 className="h-3.5 w-3.5 shrink-0" />{task.submission_url}
                          </a>
                        )}
                        {task.submission_file && (
                          <a href={`${API_BASE_URL}${task.submission_file}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-emerald-700 hover:underline dark:text-emerald-400">
                            <FileUp className="h-3.5 w-3.5" />Download submitted file
                          </a>
                        )}
                        {task.submission_notes && <p className="text-[var(--text-secondary)] italic">"{task.submission_notes}"</p>}
                        {task.submitted_at && <p className="text-[10px] text-[var(--text-secondary)]">Submitted {new Date(task.submitted_at).toLocaleString()}</p>}
                      </div>
                    )}

                    <div className="mt-auto pt-4">
                      <button
                        type="button"
                        onClick={() => openSubmitDialog(task)}
                        className={`w-full inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold transition-colors ${isDone ? "border border-[var(--border)] hover:bg-[var(--background)]" : "bg-emerald-800 text-white hover:bg-emerald-700"}`}
                      >
                        {isDone ? <><ExternalLink className="h-4 w-4" /> Update submission</> : <><Upload className="h-4 w-4" /> Submit & mark complete</>}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {/* Task Submission Modal */}
          {submittingTaskId !== null && (
            <div
              className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-4"
              role="presentation"
              onMouseDown={(e) => { if (e.target === e.currentTarget && !submitting) setSubmittingTaskId(null); }}
            >
              <form
                onSubmit={handleTaskSubmit}
                className="w-full max-w-lg space-y-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl"
              >
                <div>
                  <h2 className="text-lg font-semibold">Submit task</h2>
                  <p className="text-sm text-[var(--text-secondary)]">Provide a project URL, upload your file, and add any notes for your instructor.</p>
                </div>

                {submitError && <div role="alert" className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-800">{submitError}</div>}

                <label className="block">
                  <span className="text-xs font-medium">Project / Assignment URL</span>
                  <div className="mt-1 flex items-center rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2">
                    <Link2 className="mr-2 h-4 w-4 text-[var(--text-secondary)]" />
                    <input
                      type="url"
                      value={submitUrl}
                      onChange={e => setSubmitUrl(e.target.value)}
                      placeholder="https://github.com/... or https://drive.google.com/..."
                      className="w-full bg-transparent text-sm focus:outline-none"
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="text-xs font-medium">Upload Assignment File (optional)</span>
                  <div className="mt-1 flex items-center rounded-md border border-dashed border-[var(--border)] bg-[var(--background)] p-3">
                    <Upload className="mr-2 h-4 w-4 text-[var(--text-secondary)]" />
                    <input
                      type="file"
                      onChange={(e: ChangeEvent<HTMLInputElement>) => { if (e.target.files?.[0]) setSubmitFile(e.target.files[0]); }}
                      className="text-xs file:mr-2 file:rounded file:border-0 file:bg-sky-800 file:px-2 file:py-1 file:text-white file:text-xs"
                    />
                  </div>
                  {submitFile && <p className="mt-1 text-xs text-emerald-700">Selected: {submitFile.name}</p>}
                </label>

                <label className="block">
                  <span className="text-xs font-medium">Notes / Feedback</span>
                  <textarea
                    rows={3}
                    value={submitNotes}
                    onChange={e => setSubmitNotes(e.target.value)}
                    placeholder="Any comments, approach explanation, credentials, or notes to your instructor..."
                    className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                  />
                </label>

                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" disabled={submitting} onClick={() => setSubmittingTaskId(null)} className="rounded-md border border-[var(--border)] px-4 py-2 text-sm">Cancel</button>
                  <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-md bg-emerald-800 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Submit & mark complete
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* My Learning Tab */}
      {activeTab === "learning" && (
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.6fr)]">
          <div className="space-y-4">
            <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">My courses</h2><span className="text-sm text-[var(--text-secondary)]">{completedSessions} sessions completed</span></div>
            {courses.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[var(--border)] px-6 py-12 text-center"><BookOpen className="mx-auto h-8 w-8 text-[var(--text-secondary)]" /><h3 className="mt-3 font-semibold">No active enrollments</h3><p className="mt-1 text-sm text-[var(--text-secondary)]">Your courses will appear here once the institute enrolls you.</p></div>
            ) : courses.map(course => (
                <article key={course.enrollment_id} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div><p className="text-xs font-medium text-emerald-800 dark:text-emerald-400">{course.batch_name} · {course.batch_status}</p><h3 className="mt-1 text-lg font-semibold">{course.course_title}</h3><p className="mt-1 text-sm text-[var(--text-secondary)]">{course.instructor_name ? `Instructor ${course.instructor_name}` : "Instructor to be assigned"}{course.schedule ? ` · ${course.schedule}` : ""}</p></div>
                  <span className="shrink-0 text-sm font-semibold">{course.progress_percent}%</span>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--background)]"><div className="h-full rounded-full bg-emerald-700 transition-all" style={{ width: `${course.progress_percent}%` }} /></div>
                <section className="mt-4 rounded-md bg-[var(--background)] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs text-[var(--text-secondary)]">Enrollment · {course.enrollment_status || "Active"}</p><p className="mt-1 text-sm font-semibold">{course.payment_status || "Pending"} · Slip {course.slip_number || "pending"}</p></div><div className="text-right text-sm"><p>Paid {Number(course.amount_paid ?? 0).toLocaleString()}</p><p className="text-xs text-[var(--text-secondary)]">Balance {Number(course.amount_due ?? 0).toLocaleString()}</p></div></div>
                  <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => void downloadSlip(course, "admission")} disabled={savingAction === `slip-${course.enrollment_id}`} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[var(--border)] px-3 text-sm font-semibold hover:bg-[var(--surface)] disabled:opacity-50"><Download className="h-4 w-4" />Admission slip</button><button type="button" onClick={() => void downloadSlip(course, "advance")} disabled={savingAction === `slip-${course.enrollment_id}`} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[var(--border)] px-3 text-sm font-semibold hover:bg-[var(--surface)] disabled:opacity-50"><Download className="h-4 w-4" />Advance slip</button></div>
                </section>
                <div className="mt-4 divide-y divide-[var(--border)]">
                  {course.sessions.length ? course.sessions.map(item => (
                    <div key={item.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{item.title}</p><p className="mt-0.5 text-xs text-[var(--text-secondary)]">{formatDate(item.scheduled_start)}{item.topic ? ` · ${item.topic}` : ""}</p></div>
                      <div className="flex items-center gap-3 text-xs">
                        {item.attendance_status && <span className="inline-flex items-center gap-1 text-[var(--text-secondary)]"><MapPin className="h-3.5 w-3.5" />{item.attendance_status}</span>}
                        {item.progress.status === "Completed" ? <span className="inline-flex items-center gap-1 text-emerald-800 dark:text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5" />Completed</span> : <span className="text-[var(--text-secondary)]">{item.progress.completion_percent}% complete</span>}
                      </div>
                    </div>
                  )) : <p className="py-3 text-sm text-[var(--text-secondary)]">No class sessions are scheduled yet.</p>}
                </div>
                {course.instructor && <section className="mt-5 rounded-md border border-[var(--border)] p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300"><UserRound className="h-5 w-5" /></span>
                    <div className="min-w-0 flex-1"><h4 className="font-semibold">{course.instructor.name}</h4><p className="mt-0.5 text-xs text-[var(--text-secondary)]">{[course.instructor.qualification, course.instructor.expertise, course.instructor.experience_years ? `${course.instructor.experience_years} years teaching` : null].filter(Boolean).join(" · ") || "Course instructor"}</p>{course.instructor.bio && <p className="mt-2 text-sm text-[var(--text-secondary)]">{course.instructor.bio}</p>}
                      <div className="mt-3 flex flex-wrap gap-2">{course.instructor.email && <a href={`mailto:${course.instructor.email}`} className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-[var(--border)] px-3 text-xs font-semibold"><Mail className="h-3.5 w-3.5" />Email instructor</a>}{course.instructor.phone && <a href={`tel:${course.instructor.phone}`} className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-[var(--border)] px-3 text-xs font-semibold"><Phone className="h-3.5 w-3.5" />Call instructor</a>}</div>
                    </div>
                  </div>
                </section>}
                <section className="mt-5 border-t border-[var(--border)] pt-4">
                  <div className="flex flex-wrap items-center justify-between gap-3"><div><h4 className="flex items-center gap-2 font-semibold"><BookOpen className="h-4 w-4" />Course resources</h4><p className="mt-1 text-xs text-[var(--text-secondary)]">Materials shared by your instructor.</p></div><span className="text-xs text-[var(--text-secondary)]">{course.resources?.length || 0} files</span></div>
                  {course.resources?.length ? <div className="mt-3 divide-y divide-[var(--border)]">{course.resources.map(resource => <div key={resource.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="truncate text-sm font-medium">{resource.title}</p><p className="mt-0.5 text-xs text-[var(--text-secondary)]">{resource.filename} · {Math.max(1, Math.ceil(resource.size_bytes / 1024))} KB{resource.description ? ` · ${resource.description}` : ""}</p></div><button type="button" onClick={() => void downloadResource(resource)} disabled={savingAction === `resource-${resource.id}`} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-[var(--border)] px-3 text-sm font-semibold hover:bg-[var(--background)] disabled:opacity-50"><Download className="h-4 w-4" />{savingAction === `resource-${resource.id}` ? "Downloading" : "Download"}</button></div>)}</div> : <p className="mt-3 rounded-md bg-[var(--background)] px-3 py-3 text-sm text-[var(--text-secondary)]">No resources shared yet.</p>}
                </section>
                <section className="mt-5 border-t border-[var(--border)] pt-4">
                  <div className="flex flex-wrap items-center justify-between gap-3"><div><h4 className="flex items-center gap-2 font-semibold"><Star className="h-4 w-4" />Instructor review</h4><p className="mt-1 text-xs text-[var(--text-secondary)]">Share feedback about your experience.</p></div>{course.review && <span className="text-sm font-semibold text-amber-700 dark:text-amber-300">{"★".repeat(course.review.rating)} · Review submitted</span>}</div>
                  {course.review ? <p className="mt-3 text-sm text-[var(--text-secondary)]">{course.review.feedback_text}</p> : course.instructor && <div className="mt-3 space-y-3">
                    {reviewBatchId === course.batch_id ? <><div className="flex items-center gap-3"><label htmlFor={`rating-${course.batch_id}`} className="text-sm font-medium">Rating</label><select id={`rating-${course.batch_id}`} value={reviewRating} onChange={event => setReviewRating(Number(event.target.value))} className="min-h-10 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 text-sm">{[5,4,3,2,1].map(rating => <option key={rating} value={rating}>{rating} stars</option>)}</select></div><textarea value={reviewText} onChange={event => setReviewText(event.target.value)} rows={3} placeholder="What went well? What could improve?" className="w-full resize-y rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"/><div className="flex flex-wrap justify-end gap-2"><button type="button" onClick={() => setReviewBatchId(null)} className="min-h-10 rounded-md border border-[var(--border)] px-3 text-sm">Cancel</button><button type="button" onClick={() => void submitReview(course)} disabled={!reviewText.trim() || savingAction === `review-${course.batch_id}`} className="inline-flex min-h-10 items-center gap-2 rounded-md bg-emerald-800 px-3 text-sm font-semibold text-white disabled:opacity-50"><Send className="h-4 w-4" />Submit review</button></div></> : <button type="button" onClick={() => { setReviewBatchId(course.batch_id); setReviewRating(5); }} className="min-h-10 rounded-md border border-[var(--border)] px-3 text-sm font-semibold hover:bg-[var(--background)]">Write a review</button>}
                  </div>}
                </section>
              </article>
            ))}
          </div>

          <aside className="space-y-4">
            <h2 className="text-lg font-semibold">At a glance</h2>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
              <p className="text-sm text-[var(--text-secondary)]">Average course progress</p><p className="mt-2 text-3xl font-bold">{averageProgress}<span className="ml-1 text-base font-medium text-[var(--text-secondary)]">%</span></p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--background)]"><div className="h-full bg-sky-700" style={{ width: `${averageProgress}%` }} /></div>
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
              <div className="flex items-center justify-between gap-3"><h3 className="flex items-center gap-2 font-semibold"><MessageSquare className="h-4 w-4" />My comments</h3><span className="text-xs text-[var(--text-secondary)]">{notes.length}</span></div>
              <form className="mt-3 space-y-2" onSubmit={event => { event.preventDefault(); void addComment(); }}><textarea value={comment} onChange={event => setComment(event.target.value)} rows={3} placeholder="Add a note or question for your institute" className="w-full resize-y rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"/><button type="submit" disabled={!comment.trim() || savingAction === "comment"} className="inline-flex min-h-10 items-center gap-2 rounded-md bg-emerald-800 px-3 text-sm font-semibold text-white disabled:opacity-50"><Send className="h-4 w-4" />{savingAction === "comment" ? "Saving" : "Post comment"}</button></form>
              <div className="mt-4 max-h-64 space-y-3 overflow-y-auto">{notes.map(note => <article key={note.id} className="border-l-2 border-emerald-700 pl-3"><p className="whitespace-pre-wrap text-sm">{note.content}</p><p className="mt-1 text-[11px] text-[var(--text-secondary)]">{new Date(note.created_at).toLocaleString()}</p></article>)}{!notes.length && <p className="text-sm text-[var(--text-secondary)]">No comments yet.</p>}</div>
            </div>
            {student && <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5"><h3 className="font-semibold">My profile</h3><dl className="mt-3 space-y-3 text-sm">{[{ label: "Address", value: student.address }, { label: "Education", value: student.education_level }, { label: "Qualification", value: student.qualification }, { label: "GPA", value: student.gpa }, { label: "Career goal", value: student.career_goal }, { label: "Guardian", value: student.guardian_name }, { label: "Guardian phone", value: student.guardian_phone }].map(item => <div key={item.label}><dt className="text-xs text-[var(--text-secondary)]">{item.label}</dt><dd className="mt-0.5 break-words">{item.value || "Not recorded"}</dd></div>)}</dl></div>}
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
              <div className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-amber-700 dark:text-amber-400" /><h3 className="font-semibold">Upcoming classes</h3></div>
              {sessions.filter(item => new Date(item.scheduled_start).getTime() >= Date.now()).sort((a, b) => a.scheduled_start.localeCompare(b.scheduled_start)).slice(0, 4).map(item => <div key={item.id} className="mt-4 border-l-2 border-amber-600 pl-3"><p className="text-sm font-medium">{item.title}</p><p className="mt-1 text-xs text-[var(--text-secondary)]">{formatDate(item.scheduled_start)}</p></div>)}
              {!sessions.some(item => new Date(item.scheduled_start).getTime() >= Date.now()) && <p className="mt-3 text-sm text-[var(--text-secondary)]">Nothing scheduled yet.</p>}
            </div>
          </aside>
        </section>
      )}
    </div>
  );
}