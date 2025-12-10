import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { FileText, Shield, Vote, Server, Users, Scale, Globe, Lock } from 'lucide-react';

export const metadata = {
  title: 'Jeju Token Whitepaper',
  description: 'Technical whitepaper for the Jeju Network token with MiCA compliance information',
};

export default function WhitepaperPage() {
  return (
    <main className="min-h-screen">
      <Header />
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-12">
          <div className="flex items-center gap-2 text-jeju-500 mb-4">
            <FileText className="w-5 h-5" />
            <span className="text-sm font-medium">Whitepaper v1.0</span>
          </div>
          <h1 className="text-4xl font-bold mb-4">Jeju Token Whitepaper</h1>
          <p className="text-xl text-zinc-400">
            Technical documentation for JEJU, the governance and utility token of the Jeju Network.
          </p>
        </div>
        
        {/* Table of Contents */}
        <nav className="mb-12 p-6 rounded-xl bg-zinc-900 border border-zinc-800">
          <h2 className="font-semibold mb-4">Contents</h2>
          <ul className="space-y-2 text-sm">
            <li><a href="#abstract" className="text-zinc-400 hover:text-white transition-colors">1. Abstract</a></li>
            <li><a href="#network" className="text-zinc-400 hover:text-white transition-colors">2. Jeju Network Overview</a></li>
            <li><a href="#token" className="text-zinc-400 hover:text-white transition-colors">3. Token Utility</a></li>
            <li><a href="#tokenomics" className="text-zinc-400 hover:text-white transition-colors">4. Tokenomics</a></li>
            <li><a href="#governance" className="text-zinc-400 hover:text-white transition-colors">5. Governance</a></li>
            <li><a href="#moderation" className="text-zinc-400 hover:text-white transition-colors">6. Moderation Marketplace</a></li>
            <li><a href="#compliance" className="text-zinc-400 hover:text-white transition-colors">7. Regulatory Compliance (MiCA)</a></li>
            <li><a href="#risks" className="text-zinc-400 hover:text-white transition-colors">8. Risk Factors</a></li>
            <li><a href="#team" className="text-zinc-400 hover:text-white transition-colors">9. Team & Contact</a></li>
          </ul>
        </nav>
        
        {/* Abstract */}
        <Section id="abstract" title="1. Abstract">
          <p>
            Jeju Network is an OP-Stack Layer 2 blockchain optimized for AI agents and high-frequency applications, 
            featuring 200ms Flashblocks for near-instant transaction finality. The JEJU token serves as the governance 
            and utility token for the network, enabling participation in protocol governance, moderation staking, 
            and network service payments.
          </p>
          <p>
            This whitepaper describes the technical architecture, tokenomics, governance model, and regulatory 
            compliance framework for the JEJU token. The token is designed with a "most favored nations" principle: 
            any token can be used for payments through the paymaster system, while JEJU provides exclusive access 
            to governance and moderation functions.
          </p>
        </Section>
        
        {/* Network Overview */}
        <Section id="network" title="2. Jeju Network Overview">
          <h3 className="text-lg font-semibold mt-6 mb-3">2.1 Technical Architecture</h3>
          <p>
            Jeju Network is built on the OP-Stack, inheriting the security guarantees of Ethereum while providing 
            significantly improved performance:
          </p>
          <ul className="list-disc pl-6 space-y-2 mt-4">
            <li><strong>200ms Flashblocks:</strong> Near-instant transaction inclusion for real-time applications</li>
            <li><strong>ERC-4337 Account Abstraction:</strong> Gasless transactions through paymaster infrastructure</li>
            <li><strong>Cross-chain Interoperability:</strong> Ethereum Interop Layer (EIL) for trustless bridging</li>
            <li><strong>Open Intents Framework (OIF):</strong> ERC-7683 compatible cross-chain intents</li>
          </ul>
          
          <h3 className="text-lg font-semibold mt-6 mb-3">2.2 Core Services</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Compute:</strong> Decentralized inference serving with x402 micropayments</li>
            <li><strong>Storage:</strong> IPFS-compatible pinning with credit-based billing</li>
            <li><strong>Bazaar:</strong> NFT and digital asset marketplace</li>
            <li><strong>Identity:</strong> On-chain identity registry with reputation</li>
          </ul>
        </Section>
        
        {/* Token Utility */}
        <Section id="token" title="3. Token Utility">
          <div className="grid md:grid-cols-2 gap-4 my-6">
            <UtilityCard 
              icon={<Vote className="w-5 h-5" />}
              title="Governance"
              description="Vote on protocol upgrades, parameter changes, and treasury allocation through the Agent Council."
            />
            <UtilityCard 
              icon={<Shield className="w-5 h-5" />}
              title="Moderation Staking"
              description="Stake JEJU in the futarchy-based moderation marketplace to participate in ban decisions."
            />
            <UtilityCard 
              icon={<Server className="w-5 h-5" />}
              title="Service Payments"
              description="Pay for network services through the paymaster system. Any registered token works."
            />
            <UtilityCard 
              icon={<Users className="w-5 h-5" />}
              title="Agent Council"
              description="Network revenue flows to the Agent Council, which funds development and operations."
            />
          </div>
          
          <h3 className="text-lg font-semibold mt-6 mb-3">3.1 Most Favored Nations</h3>
          <p>
            The Jeju Network implements a "most favored nations" policy for token payments. Any token registered 
            in the Token Registry with an active paymaster can be used to pay for services. The paymaster system 
            automatically handles token-to-ETH conversion, providing a seamless experience regardless of which 
            token the user holds.
          </p>
          <p className="mt-4">
            JEJU token has exclusive utility in two areas:
          </p>
          <ul className="list-disc pl-6 space-y-2 mt-2">
            <li><strong>Governance:</strong> Only JEJU can be used to vote on proposals</li>
            <li><strong>Moderation:</strong> Only JEJU can be staked in the ModerationMarketplace</li>
          </ul>
          
          <h3 className="text-lg font-semibold mt-6 mb-3">3.2 Ban Enforcement</h3>
          <p>
            The JEJU token implements ban enforcement at the token level. Users banned by the BanManager cannot 
            transfer JEJU tokens, creating a powerful incentive for good behavior. However, banned users CAN 
            deposit JEJU to the ModerationMarketplace to appeal their ban—this "conviction lock" mechanism 
            ensures banned users have skin in the game when challenging their status.
          </p>
        </Section>
        
        {/* Tokenomics */}
        <Section id="tokenomics" title="4. Tokenomics">
          <div className="overflow-x-auto my-6">
            <table className="w-full text-sm">
              <thead className="bg-zinc-800">
                <tr>
                  <th className="px-4 py-3 text-left">Allocation</th>
                  <th className="px-4 py-3 text-right">%</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-left">Vesting</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                <tr>
                  <td className="px-4 py-3">Presale</td>
                  <td className="px-4 py-3 text-right">10%</td>
                  <td className="px-4 py-3 text-right">1,000,000,000</td>
                  <td className="px-4 py-3">20% TGE, 180-day linear</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">Ecosystem</td>
                  <td className="px-4 py-3 text-right">30%</td>
                  <td className="px-4 py-3 text-right">3,000,000,000</td>
                  <td className="px-4 py-3">1-year cliff, 4-year linear</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">Agent Council</td>
                  <td className="px-4 py-3 text-right">25%</td>
                  <td className="px-4 py-3 text-right">2,500,000,000</td>
                  <td className="px-4 py-3">5% TGE, 6-month cliff, 5-year linear</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">Team</td>
                  <td className="px-4 py-3 text-right">15%</td>
                  <td className="px-4 py-3 text-right">1,500,000,000</td>
                  <td className="px-4 py-3">1-year cliff, 4-year linear</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">Liquidity</td>
                  <td className="px-4 py-3 text-right">10%</td>
                  <td className="px-4 py-3 text-right">1,000,000,000</td>
                  <td className="px-4 py-3">100% at TGE</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">Community</td>
                  <td className="px-4 py-3 text-right">10%</td>
                  <td className="px-4 py-3 text-right">1,000,000,000</td>
                  <td className="px-4 py-3">10% TGE, 3-year linear</td>
                </tr>
              </tbody>
              <tfoot className="bg-zinc-800">
                <tr>
                  <td className="px-4 py-3 font-semibold">Total</td>
                  <td className="px-4 py-3 text-right font-semibold">100%</td>
                  <td className="px-4 py-3 text-right font-semibold">10,000,000,000</td>
                  <td className="px-4 py-3"></td>
                </tr>
              </tfoot>
            </table>
          </div>
          
          <h3 className="text-lg font-semibold mt-6 mb-3">4.1 Initial Supply</h3>
          <p>
            At TGE, 1,000,000,000 JEJU (10% of max supply) will be in circulation. The token has a maximum 
            supply cap of 10,000,000,000 JEJU, with minting controlled by the contract owner (eventually 
            transferred to the Agent Council multi-sig).
          </p>
        </Section>
        
        {/* Governance */}
        <Section id="governance" title="5. Governance">
          <p>
            The Jeju Network uses a futarchy-based governance system implemented through prediction markets. 
            Token holders can create proposals, and outcomes are determined by market prices representing 
            community expectations of network quality.
          </p>
          
          <h3 className="text-lg font-semibold mt-6 mb-3">5.1 Agent Council</h3>
          <p>
            The Agent Council is a multi-signature treasury that receives all network revenue. It is responsible for:
          </p>
          <ul className="list-disc pl-6 space-y-2 mt-2">
            <li>Funding protocol development</li>
            <li>Operating network infrastructure</li>
            <li>Sponsoring ecosystem grants</li>
            <li>Managing emergency responses</li>
          </ul>
          
          <h3 className="text-lg font-semibold mt-6 mb-3">5.2 Proposal Types</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Parameter Changes:</strong> Adjust network fees, staking requirements, etc.</li>
            <li><strong>Treasury Allocation:</strong> Fund grants, partnerships, and development</li>
            <li><strong>Protocol Upgrades:</strong> Approve contract upgrades and new features</li>
            <li><strong>Guardian Elections:</strong> Elect trusted parties for emergency actions</li>
          </ul>
        </Section>
        
        {/* Moderation */}
        <Section id="moderation" title="6. Moderation Marketplace">
          <p>
            The ModerationMarketplace is a futarchy-based system for managing user bans. Staked users can 
            flag bad actors, creating a prediction market where the community votes on whether the ban 
            should be upheld.
          </p>
          
          <h3 className="text-lg font-semibold mt-6 mb-3">6.1 Conviction Lock</h3>
          <p>
            JEJU staked in the ModerationMarketplace cannot be withdrawn by banned users. This creates 
            strong incentives:
          </p>
          <ul className="list-disc pl-6 space-y-2 mt-2">
            <li>Good actors stake to earn rewards from successful moderation</li>
            <li>Banned users must stake to appeal, putting skin in the game</li>
            <li>False reporters lose their stake, discouraging abuse</li>
          </ul>
          
          <h3 className="text-lg font-semibold mt-6 mb-3">6.2 Fee Structure</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>Winners receive 90% of loser&apos;s stake</li>
            <li>Protocol treasury receives 5%</li>
            <li>Market makers receive 5%</li>
          </ul>
        </Section>
        
        {/* MiCA Compliance */}
        <Section id="compliance" title="7. Regulatory Compliance (MiCA)">
          <div className="p-4 rounded-lg bg-zinc-800/50 border border-zinc-700 my-6">
            <div className="flex items-center gap-2 mb-2">
              <Scale className="w-5 h-5 text-jeju-500" />
              <span className="font-semibold">MiCA Compliance Statement</span>
            </div>
            <p className="text-sm text-zinc-400">
              This whitepaper is prepared in accordance with the Markets in Crypto-Assets Regulation (MiCA) 
              requirements for utility tokens. JEJU is classified as a utility token providing access to 
              goods or services on the Jeju Network.
            </p>
          </div>
          
          <h3 className="text-lg font-semibold mt-6 mb-3">7.1 Token Classification</h3>
          <p>
            Under MiCA Article 3(1)(5), JEJU qualifies as a utility token because it:
          </p>
          <ul className="list-disc pl-6 space-y-2 mt-2">
            <li>Provides access to governance functions on the Jeju Network</li>
            <li>Enables participation in the moderation marketplace</li>
            <li>Can be used for network service payments (alongside other tokens)</li>
            <li>Does not represent ownership, debt, or payment rights</li>
          </ul>
          
          <h3 className="text-lg font-semibold mt-6 mb-3">7.2 Issuer Information</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Issuing Entity:</strong> Jeju Network Foundation (to be established)</li>
            <li><strong>Jurisdiction:</strong> [To be determined - EU-friendly jurisdiction]</li>
            <li><strong>Contact:</strong> legal@jeju.network</li>
          </ul>
          
          <h3 className="text-lg font-semibold mt-6 mb-3">7.3 Right of Withdrawal</h3>
          <p>
            In accordance with MiCA requirements, presale participants have the right to withdraw within 
            14 days of their contribution. Additionally, if the soft cap is not reached, all contributions 
            will be refunded automatically through the smart contract.
          </p>
          
          <h3 className="text-lg font-semibold mt-6 mb-3">7.4 Environmental Disclosure</h3>
          <p>
            Jeju Network operates as a Layer 2 on Ethereum, which transitioned to Proof of Stake in 
            September 2022. The network&apos;s energy consumption is minimal compared to Proof of Work chains, 
            with estimated carbon footprint of less than 0.01 kg CO2 per transaction.
          </p>
        </Section>
        
        {/* Risks */}
        <Section id="risks" title="8. Risk Factors">
          <div className="p-4 rounded-lg bg-red-900/20 border border-red-900/50 my-6">
            <p className="text-sm text-red-300">
              <strong>Warning:</strong> Crypto assets are high-risk investments. You may lose some or all 
              of your investment. Please read all risk factors carefully before participating.
            </p>
          </div>
          
          <h3 className="text-lg font-semibold mt-6 mb-3">8.1 Technical Risks</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>Smart contract vulnerabilities despite audits</li>
            <li>Dependency on Ethereum L1 security</li>
            <li>Network congestion or downtime</li>
            <li>Bridge or cross-chain failures</li>
          </ul>
          
          <h3 className="text-lg font-semibold mt-6 mb-3">8.2 Market Risks</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>Token price volatility</li>
            <li>Liquidity constraints</li>
            <li>Competition from other L2 networks</li>
            <li>General cryptocurrency market conditions</li>
          </ul>
          
          <h3 className="text-lg font-semibold mt-6 mb-3">8.3 Regulatory Risks</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>Changes in cryptocurrency regulations</li>
            <li>Classification changes affecting utility token status</li>
            <li>Geographic restrictions on token access</li>
          </ul>
          
          <h3 className="text-lg font-semibold mt-6 mb-3">8.4 Operational Risks</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>Key person dependencies</li>
            <li>Governance attacks or manipulation</li>
            <li>Insufficient adoption or usage</li>
          </ul>
        </Section>
        
        {/* Team */}
        <Section id="team" title="9. Team & Contact">
          <h3 className="text-lg font-semibold mt-6 mb-3">9.1 Development</h3>
          <p>
            Jeju Network is developed as open-source software under the MIT License. All code is available 
            for review at <a href="https://github.com/elizaos/jeju" className="text-jeju-400 hover:underline">github.com/elizaos/jeju</a>.
          </p>
          
          <h3 className="text-lg font-semibold mt-6 mb-3">9.2 Contact Information</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>General:</strong> hello@jeju.network</li>
            <li><strong>Security:</strong> security@jeju.network</li>
            <li><strong>Legal:</strong> legal@jeju.network</li>
          </ul>
          
          <h3 className="text-lg font-semibold mt-6 mb-3">9.3 Audits</h3>
          <p>
            Smart contracts will be audited by [Auditor TBD] before mainnet deployment. Audit reports will 
            be published at <a href="https://docs.jeju.network/audits" className="text-jeju-400 hover:underline">docs.jeju.network/audits</a>.
          </p>
        </Section>
        
        {/* Disclaimer */}
        <div className="mt-12 p-6 rounded-xl bg-zinc-800/50 border border-zinc-700">
          <h2 className="font-semibold mb-4">Disclaimer</h2>
          <p className="text-sm text-zinc-400">
            This whitepaper is for informational purposes only and does not constitute an offer to sell or 
            solicitation of an offer to buy any securities. The JEJU token is a utility token and does not 
            represent any ownership, equity, or debt interest in any entity. Participation in the presale 
            involves significant risk and is suitable only for those who can afford to lose their entire 
            investment. This document may contain forward-looking statements that involve risks and 
            uncertainties. Actual results may differ materially from those anticipated.
          </p>
          <p className="text-sm text-zinc-400 mt-4">
            Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>
      
      <Footer />
    </main>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-12 scroll-mt-24">
      <h2 className="text-2xl font-bold mb-4">{title}</h2>
      <div className="prose prose-invert prose-zinc max-w-none">
        {children}
      </div>
    </section>
  );
}

function UtilityCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="p-4 rounded-lg bg-zinc-800/50 border border-zinc-700">
      <div className="text-jeju-500 mb-2">{icon}</div>
      <h4 className="font-semibold mb-1">{title}</h4>
      <p className="text-sm text-zinc-400">{description}</p>
    </div>
  );
}
