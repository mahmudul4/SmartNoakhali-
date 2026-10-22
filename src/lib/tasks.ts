import { useState, useEffect, useCallback } from "react";
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db, auth, OperationType, handleFirestoreError } from "@/lib/firebase";

export interface TaskItem {
  id: string;
  title: string;
  description?: string;
  status: "todo" | "in_progress" | "completed";
  priority: "low" | "medium" | "high";
  dueDate?: string;
  assignedTo?: string;
  assignedToEmail?: string;
  createdByUid: string;
  createdByEmail: string;
  createdAt: string;
  updatedAt: string;
  // Local metadata indicators from persistent cache
  hasPendingWrites?: boolean;
  fromCache?: boolean;
}

/**
 * Hook to track whether the browser is online or offline.
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return { isOnline };
}

/**
 * Real-time hook for tasks with IndexedDB offline data persistence support.
 * Works seamlessly whether online or offline.
 */
export function useTasks() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const q = query(collection(db, "tasks"), orderBy("createdAt", "desc"));

      // includeMetadataChanges: true allows us to immediately see offline writes
      const unsubscribe = onSnapshot(
        q,
        { includeMetadataChanges: true },
        (snapshot) => {
          const items: TaskItem[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            items.push({
              id: docSnap.id,
              title: data.title || "",
              description: data.description || "",
              status: data.status || "todo",
              priority: data.priority || "medium",
              dueDate: data.dueDate || "",
              assignedTo: data.assignedTo || "",
              assignedToEmail: data.assignedToEmail || "",
              createdByUid: data.createdByUid || "",
              createdByEmail: data.createdByEmail || "",
              createdAt:
                typeof data.createdAt === "string"
                  ? data.createdAt
                  : data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
              updatedAt:
                typeof data.updatedAt === "string"
                  ? data.updatedAt
                  : data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
              hasPendingWrites: docSnap.metadata.hasPendingWrites,
              fromCache: docSnap.metadata.fromCache,
            });
          });
          setTasks(items);
          setLoading(false);
          setError(null);
        },
        (err) => {
          console.warn("[Tasks] onSnapshot error:", err);
          setError("টাস্ক লোড করতে সমস্যা হয়েছে");
          setLoading(false);
        }
      );

      return () => unsubscribe();
    } catch (err) {
      console.warn("[Tasks] Failed to initialize task listener:", err);
      setLoading(false);
    }
  }, []);

  const addTask = useCallback(
    async (task: {
      title: string;
      description?: string;
      priority?: "low" | "medium" | "high";
      dueDate?: string;
      assignedTo?: string;
      assignedToEmail?: string;
    }) => {
      const user = auth.currentUser;
      const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const now = new Date().toISOString();

      const newTaskDoc = {
        id: taskId,
        title: task.title.trim(),
        description: task.description?.trim() || "",
        status: "todo" as const,
        priority: task.priority || "medium",
        dueDate: task.dueDate || "",
        assignedTo: task.assignedTo?.trim() || "",
        assignedToEmail: task.assignedToEmail?.trim() || "",
        createdByUid: user?.uid || "offline_user",
        createdByEmail: user?.email || "offline@smartnoakhali.com",
        createdAt: now,
        updatedAt: now,
        serverCreatedAt: serverTimestamp(),
        serverUpdatedAt: serverTimestamp(),
      };

      try {
        // Writes immediately to local IndexedDB cache even when completely offline
        await setDoc(doc(db, "tasks", taskId), newTaskDoc);
        return taskId;
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `tasks/${taskId}`);
      }
    },
    []
  );

  const updateTask = useCallback(
    async (
      taskId: string,
      updates: Partial<{
        title: string;
        description: string;
        status: "todo" | "in_progress" | "completed";
        priority: "low" | "medium" | "high";
        dueDate: string;
        assignedTo: string;
        assignedToEmail: string;
      }>
    ) => {
      const now = new Date().toISOString();
      try {
        await updateDoc(doc(db, "tasks", taskId), {
          ...updates,
          updatedAt: now,
          serverUpdatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `tasks/${taskId}`);
      }
    },
    []
  );

  const toggleTaskStatus = useCallback(
    async (taskId: string, currentStatus: "todo" | "in_progress" | "completed") => {
      const nextStatus = currentStatus === "completed" ? "todo" : "completed";
      await updateTask(taskId, { status: nextStatus });
    },
    [updateTask]
  );

  const deleteTask = useCallback(async (taskId: string) => {
    try {
      await deleteDoc(doc(db, "tasks", taskId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `tasks/${taskId}`);
    }
  }, []);

  return {
    tasks,
    loading,
    error,
    addTask,
    updateTask,
    toggleTaskStatus,
    deleteTask,
  };
}
