import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import CircularRepositoryPage from "./pages/CircularRepositoryPage.jsx";
import AdminCircularPage from "./pages/AdminCircularPage.jsx";
import TaskPlannerPage from "./pages/TaskPlannerPage.jsx";
import { AssistantProvider } from "./context/AssistantContext.jsx";
import { LanguageProvider } from "./context/LanguageContext.jsx";
import { ToastProvider } from "./context/ToastContext.jsx";
import { ConfirmProvider } from "./context/ConfirmContext.jsx";
import GlobalFloatingAssistant from "./components/GlobalFloatingAssistant.jsx";

function ProtectedRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

function AdminProtectedRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "Admin") return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/planner"
        element={
          <ProtectedRoute>
            <TaskPlannerPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/repository"
        element={
          <ProtectedRoute>
            <CircularRepositoryPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/circulars"
        element={
          <AdminProtectedRoute>
            <AdminCircularPage />
          </AdminProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <ToastProvider>
          <ConfirmProvider>
            <AssistantProvider>
              <AppRoutes />
              <GlobalFloatingAssistant />
            </AssistantProvider>
          </ConfirmProvider>
        </ToastProvider>
      </LanguageProvider>
    </AuthProvider>
  );
}