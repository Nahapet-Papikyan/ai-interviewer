import { AssessmentCTA } from "@/components/landing/AssessmentCTA";
import { AutomationPhilosophy } from "@/components/landing/AutomationPhilosophy";
import { FAQ } from "@/components/landing/FAQ";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Integrations } from "@/components/landing/Integrations";
import { Outcomes } from "@/components/landing/Outcomes";
import { ProblemSection } from "@/components/landing/ProblemSection";
import { UseCases } from "@/components/landing/UseCases";

export default function HomePage() {
  return (
    <>
      <Hero />
      <ProblemSection />
      <HowItWorks />
      <UseCases />
      <Integrations />
      <AutomationPhilosophy />
      <Outcomes />
      <AssessmentCTA />
      <FAQ />
    </>
  );
}
