import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import client from "../api/client.js";
import { useLanguage } from "../context/LanguageContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";

export function useDashboard() {
  const { language } = useLanguage();
  const { user } = useAuth();
  return useQuery({
    queryKey: ["dashboard", language],
    queryFn: () => client.get("/dashboard/summary").then((r) => r.data),
    enabled: !!user,
  });
}

export function useWellness() {
  const { language } = useLanguage();
  const { user } = useAuth();
  return useQuery({
    queryKey: ["wellness", language],
    queryFn: () => client.get("/wellness/today").then((r) => r.data),
    enabled: !!user,
  });
}

export function useDailyBriefing() {
  const { language } = useLanguage();
  const { user } = useAuth();
  return useQuery({
    queryKey: ["dailyBriefing", language],
    queryFn: () => client.get("/dashboard/summary").then((r) => r.data.briefing),
    enabled: !!user,
  });
}

export function useGreeting() {
  const { language } = useLanguage();
  const { user } = useAuth();
  return useQuery({
    queryKey: ["motivation", language],
    queryFn: () => client.get("/dashboard/summary").then((r) => r.data),
    enabled: !!user,
  });
}

export function useAssistant() {
  const { language } = useLanguage();
  const { user } = useAuth();
  return useQuery({
    queryKey: ["assistant", language],
    queryFn: () => client.get("/circulars").then((r) => r.data),
    enabled: !!user,
  });
}

export function useTasks(activeTab) {
  const { language } = useLanguage();
  const { user } = useAuth();
  return useQuery({
    queryKey: ["tasks", activeTab, language],
    queryFn: () => {
      let endpoint = "/tasks";
      if (activeTab === "today") endpoint = "/tasks/today";
      else if (activeTab === "upcoming") endpoint = "/tasks/upcoming";
      else if (activeTab === "overdue") endpoint = "/tasks/overdue";
      return client.get(endpoint).then((r) => r.data);
    },
    enabled: !!user,
  });
}

export function useMeetings() {
  const { language } = useLanguage();
  const { user } = useAuth();
  return useQuery({
    queryKey: ["meetings", language],
    queryFn: async () => {
      const res = await client.get("/meetings");
      let data = res.data;
      
      let todayMeetings = [];
      let upcomingMeetings = [];

      if (data && (Array.isArray(data.todayMeetings) || Array.isArray(data.upcomingMeetings))) {
        todayMeetings = data.todayMeetings || [];
        upcomingMeetings = data.upcomingMeetings || [];
      } else if (Array.isArray(data)) {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

        for (const m of data) {
          const mDate = new Date(m.startTime || m.dueDate);
          if (mDate >= startOfToday && mDate <= endOfToday) {
            todayMeetings.push({ ...m, meetingType: "today" });
          } else if (mDate > endOfToday) {
            upcomingMeetings.push({ ...m, meetingType: "upcoming" });
          }
        }
      }

      const allMeetings = [...todayMeetings, ...upcomingMeetings].sort((a, b) => {
        const timeA = new Date(a.startTime || a.dueDate).getTime();
        const timeB = new Date(b.startTime || b.dueDate).getTime();
        return timeA - timeB;
      });

      return {
        todayMeetings,
        upcomingMeetings,
        allMeetings
      };
    },
    enabled: !!user,
  });
}

export function useCirculars() {
  const { language } = useLanguage();
  const { user } = useAuth();
  return useQuery({
    queryKey: ["circulars", language],
    queryFn: () => client.get("/circulars").then((r) => r.data),
    enabled: !!user,
  });
}

export function useCircularsFeed() {
  const { language } = useLanguage();
  const { user } = useAuth();
  return useQuery({
    queryKey: ["circularsFeed", language],
    queryFn: () => client.get("/circulars/feed").then((r) => r.data),
    enabled: !!user,
  });
}

