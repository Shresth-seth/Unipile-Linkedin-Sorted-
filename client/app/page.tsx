import SmoothScroll from "./Components/landing/smooth-scroll";
import Navbar from "./Components/landing/Navbar";
import Hero from "./Components/landing/Hero";
import IntroSection from "./Components/landing/intro-section";
import FeaturesSection from "./Components/landing/features-section";
import WorkflowSection from "./Components/landing/workflow-section";
import AutonomySection from "./Components/landing/autonomy-section";
import FinalCTA from "./Components/landing/final-cta";
import Footer from "./Components/landing/footer";

export default function Home() {
  return (
    <SmoothScroll>
      <main className="relative min-h-screen bg-slate-50 dark:bg-black text-slate-900 dark:text-white selection:bg-blue-600 selection:text-white">
        <Navbar />
        <Hero />
        <IntroSection />
        <FeaturesSection />
        <WorkflowSection />
        <AutonomySection />
        <FinalCTA />
        <Footer />
      </main>
    </SmoothScroll>
  );
}
