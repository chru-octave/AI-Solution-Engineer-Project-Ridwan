import { useParams, useNavigate } from "react-router-dom";
import { useSubmission } from "../api/hooks";
import SourceBadge from "../components/SourceBadge";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-dark-card border border-dark-border rounded-lg p-5">
      <h3 className="text-[0.7rem] uppercase tracking-widest text-gold font-semibold mb-4 font-body">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <dt className="text-[0.7rem] text-muted uppercase tracking-wide mb-0.5">
        {label}
      </dt>
      <dd className="text-sm text-light">{value ?? "\u2014"}</dd>
    </div>
  );
}

export default function SubmissionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, isError, error } = useSubmission(id!);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted text-sm">
        Loading submission...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center py-16 text-danger text-sm">
        Error: {(error as Error).message}
      </div>
    );
  }

  const s = data!.data;
  const displayName =
    s.insured?.companyName || s.emailSubject || s.sourceFile;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate("/")}
          className="text-muted hover:text-light transition-colors text-sm flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="font-display text-2xl text-light">{displayName}</h1>
            <SourceBadge sourceFile={s.sourceFile} />
          </div>
          <p className="text-sm text-muted">
            {s.sourceFile}
            {s.emailDate &&
              ` \u00B7 ${new Date(s.emailDate).toLocaleDateString()}`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Section title="Source Info">
          <dl className="space-y-3">
            <Field label="File" value={s.sourceFile} />
            {s.emailFrom && <Field label="From" value={s.emailFrom} />}
            {s.emailTo && <Field label="To" value={s.emailTo} />}
            {s.emailSubject && <Field label="Subject" value={s.emailSubject} />}
            {s.emailDate && (
              <Field
                label="Date"
                value={new Date(s.emailDate).toLocaleString()}
              />
            )}
          </dl>
        </Section>

        <Section title="Insured">
          {s.insured ? (
            <dl className="space-y-3">
              <Field label="Company" value={s.insured.companyName} />
              <Field label="Contact" value={s.insured.contactName} />
              <Field label="Address" value={s.insured.mailingAddress} />
              <Field label="State" value={s.insured.state} />
              <Field label="DOT #" value={s.insured.dotNumber} />
              <Field label="MC #" value={s.insured.mcNumber} />
              <Field
                label="Years in Business"
                value={s.insured.yearsInBusiness}
              />
            </dl>
          ) : (
            <p className="text-sm text-muted">No insured data</p>
          )}
        </Section>

        <Section title="Broker">
          {s.broker ? (
            <dl className="space-y-3">
              <Field label="Agency" value={s.broker.companyName} />
              <Field label="Contact" value={s.broker.contactName} />
              <Field label="Email" value={s.broker.email} />
              <Field label="Phone" value={s.broker.phone} />
            </dl>
          ) : (
            <p className="text-sm text-muted">No broker data</p>
          )}
        </Section>
      </div>

      <Section title="Exposure Details">
        {s.exposures ? (
          <div className="grid grid-cols-4 gap-x-8 gap-y-4">
            <Field label="Trucks" value={s.exposures.numberOfTrucks} />
            <Field label="Drivers" value={s.exposures.numberOfDrivers} />
            <Field label="Trailers" value={s.exposures.numberOfTrailers} />
            <Field label="Radius" value={s.exposures.radius} />
            <Field label="Annual Revenue" value={s.exposures.annualRevenue} />
            <Field label="Annual Mileage" value={s.exposures.annualMileage} />
            <Field
              label="Operating States"
              value={
                s.exposures.operatingStates?.length
                  ? s.exposures.operatingStates.join(", ")
                  : null
              }
            />
            <Field
              label="Vehicle Types"
              value={
                s.exposures.vehicleTypes?.length
                  ? s.exposures.vehicleTypes.join(", ")
                  : null
              }
            />
            <Field
              label="Commodities"
              value={
                s.exposures.commodities?.length
                  ? s.exposures.commodities.join(", ")
                  : null
              }
            />
          </div>
        ) : (
          <p className="text-sm text-muted">No exposure data</p>
        )}
      </Section>

      {s.linesOfBusiness.length > 0 && (
        <Section title="Lines of Business">
          <div className="flex flex-wrap gap-2">
            {s.linesOfBusiness.map((l) => (
              <span
                key={l.id}
                className="bg-dark-bg border border-dark-border rounded px-3 py-1 text-sm text-sky"
              >
                {l.type}
              </span>
            ))}
          </div>
        </Section>
      )}

      {s.limits.length > 0 && (
        <Section title="Limits Requested">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[0.7rem] uppercase tracking-wider text-muted">
                  <th className="pb-2 pr-4">Line</th>
                  <th className="pb-2 pr-4">Limit</th>
                  <th className="pb-2 pr-4">Deductible</th>
                  <th className="pb-2">Description</th>
                </tr>
              </thead>
              <tbody className="text-light">
                {s.limits.map((l) => (
                  <tr key={l.id} className="border-t border-dark-border">
                    <td className="py-2 pr-4 text-muted">
                      {l.lineOfBusiness || "\u2014"}
                    </td>
                    <td className="py-2 pr-4">{l.limitAmount || "\u2014"}</td>
                    <td className="py-2 pr-4">{l.deductible || "\u2014"}</td>
                    <td className="py-2 text-muted">
                      {l.description || "\u2014"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {s.targetPricing.length > 0 && (
        <Section title="Target Pricing">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[0.7rem] uppercase tracking-wider text-muted">
                  <th className="pb-2 pr-4">Line</th>
                  <th className="pb-2 pr-4">Target Premium</th>
                  <th className="pb-2 pr-4">Current Premium</th>
                  <th className="pb-2">Description</th>
                </tr>
              </thead>
              <tbody className="text-light">
                {s.targetPricing.map((p) => (
                  <tr key={p.id} className="border-t border-dark-border">
                    <td className="py-2 pr-4 text-muted">
                      {p.lineOfBusiness || "\u2014"}
                    </td>
                    <td className="py-2 pr-4">{p.targetPremium || "\u2014"}</td>
                    <td className="py-2 pr-4">
                      {p.currentPremium || "\u2014"}
                    </td>
                    <td className="py-2 text-muted">
                      {p.description || "\u2014"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      <Section title="Loss History">
        {s.losses.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[0.7rem] uppercase tracking-wider text-muted">
                  <th className="pb-2 pr-4">Policy Year</th>
                  <th className="pb-2 pr-4">Claims</th>
                  <th className="pb-2 pr-4">Total Incurred</th>
                  <th className="pb-2 pr-4">Total Paid</th>
                  <th className="pb-2">Description</th>
                </tr>
              </thead>
              <tbody className="text-light">
                {s.losses.map((l) => (
                  <tr key={l.id} className="border-t border-dark-border">
                    <td className="py-2 pr-4">{l.policyYear || "\u2014"}</td>
                    <td className="py-2 pr-4">
                      {l.numberOfClaims ?? "\u2014"}
                    </td>
                    <td className="py-2 pr-4">
                      {l.totalIncurred ? `$${l.totalIncurred}` : "\u2014"}
                    </td>
                    <td className="py-2 pr-4">
                      {l.totalPaid ? `$${l.totalPaid}` : "\u2014"}
                    </td>
                    <td className="py-2 text-muted text-xs">
                      {l.description || "\u2014"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted">No loss records</p>
        )}
      </Section>
    </div>
  );
}
