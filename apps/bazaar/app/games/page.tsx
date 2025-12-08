'use client'

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

interface RegisteredGame {
  id: string
  agentId: number
  name: string
  tags: string[]
  totalPlayers?: number
  totalItems?: number
}

async function getRegisteredGames() {
  const INDEXER_URL = process.env.NEXT_PUBLIC_INDEXER_URL || 'http://localhost:4350/graphql';
  
  const query = `
    query GetGames {
      registeredGames(where: { active_eq: true }, orderBy: registeredAt_DESC) {
        id
        agentId
        name
        tags
        totalPlayers
        totalItems
      }
    }
  `;
  
  const response = await fetch(INDEXER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
    next: { revalidate: 10 },
  });
  
  const result = await response.json();
  return result.data?.registeredGames || [];
}

export default function GamesPage() {
  const { data: games = [], isLoading } = useQuery({
    queryKey: ['registered-games'],
    queryFn: getRegisteredGames,
  });

  return (
    <div>
      <h1 className="text-4xl font-bold mb-8">Games & Applications</h1>
      <p className="text-slate-400 mb-8">
        Decentralized games and applications registered on Jeju via ERC-8004
      </p>

      {isLoading && (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-purple-600/30 border-t-purple-600 rounded-full animate-spin" />
        </div>
      )}

      {!isLoading && games.length === 0 && (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">🎮</div>
          <h3 className="text-2xl font-semibold mb-2">No Games Yet</h3>
          <p className="text-slate-400">
            Games will appear here once registered via ERC-8004
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {games.map((game: RegisteredGame) => (
          <div
            key={game.id}
            className="p-6 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all hover:scale-105"
          >
            <div className="text-4xl mb-4">🎮</div>
            <h3 className="text-2xl font-bold mb-2">{game.name}</h3>
            
            {/* Tags */}
            {game.tags && game.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {game.tags.map((tag, i) => (
                  <span
                    key={i}
                    className="px-2 py-1 text-xs rounded bg-purple-600/20 text-purple-300"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Stats */}
            <div className="space-y-2 text-sm text-slate-400 mb-4">
              {game.totalPlayers !== undefined && (
                <div>👥 {game.totalPlayers} players</div>
              )}
              {game.totalItems !== undefined && (
                <div>🎁 {game.totalItems} items</div>
              )}
              <div className="text-xs text-slate-500">
                Agent ID: {game.agentId}
              </div>
            </div>

            <Link
              href={`https://jeju.network/agent/${game.agentId}`}
              target="_blank"
              className="inline-block px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 font-semibold transition-all"
            >
              View Game →
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
