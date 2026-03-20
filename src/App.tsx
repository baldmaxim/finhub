import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { ActualExecutionPageWrapper } from './pages/ActualExecutionPageWrapper';
import { BddsPageWrapper } from './pages/BddsPageWrapper';
import { BdrPageWrapper } from './pages/BdrPageWrapper';
import { BblPageWrapper } from './pages/BblPageWrapper';
import { DashboardPageWrapper } from './pages/DashboardPageWrapper';
import { AdminUsersPageWrapper } from './pages/AdminUsersPageWrapper';
import { AdminProjectsPageWrapper } from './pages/AdminProjectsPageWrapper';
import { BddsIncomePageWrapper } from './pages/BddsIncomePageWrapper';
import { BddsReceiptsPageWrapper } from './pages/BddsReceiptsPageWrapper';
import { GuaranteePageWrapper } from './pages/GuaranteePageWrapper';

export const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/actual-execution" element={<ActualExecutionPageWrapper />} />
          <Route path="/bdds" element={<BddsPageWrapper />} />
          <Route path="/bdds/income" element={<BddsIncomePageWrapper />} />
          <Route path="/bdds/receipts" element={<BddsReceiptsPageWrapper />} />
          <Route path="/guarantee" element={<GuaranteePageWrapper />} />
          <Route path="/bdr" element={<BdrPageWrapper />} />
          <Route path="/bbl" element={<BblPageWrapper />} />
          <Route path="/dashboards" element={<DashboardPageWrapper />} />
          <Route path="/admin/users" element={<AdminUsersPageWrapper />} />
          <Route path="/admin/projects" element={<AdminProjectsPageWrapper />} />
          <Route path="/" element={<Navigate to="/bdds" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
