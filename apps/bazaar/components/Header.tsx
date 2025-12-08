'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { clsx } from 'clsx'

export function Header() {
  const pathname = usePathname()
  const { address, isConnected } = useAccount()
  const { connect } = useConnect()
  const { disconnect } = useDisconnect()

  const navItems = [
    { href: '/', label: 'Home' },
    { href: '/coins', label: 'Coins' },
    { href: '/swap', label: 'Swap' },
    { href: '/pools', label: 'Pools' },
    { href: '/markets', label: 'Markets' },
    { href: '/items', label: 'Items' },
  ]
  
  const [showPortfolioDropdown, setShowPortfolioDropdown] = useState(false)

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-slate-900/80 backdrop-blur-md border-b border-white/10">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3">
            <div className="text-3xl">🏝️</div>
            <span className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">
              Bazaar
            </span>
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  'text-sm font-medium transition-colors hover:text-purple-400',
                  pathname === item.href
                    ? 'text-purple-400'
                    : 'text-slate-300'
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Wallet Connection / Portfolio Widget */}
          <div className="relative">
            {!isConnected ? (
              <button
                onClick={() => connect({ connector: injected() })}
                className="px-6 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 font-semibold transition-all"
              >
                Connect Wallet
              </button>
            ) : (
              <>
                <button
                  onClick={() => setShowPortfolioDropdown(!showPortfolioDropdown)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-all"
                >
                  <div className="text-sm text-slate-300">
                    {address?.slice(0, 6)}...{address?.slice(-4)}
                  </div>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {/* Dropdown Menu */}
                {showPortfolioDropdown && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setShowPortfolioDropdown(false)}
                    />
                    <div className="absolute right-0 top-full mt-2 w-56 rounded-lg bg-slate-800 border border-white/10 shadow-xl z-50 overflow-hidden">
                      <Link
                        href="/portfolio"
                        className="flex items-center gap-3 px-4 py-3 hover:bg-white/10 transition-colors"
                        onClick={() => setShowPortfolioDropdown(false)}
                      >
                        <span className="text-xl">📊</span>
                        <span className="font-medium">View Portfolio</span>
                      </Link>
                      <button
                        onClick={() => {
                          disconnect()
                          setShowPortfolioDropdown(false)
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/10 transition-colors text-left border-t border-white/10"
                      >
                        <span className="text-xl">🚪</span>
                        <span className="font-medium">Disconnect</span>
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

