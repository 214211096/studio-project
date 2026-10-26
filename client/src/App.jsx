import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import LoginModal from './components/LoginModal.jsx';
import HealthDeclarationModal from './components/HealthDeclarationModal.jsx';
import SchedulePage from './pages/SchedulePage.jsx';
import MyClassesPage from './pages/MyClassesPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import AdminLayout from './pages/admin/AdminLayout.jsx';
import UsersPage from './pages/admin/UsersPage.jsx';
import TemplatesPage from './pages/admin/TemplatesPage.jsx';
import HolidaysPage from './pages/admin/HolidaysPage.jsx';
import ReportsPage from './pages/admin/ReportsPage.jsx';

function App() {
  const { user, loading, isAdmin } = useAuth();

  if (loading) return <div className="page-loading">טוען...</div>;
  if (!user) return <LoginModal />;
  if (!isAdmin && !user.healthDeclarationSignedAt) return <HealthDeclarationModal />;

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<SchedulePage />} />
        <Route path="my" element={<MyClassesPage />} />
        <Route path="profile" element={<ProfilePage />} />
        {isAdmin && (
          <Route path="admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="users" replace />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="templates" element={<TemplatesPage />} />
            <Route path="holidays" element={<HolidaysPage />} />
            <Route path="reports" element={<ReportsPage />} />
          </Route>
        )}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
