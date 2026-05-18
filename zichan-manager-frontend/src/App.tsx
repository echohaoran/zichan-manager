import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import AppLayout from './components/AppLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Assets from './pages/Assets';
import Categories from './pages/Categories';
import Reports from './pages/Reports';
import Persons from './pages/Persons';
import Departments from './pages/Departments';
import Users from './pages/Users';
import FeishuCallback from './pages/FeishuCallback';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('token');
  return token ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <ConfigProvider locale={zhCN}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/login/feishu/callback" element={<FeishuCallback />} />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <AppLayout />
              </PrivateRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="assets" element={<Assets />} />
            <Route path="categories" element={<Categories />} />
            <Route path="reports" element={<Reports />} />
            <Route path="persons" element={<Persons />} />
            <Route path="departments" element={<Departments />} />
            <Route path="users" element={<Users />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}
