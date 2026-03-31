import StatCard from "../components/StatCard";
import FleetChart from "../components/FleetChart";
import LobChart from "../components/LobChart";
import SubmissionsTable from "../components/SubmissionsTable";
import { useSummary, useExposures, useSubmissions } from "../api/hooks";

export default function Dashboard() {
  const { data: summaryRes } = useSummary();
  const { data: exposuresRes } = useExposures();
  const { data: subsRes } = useSubmissions({ limit: 100 });

  const summary = summaryRes?.data;
  const exposures = exposuresRes?.data ?? [];
  const allSubs = subsRes?.data ?? [];

  const totalFleet = exposures.reduce(
    (acc, e) => acc + (e.numberOfTrucks || 0),
    0,
  );
  const totalLosses = allSubs.reduce(
    (acc, s) => acc + (s.losses?.length || 0),
    0,
  );
  const emailCount = allSubs.filter((s) =>
    s.sourceFile.toLowerCase().endsWith(".eml"),
  ).length;
  const pdfCount = allSubs.length - emailCount;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-gold">Dashboard</h1>
        <p className="text-sm text-muted mt-1">
          Overview of all ingested email submissions
        </p>
      </div>

      <div className="grid grid-cols-5 gap-4">
        <StatCard
          label="Total Submissions"
          value={summary?.totalSubmissions ?? "--"}
          detail={
            allSubs.length ? `${emailCount} emails, ${pdfCount} PDFs` : undefined
          }
          accentColor="gold"
        />
        <StatCard
          label="Lines of Business"
          value={summary?.linesOfBusiness.length ?? "--"}
          accentColor="sky"
        />
        <StatCard
          label="Brokers"
          value={summary?.brokers.length ?? "--"}
          accentColor="success"
        />
        <StatCard
          label="Total Fleet Units"
          value={totalFleet || "--"}
          accentColor="danger"
        />
        <StatCard
          label="Loss Records"
          value={totalLosses || "--"}
          accentColor="violet"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-dark-card border border-dark-border rounded-lg p-5">
          <h3 className="font-display text-base text-muted mb-3">
            Fleet Size by Submission
          </h3>
          <FleetChart exposures={exposures} />
        </div>
        <div className="bg-dark-card border border-dark-border rounded-lg p-5">
          <h3 className="font-display text-base text-muted mb-3">
            Lines of Business Distribution
          </h3>
          <LobChart linesOfBusiness={summary?.linesOfBusiness ?? []} />
        </div>
      </div>

      <SubmissionsTable />
    </div>
  );
}
