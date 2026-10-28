import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { WelcomePage } from './pages/WelcomePage';
import { DashboardPage } from './pages/DashboardPage';
import { CaseHistoryPage } from './pages/CaseHistoryPage';
import { InputPage } from './pages/InputPage';
import { ReportPage } from './pages/ReportPage';
import { SketchPage } from './pages/SketchPage';
import { RefinePage } from './pages/RefinePage';
import { SketchOverviewPage } from './pages/SketchOverviewPage';
import { LoginPage } from './pages/LoginPage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<WelcomePage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/cases" element={<CaseHistoryPage />} />
        <Route path="/cases/:id/inputs" element={<InputPage />} />
        <Route path="/cases/:id/report" element={<ReportPage />} />
        <Route path="/cases/:id/sketch" element={<SketchPage />} />
        <Route path="/cases/:id/refine" element={<RefinePage />} />
        <Route path="/cases/:id/overview" element={<SketchOverviewPage />} />
        {/* Fallback to welcome screen */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
