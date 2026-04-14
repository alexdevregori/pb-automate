import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import Login from './pages/Login';
import Picker from './pages/Picker';
import Configure from './pages/Configure';
import Deploy from './pages/Deploy';
import Success from './pages/Success';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/picker" element={<Picker />} />
        <Route path="/configure" element={<Configure />} />
        <Route path="/deploy" element={<Deploy />} />
        <Route path="/success" element={<Success />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
