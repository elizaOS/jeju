import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { GameScenario, Outcome, NPC, GameEvent } from '../types';

/**
 * Scenario Generator
 * Creates unique game scenarios with NPCs and event timelines
 */
export class ScenarioGenerator {
  private scenarioTemplates = [
    {
      title: 'Project Omega: Mind Control Satellite',
      questionTemplate: 'Will Project Omega\'s satellite launch succeed by Day 30?',
      description: 'A shadowy tech consortium led by Elon Tusk plans to launch a controversial satellite. Rumors of mind control, government backing, and sabotage swirl.',
      npcs: this.createProjectOmegaNPCs()
    },
    {
      title: 'Celebrity Election Scandal',
      questionTemplate: 'Will the scandal force President Stump to resign by Day 30?',
      description: 'President Donald Stump faces mounting accusations. The media is in a frenzy. Will he survive or step down?',
      npcs: this.createElectionNPCs()
    }
  ];

  async generate(): Promise<GameScenario> {
    // Pick random template
    const template = this.scenarioTemplates[
      Math.floor(Math.random() * this.scenarioTemplates.length)
    ];

    // Decide secret outcome
    const secretOutcome = Math.random() > 0.5 ? Outcome.YES : Outcome.NO;

    // Create commitment hash
    const outcomeCommitment = crypto
      .createHash('sha256')
      .update(`${secretOutcome}-${Date.now()}-${Math.random()}`)
      .digest('hex');

    // Generate timeline based on outcome
    const timeline = this.generateTimeline(template.title, secretOutcome);

    return {
      id: uuidv4(),
      title: template.title,
      question: template.questionTemplate,
      description: template.description,
      secretOutcome,
      outcomeCommitment,
      npcs: template.npcs,
      timeline
    };
  }

  private createProjectOmegaNPCs(): NPC[] {
    return [
      {
        id: 'elon-tusk',
        name: 'Elon Tusk',
        role: 'celebrity',
        bias: 'neutral',
        bio: 'Tusked tech billionaire leading Project Omega. Known for bold claims and twitter storms.',
        tendsToBeTruthful: false
      },
      {
        id: 'donald-stump',
        name: 'Donald Stump',
        role: 'celebrity',
        bias: 'neutral',
        bio: 'The President. Unpredictable, loves attention, might help or hurt the project.',
        tendsToBeTruthful: false
      },
      {
        id: 'insider-ian',
        name: 'Insider Ian',
        role: 'insider',
        bias: 'truthful',
        bio: 'Works at the launch facility. Has real intel but risks his job by leaking.',
        tendsToBeTruthful: true
      },
      {
        id: 'whistleblower-wendy',
        name: 'Whistleblower Wendy',
        role: 'insider',
        bias: 'truthful',
        bio: 'Engineering whistleblower. Releases documents when she sees problems.',
        tendsToBeTruthful: true
      },
      {
        id: 'conspiracy-carl',
        name: 'Conspiracy Carl',
        role: 'rumor',
        bias: 'deceptive',
        bio: 'Local conspiracy theorist. Believes everything is aliens or mind control.',
        tendsToBeTruthful: false
      },
      {
        id: 'engineer-emma',
        name: 'Engineer Emma',
        role: 'insider',
        bias: 'deceptive',
        bio: 'Project engineer. Overly optimistic PR person disguised as insider.',
        tendsToBeTruthful: false
      },
      {
        id: 'channel7-news',
        name: 'Channel 7 News',
        role: 'media',
        bias: 'truthful',
        bio: 'Main news outlet. Generally factual but sometimes late to the story.',
        tendsToBeTruthful: true
      },
      {
        id: 'tech-journal',
        name: 'TechJournal',
        role: 'media',
        bias: 'truthful',
        bio: 'Tech news blog. Has good sources, breaks stories early.',
        tendsToBeTruthful: true
      }
    ];
  }

