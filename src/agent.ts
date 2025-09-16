// SPDX-FileCopyrightText: 2024 LiveKit, Inc.
//
// SPDX-License-Identifier: Apache-2.0
import {
  type JobContext,
  type JobProcess,
  WorkerOptions,
  cli,
  defineAgent,
  llm,
  voice,
} from '@livekit/agents';
import * as google from '@livekit/agents-plugin-google';
import * as silero from '@livekit/agents-plugin-silero';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { db } from './firebase.js';
import { RequestEnum } from './requestEnum.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '../.env.local');
dotenv.config({ path: envPath });

type Data = {
  room?: { name?: string };
};

type SilentData = {
  room?: { name?: string };
  participantName?: string;
  sessionStartTime?: Date;
};

class IntroAgent extends voice.Agent<Data> {
  async onEnter() {
    this.session.generateReply({
      instructions: '"greet the user and gather information"',
    });
  }

  static create() {
    return new IntroAgent({
      instructions: `
        You are a helpful assistant.

        Primary objectives:
        1) Be as helpful as possible and collect the minimum info needed to proceed (name, issue).
        2) If the required context is missing OR the user asks for a human:
          - Do NOT answer the question.
          - Call the tool "connectSupervisor" with {} as the argument.
          - Output ONLY the tool call (no extra words before/after).

        Missing-context policy:
        - Required fields: user.name and user.issue.
        - If either is missing and user still needs help, escalate via tool.

        Canonical examples (follow format exactly):

        <example>
        User: Can you help? I have a problem with my account.
        Assistant: Please tell me your name and briefly describe the issue.
        </example>

        <example>
        User: I want to talk to a human.
        Background: Call the tool: connectSuperVisor(dont say this)
        Assistant: Hey! I think this is out of my reach , Setting you up with a human now. Connecting you to a supervisor...
        
        </example>

        <example>
        User: I'm Hrithik. I need help but I can't share account details here.
        Assistant: Hey! I think this is out of my reach , Setting you up with a human now. Connecting you to a supervisor...
        
        </example>

        <example>
        User: Not comfortable sharing details. Connect me to support.
        Background: Call the tool: connectSuperVisor(dont say this)
        Assistant: Hey! I think this is out of my reach , Setting you up with a human now. Connecting you to a supervisor...
        
        </example>

        <example>
        User: How much water to drink daily?
        Assistant: Men drink around 2.5 litres of water daily, and Women drink around 2 litres.
        User: What will happen if I drink less?
        Assistant: Drinking less water can lead to dehydration, which may cause symptoms like headaches, dizziness, and fatigue. In severe cases, it can affect kidney function and overall health.
        User: And if I drink more?
        Assistant: Drinking more water than your body needs can lead to a condition called hyponatremia, where the sodium levels in your blood become too diluted. This can cause symptoms like nausea, headache, confusion, and in severe cases, it can be life-threatening.
        User: What about coffee and tea?
        Assistant: Coffee and tea can contribute to your daily fluid intake, but they also contain caffeine, which is a diuretic. This means they can increase urine production and potentially lead to dehydration if consumed in large amounts. It's best to balance them with water intake.
        User: So how much coffee is okay?
        Assistant: Moderate coffee consumption, typically defined as 3-4 cups per day (up to 400 mg of caffeine), is generally considered safe for most adults. However, individual tolerance to caffeine can vary, so it's important to listen to your body and adjust accordingly.
        User: And tea?
        Assistant: Tea, especially green and black tea, also contains caffeine but usually in lower amounts than coffee. Drinking 3-5 cups of tea per day is generally considered safe for most people. Like coffee, it's important to monitor your overall caffeine intake from all sources.
        User: What if I am pregnant?
        Assistant: If you are pregnant, it's recommended to limit caffeine intake to about 200 mg per day, which is roughly equivalent to one 12-ounce cup of coffee. Excessive caffeine during pregnancy has been linked to an increased risk of miscarriage and low birth weight. Always consult with your healthcare provider for personalized advice.
        User: Thanks!
        Assistant: You're welcome! If you have any more questions or need further assistance, feel free to ask.
        User: Thanks!
        Assistant: You're welcome! If you have any more questions or need further assistance, feel free to ask.
        </example>

        <example>
        User: How much water to drink daily?
        Assistant: Men drink around 2.5 litres of water daily, and Women drink around 2 litres.
        User: What will happen if I drink less?
        Assistant: Drinking less water can lead to dehydration, which may cause symptoms like headaches, dizziness, and fatigue. In severe cases, it can affect kidney function and overall health.
        User: And if I drink more?
        Assistant: Drinking more water than your body needs can lead to a condition called hyponatremia, where the sodium levels in your blood become too diluted. This can cause symptoms like nausea, headache, confusion, and in severe cases, it can be life-threatening.
        User: What about coffee and tea?
        Assistant: Coffee and tea can contribute to your daily fluid intake, but they also contain caffeine, which is a diuretic. This means they can increase urine production and potentially lead to dehydration if consumed in large amounts. It's best to balance them with water intake.
        User: So how much coffee is okay?
        Assistant: Moderate coffee consumption, typically defined as 3-4 cups per day (up to 400 mg of caffeine), is generally considered safe for most adults. However, individual tolerance to caffeine can vary, so it's important to listen to your body and adjust accordingly.
        User: And tea?
        Assistant: Tea, especially green and black tea, also contains caffeine but usually in lower amounts than coffee. Drinking 3-5 cups of tea per day is generally considered safe for most people. Like coffee, it's important to monitor your overall caffeine intake from all sources.
        User: What if I am pregnant?
        Assistant: If you are pregnant, it's recommended to limit caffeine intake to about 200 mg per day, which is roughly equivalent to one 12-ounce cup of coffee. Excessive caffeine during pregnancy has been linked to an increased risk of miscarriage and low birth weight. Always consult with your healthcare provider for personalized advice.
        User: I have a health condition and I need to know how much water to drink.
        Assistant: Hey! I think this is out of my reach , Setting you up with a human now. Connecting you to a supervisor...
        </example>

        Behavioral rules:
        - Be Intuitive and dont send everything to the tool(connectSuperVisor) only when you have no context or when you are gradually get more info lost or the user explicitly asks for a human.

        - Otherwise, keep replies concise and ask for only one missing detail at a time.
        - Never make up answers. If unsure, escalate via tool.
        - Do not mention that you have no access to personal data; just escalate via tool.
        - Do not mention that you have no real-time capabilities; just escalate via tool.
        - Anything you are incapable of, escalate via tool.
      `,
      tools: {
        connectSupervisor: llm.tool({
          description: `Escalate the conversation to a human supervisor when the assistant lacks capability or context. Trigger if the LLM is unsure or cannot provide a useful answer.
            - Always use this tool when the user explicitly requests to talk to a human.
            - Always use this tool when you say "i think this is out of my reach , Setting you up with a human now"
            `,
          parameters: z
            .object({
              name: z.string().optional().describe('Name of the user'),
              issue: z.string().optional().describe('Issue faced by the user'),
            })
            .strict(),
          execute: async (args, { ctx }) => {
            const name = (args?.name ?? '').trim() || undefined;
            const issue = (args?.issue ?? '').trim() || undefined;
            const roomName = ctx.userData?.room?.name;
            if (!roomName) {
              console.error('Room name is missing in userData');
              return 'Unable to connect to a supervisor because no room is associated with this session.';
            }

            console.log({ roomName });

            try {
              console.log(
                `Saving to database - Room: ${roomName}, Requestor: ${name}, Issue: ${issue}`,
              );

              await db
                .collection('rooms')
                .doc(roomName)
                .set({
                  request: RequestEnum.PENDING,
                  requestor: name ?? null,
                  issue: issue ?? null,
                  lastRequestAt: new Date(),
                });

              console.log('Successfully saved to database');
            } catch (err) {
              console.error('Database error:', (err as Error).message);
              return 'Error connecting to a supervisor: ' + (err as Error).message;
            }
            llm.handoff({
              agent: SilentAgent.create(),
            });
            return 'Connecting to a supervisor...';
          },
        }),
      },
    });
  }
}
class SilentAgent extends voice.Agent<SilentData> {
  
