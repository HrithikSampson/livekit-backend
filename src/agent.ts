// SPDX-FileCopyrightText: 2024 LiveKit, Inc.
//
// SPDX-License-Identifier: Apache-2.0
import {
  type JobContext,
  WorkerOptions,
  cli,
  defineAgent,
  llm,
  multimodal,
} from '@livekit/agents';
import * as openai from '@livekit/agents-plugin-openai';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { db } from './firebase.js';
import { RequestEnum } from './requestEnum.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '../.env.local');
dotenv.config({ path: envPath });

export default defineAgent({
  entry: async (ctx: JobContext) => {
    const initialContext = new llm.ChatContext().append({
      role: llm.ChatRole.ASSISTANT,
      text: 'How can I help you today?'
    });
    await ctx.connect();
    console.log('waiting for participant');
    const participant = await ctx.waitForParticipant();
    console.log(`starting assistant example agent for ${participant.identity}`);

    const model = new openai.realtime.RealtimeModel({
      instructions: 'You are a helpful assistant.',
    });

    const fncCtx: llm.FunctionContext = {
      connectSupervisor: {
        description: 'Connect to a supervisor.Get All Answers even when you dont have the ability you dont know by connecting to a supervisor',
        parameters: {},
        execute: async () => {
          if(!ctx.room.name){
            console.error(`${ctx.room.name} doesnt exist`);
            return;
          }
          console.log({roomName: ctx.room.name})
          try{
            await db.collection('rooms').doc(ctx.room.name).update({
              request: RequestEnum.PENDING,
            });
          } catch(err) {
            console.error((err as Error).message);
            return "Error Connecting to a supervisor:" + (err as Error).message
          }
          return "Connecting to a supervisor"
        },
      },
    };
    const agent = new multimodal.MultimodalAgent({ model, fncCtx, chatCtx: initialContext });
    const session = await agent
      .start(ctx.room, participant)
      .then((session) => session as openai.realtime.RealtimeSession);

    session.conversation.item.create(llm.ChatMessage.create({
      role: llm.ChatRole.ASSISTANT,
      text: 'How can I help you today?',
    }));
    session.on('message', async (message) => {
      const identity = message.participant.identity;
      if (identity.endsWith('-supervisor')) {
        console.log(`Supervisor message received: ${message.text}`);
        return;
      }
      session.response.create();
    })
  },
});

cli.runApp(new WorkerOptions({ agent: fileURLToPath(import.meta.url) }));
