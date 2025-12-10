'use client';

import Link from 'next/link';
import { FileText, Github, ExternalLink } from 'lucide-react';

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-jeju-400 to-jeju-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">J</span>
            </div>
            <span className="font-semibold text-lg">Jeju</span>
          </div>
          
          <nav className="hidden md:flex items-center gap-6">
            <Link 
              href="/whitepaper" 
              className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white transition-colors"
            >
              <FileText className="w-4 h-4" />
              Whitepaper
            </Link>
            <a 
              href="https://github.com/elizaos/jeju" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white transition-colors"
            >
              <Github className="w-4 h-4" />
              Code
            </a>
            <a 
              href="https://docs.jeju.network" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Docs
            </a>
          </nav>
          
          <div className="flex items-center gap-3">
            <span className="text-xs px-2 py-1 rounded-full bg-jeju-500/20 text-jeju-400 border border-jeju-500/30">
              Testnet
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
