import { Hero } from "@/components/home/Hero";
import { FeatureGrid, HowItWorks, RewardsPreview, FinalCta } from "@/components/home/Sections";

export default function HomePage() {
  return (
    <>
      <Hero />
      <FeatureGrid />
      <HowItWorks />
      <RewardsPreview />
      <FinalCta />
    </>
  );
}