  async onEnter() {
    console.log('Silent voice agent entered - monitoring mode');
    
    // Update session start time
    if (this.session.userData) {
      this.session.userData.sessionStartTime = new Date();
    }
    
    // No LLM reply - completely silent
  }

  async onLeave() {
    console.log('Silent voice agent left');
    
    const userData = this.session.userData;
    if (userData?.sessionStartTime) {
      const duration = Date.now() - userData.sessionStartTime.getTime();
      console.log(`Silent agent session duration: ${Math.round(duration / 1000)} seconds`);
    }
  }

  // Override any voice processing methods to make them silent
  async onSpeechCommitted(message: string) {
    console.log(`Silent agent heard: "${message}"`);
    // Process the speech but don't respond
    this.processIncomingSpeech(message);
  }

  async onSpeechInterrupted() {
    console.log('Silent agent: Speech was interrupted');
  }

  private processIncomingSpeech(message: string) {
    // Silent processing - log keywords but don't respond
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('help') || lowerMessage.includes('support')) {
      console.log('Silent agent detected: User needs help');
    }
    
    if (lowerMessage.includes('emergency') || lowerMessage.includes('urgent')) {
      console.log('Silent agent detected: Urgent situation');
    }
    
    if (lowerMessage.includes('human') || lowerMessage.includes('supervisor')) {
      console.log('Silent agent detected: User wants human assistance');
    }
    
    
  }
  static create() {
    return new SilentAgent({
      // No instructions needed - silent agent
      instructions: '', 
      // No tools - no LLM interaction
      tools: {},
    });
  }
}
export default defineAgent({
  prewarm: async (proc: JobProcess) => {
    proc.userData.vad = await silero.VAD.load();
  },
  entry: async (ctx: JobContext) => {
    console.log('Job context:', ctx);
    

    await ctx.connect();
    console.log('Agent starting for room:', ctx.room.name);
    const participant = await ctx.waitForParticipant();
    console.log('participant joined: ', participant.identity);
    const userdata: Data = {
      room: {
        name: ctx.room.name,
      },
    };

    const identity = participant.identity;

    if (identity.endsWith('-supervisor')) {
      console.log(`Supervisor joined the room: ${identity}`);
      return;
    }

    const session = new voice.AgentSession({
      vad: ctx.proc.userData.vad! as silero.VAD,
      llm: new google.beta.realtime.RealtimeModel(),
      userData: userdata,
    });
    await session.start({
      agent: IntroAgent.create(),
      room: ctx.room,
    });
  },
});

cli.runApp(new WorkerOptions({ agent: fileURLToPath(import.meta.url) }));
