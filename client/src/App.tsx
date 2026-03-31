import { Routes, Route } from "react-router-dom";
import AppLayout from "./layouts/AppLayout";
import Dashboard from "./pages/Dashboard";
import SubmissionDetail from "./pages/SubmissionDetail";
import IngestPage from "./pages/IngestPage";

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/submissions/:id" element={<SubmissionDetail />} />
        <Route path="/ingest" element={<IngestPage />} />
      </Route>
    </Routes>
  );
}