  private createElectionNPCs(): NPC[] {
    return [
      {
        id: 'donald-stump',
        name: 'Donald Stump',
        role: 'celebrity',
        bias: 'neutral',
        bio: 'The embattled President. Denies everything.',
        tendsToBeTruthful: false
      },
      {
        id: 'media-megan',
        name: 'Media Megan',
        role: 'media',
        bias: 'truthful',
        bio: 'Investigative journalist chasing the scandal.',
        tendsToBeTruthful: true
      }
      // Add more NPCs as needed
    ];
  }

  private generateTimeline(scenarioTitle: string, outcome: Outcome): GameEvent[] {
    if (scenarioTitle.includes('Omega')) {
      return this.generateOmegaTimeline(outcome);
    } else {
      return this.generateElectionTimeline(outcome);
    }
  }

  private generateOmegaTimeline(outcome: Outcome): GameEvent[] {
    const events: GameEvent[] = [
      {
        day: 1,
        type: 'announcement',
        author: 'elon-tusk',
        content: '@ElonTusk: Proud to announce Project Omega. Our satellite will change the world on Day 30. 🚀',
        isPublic: true
      },
      {
        day: 1,
        type: 'news',
        author: 'channel7-news',
        content: 'Channel 7 News: President Stump announces support for Project Omega - "A new era for national security."',
        isPublic: true
      },
      {
        day: 3,
        type: 'news',
        author: 'tech-journal',
        content: 'TechJournal: Unnamed sources report minor glitches in Omega rocket tests, but nothing major.',
        isPublic: true
      },
      {
        day: 5,
        type: 'leak',
        author: 'conspiracy-carl',
        content: 'Conspiracy Carl: I heard Omega is a cover for mind control! The launch will fake succeed but actually fail. #WakeUpSheeple',
        isPublic: true
      }
    ];

    // Day 12: Major event based on outcome
    if (outcome === Outcome.NO) {
      events.push({
        day: 12,
        type: 'news',
        author: 'channel7-news',
        content: '🔥 BREAKING: Omega Test Rocket Explodes on launch pad! Observers are alarmed. Cause under investigation.',
        isPublic: true
      });
      events.push({
        day: 13,
        type: 'announcement',
        author: 'elon-tusk',
        content: '@ElonTusk: Yes, a test failed. But we\'ve learned from it. The Day 30 launch is still a go!',
        isPublic: true
      });
    } else {
      events.push({
        day: 12,
        type: 'news',
        author: 'channel7-news',
        content: '✅ Omega Test Rocket Success! Smooth test launch. Project looks solid.',
        isPublic: true
      });
    }

    // Day 20: Whistleblower event
    if (outcome === Outcome.NO) {
      events.push({
        day: 20,
        type: 'leak',
        author: 'whistleblower-wendy',
        content: 'Whistleblower Wendy: I have documents proving Omega\'s rocket engine is fundamentally flawed. 📄',
        isPublic: true
      });
    } else {
      events.push({
        day: 20,
        type: 'leak',
        author: 'engineer-emma',
        content: 'Engineer Emma: Internal review complete. All systems nominal. Launch confidence high.',
        isPublic: true
      });
    }

    // Day 25: Political event
    events.push({
      day: 25,
      type: 'announcement',
      author: 'donald-stump',
      content: outcome === Outcome.NO 
        ? 'President Stump: Not happy with these delays. One more failure and I pull funding.'
        : 'President Stump: Full support for Omega. This will be historic!',
      isPublic: true
    });

    // Day 29: Final hint
    if (outcome === Outcome.NO) {
      events.push({
        day: 29,
        type: 'news',
        author: 'tech-journal',
        content: '🚨 TechJournal: Launch Director resigns unexpectedly. No official reason given.',
        isPublic: true
      });
    }

    return events;
  }

  private generateElectionTimeline(outcome: Outcome): GameEvent[] {
    // TODO: Implement election scenario timeline
    return [];
  }
}

