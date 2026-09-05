import { Navbar } from "./Navbar";
import { HeroSection } from "./HeroSection";
import { ProductoresSection } from "./ProductoresSection";
import { DondeComprarSection } from "./DondeComprarSection";
import { ComercioSection } from "./ComercioSection";
import { CreditiendasSection } from "./CreditiendasSection";
import { GremioSection } from "./GremioSection";
import { RegistrarseSection } from "./RegistrarseSection";
import { Footer } from "./Footer";

export function LandingPage() {
  return (
    <div className="dosisya-ui min-h-screen" style={{ background: "var(--papel)" }}>
      <Navbar />
      <main>
        <HeroSection />
        <ProductoresSection />
        <DondeComprarSection />
        <ComercioSection />
        <CreditiendasSection />
        <GremioSection />
        <RegistrarseSection />
      </main>
      <Footer />
    </div>
  );
}
