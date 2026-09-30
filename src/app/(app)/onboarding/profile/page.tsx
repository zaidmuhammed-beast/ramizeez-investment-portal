import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { COUNTRIES } from "@/lib/countries";
import { getOnboardingState, MIN_REFERENCES } from "@/lib/onboarding";
import { Card, PageHeader } from "@/components/ui/card";
import { StepStatusBadge } from "@/components/step-status";
import { cn } from "@/components/ui/cn";
import { DeclarationsForm, GoalsForm, ListSection, PersonalForm } from "./forms";

export const metadata: Metadata = { title: "Your profile" };

const SECTIONS = [
  { key: "personal", label: "Personal details" },
  { key: "education", label: "Education" },
  { key: "experience", label: "Work experience" },
  { key: "ventures", label: "Past businesses" },
  { key: "goals", label: "Life goals & motivation" },
  { key: "references", label: "References" },
  { key: "declarations", label: "Declarations" },
] as const;

type SectionKey = (typeof SECTIONS)[number]["key"];

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const dateStr = (d?: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export default async function ProfilePage({ searchParams }: PageProps<"/onboarding/profile">) {
  const user = await requireUser();
  const { s } = await searchParams;
  const section: SectionKey = SECTIONS.some((x) => x.key === s) ? (s as SectionKey) : "personal";
  const state = await getOnboardingState(user.id);

  const [profile, education, experience, ventures, references, goals, declaration, idDoc] = await Promise.all([
    db.personalProfile.findUnique({ where: { userId: user.id } }),
    db.education.findMany({ where: { userId: user.id }, orderBy: { position: "asc" } }),
    db.experience.findMany({ where: { userId: user.id }, orderBy: { position: "asc" } }),
    db.pastVenture.findMany({ where: { userId: user.id }, orderBy: { position: "asc" } }),
    db.reference.findMany({ where: { userId: user.id }, orderBy: { position: "asc" } }),
    db.goalsProfile.findUnique({ where: { userId: user.id } }),
    db.integrityDeclaration.findUnique({ where: { userId: user.id } }),
    db.identityDocument.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
  ]);

  const countries = COUNTRIES.map((c) => ({ value: c.code, label: c.name }));
  const idx = SECTIONS.findIndex((x) => x.key === section);
  const nextSection = SECTIONS[idx + 1];

  return (
    <>
      <PageHeader
        title="Your full profile"
        description="Tier 2. Tell us who you are beyond your ID. Our team reads every profile, and a thoughtful, honest profile speeds up approval."
        actions={<StepStatusBadge status={state.steps.profile} />}
      />
      <div className="grid gap-6 [&>*]:min-w-0 lg:grid-cols-[240px_1fr]">
        <nav className="glass h-fit space-y-1 rounded-2xl p-3" aria-label="Profile sections">
          {SECTIONS.map((x) => (
            <Link
              key={x.key}
              href={`/onboarding/profile?s=${x.key}`}
              className={cn(
                "flex items-center justify-between rounded-xl px-3 py-2.5 text-sm transition",
                x.key === section ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white",
              )}
            >
              {x.label}
              <span className={cn("text-xs", state.sections[x.key] ? "text-brand-300" : "text-slate-600")}>
                {x.key === "ventures" ? (ventures.length ? "✓" : "optional") : state.sections[x.key] ? "✓" : "•"}
              </span>
            </Link>
          ))}
        </nav>

        <Card strong title={SECTIONS[idx].label} description={DESCRIPTIONS[section]}>
          {section === "personal" && (
            <PersonalForm
              countries={countries}
              isInvestor={user.roles.includes("INVESTOR")}
              defaults={{
                preferredName: str(profile?.preferredName),
                dateOfBirth: dateStr(profile?.dateOfBirth ?? idDoc?.dateOfBirth),
                gender: str(profile?.gender),
                nationality1: profile?.nationalities[0] ?? (idDoc?.issuingCountry || user.countryOfResidence),
                nationality2: profile?.nationalities[1] ?? "",
                nationality3: profile?.nationalities[2] ?? "",
                fatherOrSpouseName: str(profile?.fatherOrSpouseName),
                maritalStatus: str(profile?.maritalStatus),
                dependants: str(profile?.dependants),
                languages: profile?.languages.join(", ") ?? "",
                linkedinUrl: str(profile?.linkedinUrl),
                websiteUrl: str(profile?.websiteUrl),
                otherLinks: str(profile?.otherLinks),
                bio: str(profile?.bio),
              }}
            />
          )}
          {section === "education" && (
            <ListSection kind="education" initial={education.map((e) => ({ institution: e.institution, qualification: e.qualification, fieldOfStudy: str(e.fieldOfStudy), startYear: str(e.startYear), endYear: str(e.endYear), notes: str(e.notes) }))} />
          )}
          {section === "experience" && (
            <ListSection kind="experience" initial={experience.map((e) => ({ employer: e.employer, title: e.title, startYear: str(e.startYear), endYear: str(e.endYear), responsibilities: e.responsibilities, reasonForLeaving: str(e.reasonForLeaving) }))} />
          )}
          {section === "ventures" && (
            <ListSection kind="ventures" initial={ventures.map((e) => ({ name: e.name, sector: e.sector, startYear: str(e.startYear), endYear: str(e.endYear), outcome: e.outcome, lessons: e.lessons }))} />
          )}
          {section === "references" && (
            <ListSection kind="references" initial={references.map((e) => ({ name: e.name, relationship: e.relationship, email: e.email, phone: e.phone }))} />
          )}
          {section === "goals" && (
            <GoalsForm
              defaults={{
                goals1y: str(goals?.goals1y), goals5y: str(goals?.goals5y), goals10y: str(goals?.goals10y),
                motivation: str(goals?.motivation), causeCare: str(goals?.causeCare), successDefinition: str(goals?.successDefinition),
                timeCommitment: str(goals?.timeCommitment), otherCommitments: str(goals?.otherCommitments),
                values: str(goals?.values), setbackStory: str(goals?.setbackStory),
              }}
            />
          )}
          {section === "declarations" && <DeclarationsForm existing={declaration} />}

          {nextSection && state.sections[section] && (
            <div className="mt-6 border-t border-white/10 pt-5 text-right">
              <Link href={`/onboarding/profile?s=${nextSection.key}`} className="text-sm font-medium text-brand-300 hover:text-brand-200">
                Next: {nextSection.label} →
              </Link>
            </div>
          )}
          {state.profileComplete && (
            <div className="mt-6 rounded-xl border border-brand-400/30 bg-brand-400/10 p-4 text-sm text-brand-100">
              Your profile is complete.{" "}
              {state.steps.identity === "done" ? (
                <Link href="/onboarding/role" className="font-medium underline">
                  Continue to role verification →
                </Link>
              ) : (
                "Role verification opens once your identity is approved."
              )}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

const DESCRIPTIONS: Record<SectionKey, string> = {
  personal: "Basic personal details and your public professional profiles.",
  education: "Your qualifications, starting with the highest.",
  experience: "Your full work history. Include roles in family businesses.",
  ventures: "Businesses you founded or ran before, and what you learned. Leave this empty if you have none.",
  goals: "Help us understand what drives you. There are no wrong answers, but be specific.",
  references: `At least ${MIN_REFERENCES} professional references who are not related to you. We may contact them.`,
  declarations: "Honest disclosure is required. A “yes” answer does not automatically disqualify you.",
};
