import { Header } from '@/components/Header';
import { Hero } from '@/components/Hero';
import { PresaleCard } from '@/components/PresaleCard';
import { Tokenomics } from '@/components/Tokenomics';
import { Utility } from '@/components/Utility';
import { Timeline } from '@/components/Timeline';
import { Footer } from '@/components/Footer';

export default function Home() {
  return (
    <main className="min-h-screen">
      <Header />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Hero />
        
        <div className="grid lg:grid-cols-2 gap-8 py-12">
          <PresaleCard />
          <div className="space-y-8">
            <Timeline />
            <Utility />
          </div>
        </div>
        
        <Tokenomics />
      </div>
      
      <Footer />
    </main>
  );
}
