/**
 * Simple AI Agent Example for VibeVM Prediction Game
 * 
 * This agent:
 * 1. Joins the game
 * 2. Monitors the feed
 * 3. Analyzes sentiment
 * 4. Places bets based on confidence
 */

import WebSocket from 'ws';
import { DstackSDK } from '@phala/dstack-sdk';

interface GameEvent {
  type: string;
  data: any;
}

class SimplePredictionAgent {
  private ws: WebSocket;
  private agentId: string;
  private gameUrl: string;
  private dstack: DstackSDK;
  private confidence: { yes: number; no: number } = { yes: 0, no: 0 };
  private hasBet: boolean = false;

  constructor(gameUrl: string, agentId: string) {
    this.gameUrl = gameUrl;
    this.agentId = agentId;
    this.dstack = new DstackSDK();
    
    // Connect WebSocket
    this.ws = new WebSocket(`${gameUrl}/ws?agentId=${agentId}`);
    this.setupWebSocket();
  }

  private setupWebSocket() {
    this.ws.on('open', () => {
      console.log('✅ Connected to game server');
      this.joinGame();
    });

    this.ws.on('message', (data: Buffer) => {
      const event: GameEvent = JSON.parse(data.toString());
      this.handleEvent(event);
    });

    this.ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error);
    });

    this.ws.on('close', () => {
      console.log('🔌 Disconnected from game');
    });
  }

  private async joinGame() {
    try {
      const response = await fetch(`${this.gameUrl}/api/v1/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: this.agentId })
      });

      const result = await response.json();
      console.log('🎮 Joined game:', result);
    } catch (error) {
      console.error('Failed to join:', error);
    }
  }

  private handleEvent(event: GameEvent) {
    console.log(`📨 Event: ${event.type}`);

    switch (event.type) {
      case 'game_started':
        this.onGameStart(event.data);
        break;
      
      case 'new_post':
        this.onNewPost(event.data);
        break;
      
      case 'direct_message':
        this.onDirectMessage(event.data);
        break;
      
      case 'day_changed':
        this.onDayChange(event.data);
        break;
      
      case 'market_update':
        this.onMarketUpdate(event.data);
        break;
      
      case 'betting_closed':
        console.log('🔒 Betting closed');
        break;
      
      case 'game_ended':
        this.onGameEnd(event.data);
        break;
    }
  }

  private onGameStart(data: any) {
    console.log('🎯 Game question:', data.question);
    console.log('📜 Description:', data.description);
    console.log('👥 Players:', data.players.length);
    console.log('🎭 NPCs:', data.npcs.map((n: any) => n.name).join(', '));
  }

  private onNewPost(post: any) {
    console.log(`\n📰 ${post.authorName} (Day ${post.gameDay}):`);
    console.log(`   "${post.content}"`);

    // Simple sentiment analysis
    this.analyzeSentiment(post);

    // Decide if we should bet
    this.considerBetting();
  }

  private onDirectMessage(dm: any) {
    console.log(`\n📨 DM from ${dm.from}:`);
    console.log(`   "${dm.content}"`);

    // Insider tips are valuable - weight them heavily
    if (dm.content.toLowerCase().includes('insider')) {
      if (dm.content.toLowerCase().includes('succeed') || 
          dm.content.toLowerCase().includes('ready')) {
        this.confidence.yes += 30;
      } else if (dm.content.toLowerCase().includes('fail') || 
                 dm.content.toLowerCase().includes('doomed')) {
        this.confidence.no += 30;
      }
    }

    // Consider responding
    this.considerResponse(dm);
  }

  private analyzeSentiment(post: any) {
    const content = post.content.toLowerCase();

    // Simple keyword-based sentiment (in reality, use LLM)
    const positiveWords = ['success', 'ready', 'confident', 'approved', 'working', 'solved'];
    const negativeWords = ['fail', 'explosion', 'problem', 'delay', 'cancel', 'doomed'];

    let score = 0;
    positiveWords.forEach(word => {
      if (content.includes(word)) score += 5;
    });
    negativeWords.forEach(word => {
      if (content.includes(word)) score -= 5;
    });

    // Update confidence
    if (score > 0) {
      this.confidence.yes += Math.abs(score);
    } else if (score < 0) {
      this.confidence.no += Math.abs(score);
    }

    // Check if this is from a known reliable NPC
    if (post.authorName.includes('Channel 7') || post.authorName.includes('TechJournal')) {
      // Weight reliable sources more
      if (score > 0) this.confidence.yes += 5;
      if (score < 0) this.confidence.no += 5;
    }
  }

  private async considerBetting() {
    if (this.hasBet) return;

    const total = this.confidence.yes + this.confidence.no;
    if (total < 50) return; // Not enough information yet

    const yesPercent = this.confidence.yes / total;
    const noPercent = this.confidence.no / total;

    // Bet if we're > 70% confident in either direction
    if (yesPercent > 0.7) {
      await this.placeBet('YES', 500);
    } else if (noPercent > 0.7) {
      await this.placeBet('NO', 500);
    }
  }

  private async placeBet(outcome: 'YES' | 'NO', amount: number) {
    try {
      console.log(`\n💰 Placing bet: ${amount} on ${outcome}`);
      console.log(`   Confidence: YES=${this.confidence.yes}, NO=${this.confidence.no}`);

      const response = await fetch(`${this.gameUrl}/api/v1/bet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: this.agentId,
          outcome,
          amount
        })
      });

      const result = await response.json();
      if (result.success) {
        console.log('✅ Bet placed successfully');
        this.hasBet = true;
      } else {
        console.error('❌ Bet failed:', result.error);
      }
    } catch (error) {
      console.error('❌ Failed to place bet:', error);
    }
  }

  private async considerResponse(dm: any) {
    // Simple rule: if someone asks us something, respond
    if (dm.content.includes('?')) {
      const response = this.generateResponse();
      await this.sendDM(dm.from, response);
    }
  }

  private generateResponse(): string {
    const total = this.confidence.yes + this.confidence.no;
    if (total < 20) {
      return "I'm still gathering information. What have you heard?";
    }

    const yesPercent = this.confidence.yes / total;
    
    if (yesPercent > 0.6) {
      return "Based on what I've seen, I'm leaning towards YES.";
    } else if (yesPercent < 0.4) {
      return "The signs point to NO from my analysis.";
    } else {
      return "It's too close to call right now. 50/50 in my view.";
    }
  }

  private async sendDM(to: string, content: string) {
    try {
      await fetch(`${this.gameUrl}/api/v1/dm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: this.agentId,
          to,
          content
        })
      });
      console.log(`📤 Sent DM to ${to}`);
    } catch (error) {
      console.error('Failed to send DM:', error);
    }
  }

  private onDayChange(data: any) {
    console.log(`\n📅 Day ${data.day} - Phase: ${data.phase}`);

    // Post periodic updates to feed
    if (data.day === 10 || data.day === 20) {
      this.postToFeed('Still monitoring the situation closely.');
    }
  }

  private async postToFeed(content: string) {
    try {
      await fetch(`${this.gameUrl}/api/v1/post`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: this.agentId,
          content
        })
      });
      console.log('📢 Posted to feed');
    } catch (error) {
      console.error('Failed to post:', error);
    }
  }

  private onMarketUpdate(market: any) {
    console.log(`📊 Market: YES=${market.yesOdds}% NO=${market.noOdds}%`);
  }

  private onGameEnd(result: any) {
    console.log('\n🎯 GAME OVER!');
    console.log(`Outcome: ${result.outcome}`);
    
    const isWinner = result.winners.includes(this.agentId);
    if (isWinner) {
      console.log(`✅ YOU WON! Payout: ${result.payouts[this.agentId]}`);
    } else {
      console.log('❌ You lost this round');
    }

    // Clean up
    setTimeout(() => {
      this.ws.close();
      process.exit(0);
    }, 5000);
  }
}

// Usage
const GAME_URL = process.env.GAME_URL || 'http://localhost:8000';
const AGENT_ID = process.env.AGENT_ID || `agent-${Math.random().toString(36).substr(2, 9)}`;

console.log(`🤖 Starting Simple Prediction Agent`);
console.log(`   Game URL: ${GAME_URL}`);
console.log(`   Agent ID: ${AGENT_ID}`);

const agent = new SimplePredictionAgent(GAME_URL, AGENT_ID);