export function useSuggestedPrompts(circularId) {
  const { language } = useLanguage();
  const { user } = useAuth();
  return useQuery({
    queryKey: ["suggestedPrompts", circularId, language],
    queryFn: () => client.post("/assistant/suggestions", { circularId: circularId || null }).then((r) => r.data?.suggestions || r.data?.options || []),
    enabled: !!user,
  });
}

export function useProfile() {
  const { language } = useLanguage();
  const { user } = useAuth();
  return useQuery({
    queryKey: ["profile", language],
    queryFn: () => client.get("/profile").then((r) => r.data),
    enabled: !!user,
  });
}

// MUTATIONS

export function useCreateTaskMutation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (payload) => client.post("/tasks", payload).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["dailyBriefing"] });
      toast.success("toast.task.created");
    },
    onError: (err) => {
      toast.error(err);
    },
  });
}

export function useUpdateTaskStatusMutation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: ({ taskId, status }) => client.patch(`/tasks/${taskId}/status`, { status }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["dailyBriefing"] });
    },
    onError: (err) => {
      toast.error(err);
    },
  });
}

export function useDeleteTaskMutation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (taskId) => client.delete(`/tasks/${taskId}`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["dailyBriefing"] });
      toast.success("toast.task.deleted");
    },
    onError: (err) => {
      toast.error(err);
    },
  });
}

export function useCreateMeetingMutation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (payload) => client.post("/meetings", payload).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["dailyBriefing"] });
      toast.success("toast.meeting.created");
    },
    onError: (err) => {
      toast.error(err);
    },
  });
}

export function useDeleteMeetingMutation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (meetId) => client.delete(`/meetings/${meetId}`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["dailyBriefing"] });
      toast.success("toast.meeting.deleted");
    },
    onError: (err) => {
      toast.error(err);
    },
  });
}

export function useWellnessCheckinMutation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (formData) => client.post("/wellness/checkin", formData).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wellness"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["dailyBriefing"] });
      queryClient.invalidateQueries({ queryKey: ["motivation"] });
      toast.success("toast.wellness.submitted");
    },
    onError: (err) => {
      toast.error(err);
    },
  });
}

export function useWellnessSkipMutation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: () => client.post("/wellness/skip").then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wellness"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["dailyBriefing"] });
      queryClient.invalidateQueries({ queryKey: ["motivation"] });
      toast.success("toast.wellness.skipped");
    },
    onError: (err) => {
      toast.error(err);
    },
  });
}

export function useUploadCircularMutation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (formData) => client.post("/circulars/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }).then((r) => r.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["circulars"] });
      queryClient.invalidateQueries({ queryKey: ["assistant"] });
      queryClient.invalidateQueries({ queryKey: ["suggestedPrompts"] });
      toast.success(data?.message || "toast.circular.uploadCompleted");
    },
    onError: (err) => {
      toast.error(err);
    },
  });
}

export function useDeleteCircularMutation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (id) => client.delete(`/circulars/${id}`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["circulars"] });
      queryClient.invalidateQueries({ queryKey: ["assistant"] });
      queryClient.invalidateQueries({ queryKey: ["suggestedPrompts"] });
      toast.success("toast.circular.deleted");
    },
    onError: (err) => {
      toast.error(err);
    },
  });
}

export function useReprocessCircularMutation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (id) => client.post(`/circulars/${id}/reprocess`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["circulars"] });
      queryClient.invalidateQueries({ queryKey: ["assistant"] });
      toast.success("toast.circular.reprocessStarted");
    },
    onError: (err) => {
      toast.error(err);
    },
  });
}

export function useEditCircularMetadataMutation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: ({ id, payload }) => client.patch(`/circulars/${id}/metadata`, payload).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["circulars"] });
      queryClient.invalidateQueries({ queryKey: ["assistant"] });
      toast.success("toast.circular.updated");
    },
    onError: (err) => {
      toast.error(err);
    },
  });
}
