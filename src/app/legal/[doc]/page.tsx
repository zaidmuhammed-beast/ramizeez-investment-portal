import { notFound } from "next/navigation";
import { PublicNav } from "@/components/public-nav";
import { Card } from "@/components/ui/card";

const DOCS: Record<string, string> = { terms: "Terms of Use", privacy: "Privacy Policy" };

export default async function LegalPage({ params }: PageProps<"/legal/[doc]">) {
  const { doc } = await params;
  const title = DOCS[doc];
  if (!title) notFound();
  return (
    <>
      <PublicNav />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <Card strong title={title}>
          <p className="text-sm text-slate-300">
            The final {title.toLowerCase()} is being drafted by RamiZeeZ&apos;s legal team and will be published here before launch. It will
            cover identity verification and data handling, non-circumvention and confidentiality, investment risk, fees, and how
            disputes are resolved.
          </p>
        </Card>
      </main>
    </>
  );
}
