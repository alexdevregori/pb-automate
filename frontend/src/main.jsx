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
import Picker from './pages/Picker';
import Configure from './pages/Configure';
import Deploy from './pages/Deploy';
import Success from './pages/Success';

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

            {/* Legacy wizard routes — retired in Task 6 */}
            <Route path="/picker" element={<Picker />} />
            <Route path="/configure" element={<Configure />} />
            <Route path="/deploy" element={<Deploy />} />
            <Route path="/success" element={<Success />} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </>
  </React.StrictMode>
);
