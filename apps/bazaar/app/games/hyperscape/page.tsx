'use client';

import { useState } from 'react';
import { getNFTContracts } from '../../../config/contracts';
import { useChainId } from 'wagmi';

interface HyperscapeItem {
  id: string
  name: string
  rarity: number
  attack: number
  defense: number
  strength: number
  balance: string
  minter: string
}

export default function HyperscapeItemsPage() {
  const chainId = useChainId();
  getNFTContracts(chainId);
  const [items] = useState<HyperscapeItem[]>([]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Hyperscape Items</h1>
        <p className="text-gray-400">
          Discover minted items from the Hyperscape MMORPG. Each item shows its original minter for provenance tracking.
        </p>
      </div>

      <div className="mb-6 flex gap-4">
        <button className="px-4 py-2 bg-blue-600 rounded">All Items</button>
        <button className="px-4 py-2 bg-gray-700 rounded">Weapons</button>
        <button className="px-4 py-2 bg-gray-700 rounded">Armor</button>
        <button className="px-4 py-2 bg-gray-700 rounded">Tools</button>
        <button className="px-4 py-2 bg-gray-700 rounded">Resources</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {items.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-400">
            <p>No Hyperscape items found</p>
            <p className="text-sm mt-2">Mint items in-game to see them here</p>
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="border border-gray-700 rounded-lg p-4 hover:border-blue-500 transition">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold">{item.name}</h3>
                <span className={`text-xs px-2 py-1 rounded ${getRarityColor(item.rarity)}`}>
                  {getRarityName(item.rarity)}
                </span>
              </div>

              <div className="text-sm text-gray-400 space-y-1 mb-3">
                {item.attack > 0 && <div>⚔️ Attack: +{item.attack}</div>}
                {item.strength > 0 && <div>💪 Strength: +{item.strength}</div>}
                {item.defense > 0 && <div>🛡️ Defense: +{item.defense}</div>}
              </div>

              <div className="text-xs text-gray-500 border-t border-gray-800 pt-2">
                <div>Minted by: {item.minter?.slice(0, 6)}...{item.minter?.slice(-4)}</div>
                <div>Quantity: {item.balance}</div>
              </div>

              <button className="w-full mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm">
                View Listing
              </button>
            </div>
          ))
        )}
      </div>

      <div className="mt-8 p-4 bg-gray-800/50 rounded-lg">
        <h2 className="font-bold mb-2">About Hyperscape Items</h2>
        <ul className="text-sm text-gray-400 space-y-1">
          <li>🎮 All items come from the Hyperscape MMORPG</li>
          <li>🔒 Minted items are permanent and never drop on death</li>
          <li>👤 Original minter is tracked forever (provenance)</li>
          <li>⭐ Items minted by famous players may be worth more</li>
          <li>🤖 Be cautious of bot-farmed gear (check minter reputation)</li>
        </ul>
      </div>
    </div>
  );
}

function getRarityColor(rarity: number): string {
  switch (rarity) {
    case 0: return 'bg-gray-700 text-gray-300';
    case 1: return 'bg-green-700 text-green-300';
    case 2: return 'bg-blue-700 text-blue-300';
    case 3: return 'bg-purple-700 text-purple-300';
    case 4: return 'bg-yellow-700 text-yellow-300';
    default: return 'bg-gray-700 text-gray-300';
  }
}

function getRarityName(rarity: number): string {
  switch (rarity) {
    case 0: return 'Common';
    case 1: return 'Uncommon';
    case 2: return 'Rare';
    case 3: return 'Epic';
    case 4: return 'Legendary';
    default: return 'Unknown';
  }
}

