import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from '@/components/AppShell';
import { Dashboard } from '@/pages/Dashboard';
import { Documents } from '@/pages/Documents';
import { Borrowers } from '@/pages/Borrowers';
import { BorrowerDetail } from '@/pages/BorrowerDetail';

function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/borrowers" element={<Borrowers />} />
        <Route path="/borrowers/:id" element={<BorrowerDetail />} />
      </Routes>
    </AppShell>
  );
}

export default App;
