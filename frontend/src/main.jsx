import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import './index.css';
import Login from './pages/Login';
import AppLayout from './components/AppLayout';
import Dashboard from './pages/Dashboard';
import Activity from './pages/Activity';
import Settings from './pages/Settings';
import ScriptNew from './pages/ScriptNew';
import ScriptDetail from './pages/ScriptDetail';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />

          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/activity" element={<Activity />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/scripts/new" element={<ScriptNew />} />
            <Route path="/scripts/:id" element={<ScriptDetail />} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </>
  </React.StrictMode>
);
