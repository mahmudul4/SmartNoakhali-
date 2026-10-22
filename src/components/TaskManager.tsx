import { useState } from "react";
import {
  CheckCircle2,
  Circle,
  Clock,
  Plus,
  Trash2,
  Wifi,
  WifiOff,
  CloudUpload,
  Check,
  AlertTriangle,
  Calendar,
  User,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { useTasks, useNetworkStatus, type TaskItem } from "@/lib/tasks";
import { useAuth } from "@/lib/auth";

export function TaskManager() {
  const { isOnline } = useNetworkStatus();
  const { tasks, loading, addTask, toggleTaskStatus, deleteTask, updateTask } = useTasks();
  const { isAuthed } = useAuth();

  const [isOpenAddModal, setIsOpenAddModal] = useState(false);
  const [filter, setFilter] = useState<"all" | "todo" | "completed">("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [dueDate, setDueDate] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit task modal state
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("টাস্কের শিরোনাম প্রদান করুন");
      return;
    }

    setIsSubmitting(true);
    try {
      await addTask({
        title,
        description,
        priority,
        dueDate,
        assignedTo,
      });

      toast.success(
        isOnline
          ? "টাস্ক সফলভাবে তৈরি হয়েছে"
          : "অফলাইনে সংরক্ষিত হয়েছে! ইন্টারনেট পেলে স্বয়ংক্রিয়ভাবে সিঙ্ক হবে"
      );

      setTitle("");
      setDescription("");
      setPriority("medium");
      setDueDate("");
      setAssignedTo("");
      setIsOpenAddModal(false);
    } catch (err) {
      console.error(err);
      toast.error("টাস্ক তৈরি করতে ত্রুটি হয়েছে");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask || !editingTask.title.trim()) return;

    try {
      await updateTask(editingTask.id, {
        title: editingTask.title,
        description: editingTask.description,
        priority: editingTask.priority,
        dueDate: editingTask.dueDate,
        assignedTo: editingTask.assignedTo,
        status: editingTask.status,
      });

      toast.success(
        isOnline
          ? "টাস্ক আপডেট হয়েছে"
          : "অফলাইনে আপডেট সংরক্ষিত হয়েছে! পরে ক্লাউডে সিঙ্ক হবে"
      );
      setEditingTask(null);
    } catch {
      toast.error("টাস্ক আপডেট ব্যর্থ হয়েছে");
    }
  };

  const handleToggle = async (task: TaskItem) => {
    try {
      await toggleTaskStatus(task.id, task.status);
      toast.info(
        task.status === "completed"
          ? "টাস্ক পুনরায় শুরু করা হয়েছে"
          : "টাস্ক সম্পন্ন হিসেবে চিহ্নিত হয়েছে"
      );
    } catch {
      toast.error("স্ট্যাটাস আপডেট ব্যর্থ হয়েছে");
    }
  };

  const handleDelete = async (taskId: string) => {
    if (!confirm("আপনি কি নিশ্চিতভাবে এই টাস্কটি ডিলিট করতে চান?")) return;
    try {
      await deleteTask(taskId);
      toast.success("টাস্ক ডিলিট করা হয়েছে");
    } catch {
      toast.error("টাস্ক ডিলিট করা যায়নি");
    }
  };

  const filteredTasks = tasks.filter((t) => {
    if (filter === "todo" && t.status === "completed") return false;
    if (filter === "completed" && t.status !== "completed") return false;
    if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
    return true;
  });

  const pendingCount = tasks.filter((t) => t.hasPendingWrites).length;

  return (
    <div className="w-full space-y-4">
      {/* Offline Status Banner */}
      <div
        className={`flex items-center justify-between rounded-2xl p-4 transition-all ${
          isOnline
            ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
            : "border border-amber-500/30 bg-amber-500/15 text-amber-900 dark:text-amber-200"
        }`}
      >
        <div className="flex items-center gap-3">
          {isOnline ? (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-600">
              <Wifi className="h-5 w-5" />
            </div>
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-600 animate-pulse">
              <WifiOff className="h-5 w-5" />
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm">
                {isOnline ? "অনলাইন মোড (Online)" : "অফলাইন ডেটা পারসিস্টেন্স মোড (Offline Mode)"}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  isOnline
                    ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                    : "bg-amber-500/30 text-amber-800 dark:text-amber-200"
                }`}
              >
                {isOnline ? "লাইভ সিঙ্ক" : "ক্যাশ থেকে চলছে"}
              </span>
            </div>
            <p className="text-xs opacity-90 mt-0.5">
              {isOnline
                ? "Firestore IndexedDB লোকাল পারসিস্টেন্স সক্রিয়। ইন্টারনেট সংযোগ বন্ধ থাকলেও টাস্ক যোগ ও পরিবর্তন করা যাবে।"
                : "ইন্টারনেট নেই। আপনি নিশ্চিন্তে টাস্ক যোগ ও এডিট করতে পারেন—সব তথ্য ডিভাইসের লোকাল স্টোরেজে সংরক্ষিত থাকবে এবং ইন্টারনেট পেলে অটো সিঙ্ক হবে।"}
            </p>
          </div>
        </div>

        {pendingCount > 0 && (
          <div className="flex items-center gap-1.5 rounded-xl bg-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-800 dark:text-amber-200">
            <CloudUpload className="h-4 w-4 animate-bounce" />
            <span>{pendingCount}টি টাস্ক সিঙ্ক অপেক্ষমান</span>
          </div>
        )}
      </div>

      {/* Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-4 rounded-2xl border border-border shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <span>টাস্ক ও কর্মসূচি তালিকা</span>
            <span className="rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-semibold">
              মোট: {tasks.length}
            </span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            অফলাইন ও অনলাইন উভয় অবস্থায় সম্পূর্ণ কার্যকরী
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsOpenAddModal(true)}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 active:scale-95"
          >
            <Plus className="h-4 w-4" />
            <span>নতুন টাস্ক তৈরি করুন</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-xl border border-border text-xs">
          <button
            onClick={() => setFilter("all")}
            className={`rounded-lg px-3 py-1.5 transition ${
              filter === "all"
                ? "bg-background text-foreground font-semibold shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            সব ({tasks.length})
          </button>
          <button
            onClick={() => setFilter("todo")}
            className={`rounded-lg px-3 py-1.5 transition ${
              filter === "todo"
                ? "bg-background text-foreground font-semibold shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            চলমান ({tasks.filter((t) => t.status !== "completed").length})
          </button>
          <button
            onClick={() => setFilter("completed")}
            className={`rounded-lg px-3 py-1.5 transition ${
              filter === "completed"
                ? "bg-background text-foreground font-semibold shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            সম্পন্ন ({tasks.filter((t) => t.status === "completed").length})
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs text-foreground outline-none"
          >
            <option value="all">সব অগ্রাধিকার (Priority)</option>
            <option value="high">জরুরি (High)</option>
            <option value="medium">সাধারণ (Medium)</option>
            <option value="low">কম জরুরি (Low)</option>
          </select>
        </div>
      </div>

      {/* Task List */}
      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          টাস্কসমূহ লোড হচ্ছে...
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-muted-foreground/50 mb-2" />
          <p className="text-sm font-semibold text-foreground">কোনো টাস্ক পাওয়া যায়নি</p>
          <p className="text-xs text-muted-foreground mt-1">
            "নতুন টাস্ক তৈরি করুন" বাটনে ক্লিক করে অফলাইনে বা অনলাইনে টাস্ক যোগ করুন।
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredTasks.map((task) => {
            const isCompleted = task.status === "completed";
            return (
              <div
                key={task.id}
                className={`group flex items-start justify-between gap-3 rounded-2xl border p-3.5 transition-all ${
                  isCompleted
                    ? "border-border/60 bg-muted/20 opacity-75"
                    : "border-border bg-card hover:border-primary/40 shadow-sm"
                }`}
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <button
                    onClick={() => handleToggle(task)}
                    className="mt-0.5 shrink-0 rounded-full text-muted-foreground hover:text-primary transition"
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    ) : (
                      <Circle className="h-5 w-5" />
                    )}
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3
                        className={`text-sm font-semibold text-foreground ${
                          isCompleted ? "line-through text-muted-foreground" : ""
                        }`}
                      >
                        {task.title}
                      </h3>

                      {/* Priority Tag */}
                      <span
                        className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                          task.priority === "high"
                            ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                            : task.priority === "medium"
                            ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                            : "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                        }`}
                      >
                        {task.priority === "high"
                          ? "জরুরি"
                          : task.priority === "medium"
                          ? "সাধারণ"
                          : "কম জরুরি"}
                      </span>

                      {/* Sync Indicator */}
                      {task.hasPendingWrites ? (
                        <span className="flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                          <CloudUpload className="h-3 w-3 animate-spin" />
                          <span>সিঙ্ক পেন্ডিং (অফলাইন)</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                          <Check className="h-3 w-3" />
                          <span>সিঙ্কড</span>
                        </span>
                      )}
                    </div>

                    {task.description && (
                      <p className="mt-1 text-xs text-muted-foreground whitespace-pre-line line-clamp-2">
                        {task.description}
                      </p>
                    )}

                    <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                      {task.dueDate && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 text-primary/70" />
                          <span>মেয়াদ: {task.dueDate}</span>
                        </span>
                      )}
                      {task.assignedTo && (
                        <span className="flex items-center gap-1">
                          <User className="h-3.5 w-3.5 text-primary/70" />
                          <span>দায়িত্বে: {task.assignedTo}</span>
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        <span>{new Date(task.createdAt).toLocaleDateString("bn-BD")}</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100">
                  <button
                    onClick={() => setEditingTask(task)}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground text-xs"
                    title="টাস্ক সম্পাদনা"
                  >
                    সম্পাদনা
                  </button>
                  <button
                    onClick={() => handleDelete(task.id)}
                    className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-500/10 text-xs"
                    title="টাস্ক ডিলিট"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Task Modal */}
      {isOpenAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-lg font-bold text-foreground mb-1">নতুন টাস্ক তৈরি করুন</h3>
            <p className="text-xs text-muted-foreground mb-4">
              ইন্টারনেট সংযোগ না থাকলেও টাস্কটি ডিভাইসে সেভ থাকবে।
            </p>

            <form onSubmit={handleCreateTask} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-foreground">শিরোনাম *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="যেমন: নোয়াখালী সদর হাসপাতাল তথ্য আপডেট"
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">বিবরণ (ঐচ্ছিক)</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="টাস্কের বিস্তারিত নোট লিখুন..."
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground">অগ্রাধিকার</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as "low" | "medium" | "high")}
                    className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                  >
                    <option value="high">জরুরি (High)</option>
                    <option value="medium">সাধারণ (Medium)</option>
                    <option value="low">কম জরুরি (Low)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground">মেয়াদ / তারিখ</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">দায়িত্বপ্রাপ্ত ব্যক্তি</label>
                <input
                  type="text"
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  placeholder="যেমন: এডমিন বা এডিটর এর নাম"
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsOpenAddModal(false)}
                  className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {isSubmitting ? "সংরক্ষণ হচ্ছে..." : "টাস্ক যোগ করুন"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Task Modal */}
      {editingTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-lg font-bold text-foreground mb-1">টাস্ক সম্পাদনা</h3>
            <p className="text-xs text-muted-foreground mb-4">
              পরিবর্তনসমূহ অফলাইনে সাথে সাথে সেভ হবে এবং পরে ক্লাউডে সিঙ্ক হবে।
            </p>

            <form onSubmit={handleUpdateTask} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-foreground">শিরোনাম *</label>
                <input
                  type="text"
                  required
                  value={editingTask.title}
                  onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">বিবরণ</label>
                <textarea
                  rows={3}
                  value={editingTask.description || ""}
                  onChange={(e) =>
                    setEditingTask({ ...editingTask, description: e.target.value })
                  }
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground">স্ট্যাটাস</label>
                  <select
                    value={editingTask.status}
                    onChange={(e) =>
                      setEditingTask({
                        ...editingTask,
                        status: e.target.value as "todo" | "in_progress" | "completed",
                      })
                    }
                    className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                  >
                    <option value="todo">চলমান (To-Do)</option>
                    <option value="in_progress">প্রক্রিয়াধীন (In Progress)</option>
                    <option value="completed">সম্পন্ন (Completed)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground">অগ্রাধিকার</label>
                  <select
                    value={editingTask.priority}
                    onChange={(e) =>
                      setEditingTask({
                        ...editingTask,
                        priority: e.target.value as "low" | "medium" | "high",
                      })
                    }
                    className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                  >
                    <option value="high">জরুরি (High)</option>
                    <option value="medium">সাধারণ (Medium)</option>
                    <option value="low">কম জরুরি (Low)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground">মেয়াদ</label>
                  <input
                    type="date"
                    value={editingTask.dueDate || ""}
                    onChange={(e) => setEditingTask({ ...editingTask, dueDate: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground">দায়িত্বপ্রাপ্ত</label>
                  <input
                    type="text"
                    value={editingTask.assignedTo || ""}
                    onChange={(e) => setEditingTask({ ...editingTask, assignedTo: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingTask(null)}
                  className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  আপডেট সংরক্ষণ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
