import { notFound } from "next/navigation";
import { ExperimentDetailCard } from "@/components/experiments/experiment-detail-card";
import { EvidenceTeacherNotice } from "@/components/evidence/evidence-teacher-notice";
import { EvidenceLoginPrompt } from "@/components/evidence/evidence-login-prompt";
import { EvidenceRoleNotice } from "@/components/evidence/evidence-role-notice";
import { getSession } from "@/lib/auth";
import { getPublishedExperimentByWeekNumber } from "@/lib/services/experiments";

export const dynamic = "force-dynamic";

type ExperimentPageProps = {
  params: Promise<{ weekNumber: string }>;
};

export default async function ExperimentPage({ params }: ExperimentPageProps) {
  const { weekNumber } = await params;
  const week = Number(weekNumber);
  if (!Number.isFinite(week) || week < 1 || week > 52) {
    notFound();
  }

  let experiment = null;
  try {
    experiment = await getPublishedExperimentByWeekNumber(week);
  } catch {
    experiment = null;
  }

  if (!experiment) {
    notFound();
  }

  const session = await getSession();
  const returnPath = `/experimentos/${week}`;

  return (
    <div className="space-y-6">
      <ExperimentDetailCard experiment={experiment} />
      {!session ? (
        <EvidenceLoginPrompt returnPath={returnPath} />
      ) : session.role === "teacher" || session.role === "admin" ? (
        <EvidenceTeacherNotice role={session.role} />
      ) : (
        <EvidenceRoleNotice role={session.role} />
      )}
    </div>
  );
}
