import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from '@/components/AppShell';
import { Dashboard } from '@/pages/Dashboard';
import { Documents } from '@/pages/Documents';
import { DocumentDetail } from '@/pages/DocumentDetail';
import { Borrowers } from '@/pages/Borrowers';
import { BorrowerDetail } from '@/pages/BorrowerDetail';
import { ReviewQueue } from '@/pages/ReviewQueue';

function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/documents/:id" element={<DocumentDetail />} />
        <Route path="/borrowers" element={<Borrowers />} />
        <Route path="/borrowers/:id" element={<BorrowerDetail />} />
        <Route path="/review-queue" element={<ReviewQueue />} />
      </Routes>
    </AppShell>
  );
}

export default App;
