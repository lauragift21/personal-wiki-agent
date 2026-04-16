# Voice Capabilities Implementation Plan

## Overview

Add real-time voice interaction to your personal wiki agent using `@cloudflare/voice`. This will enable users to speak to their wiki agent and receive spoken responses, making the knowledge base accessible through natural conversation.

## Goals

- Enable voice conversations with the wiki agent
- Allow voice-initiated document ingestion (e.g., "Add a journal entry about...")
- Support voice-activated search queries (e.g., "Find my notes on machine learning")
- Maintain full compatibility with existing text-based chat and search tabs

## Architecture Decision

### Approach: Create a Separate Voice Agent Class

Given that your current `ChatAgent` extends `AIChatAgent` and uses `@cloudflare/ai-chat`, the cleanest approach is to create a separate `VoiceChatAgent` class that extends `withVoice(Agent)`. This avoids mixing the two agent architectures while allowing both to coexist.

**Rationale:**

- `AIChatAgent` and `withVoice(Agent)` are different base classes with different purposes
- Voice agents have a different lifecycle (calls, audio streaming, STT/TTS)
- Keeping them separate makes maintenance easier
- Both agents can share the same AI Search instance and SQLite database

## Implementation Plan

### Phase 1: Dependencies and Configuration (30 min)

#### 1.1 Install Dependencies

```bash
npm install @cloudflare/voice
```

#### 1.2 Update `wrangler.jsonc`

Add voice agent binding alongside existing ChatAgent:

```jsonc
{
  // ... existing config ...
  "durable_objects": {
    "bindings": [
      {
        "class_name": "ChatAgent",
        "name": "ChatAgent"
      },
      {
        "class_name": "VoiceChatAgent",
        "name": "VoiceChatAgent"
      }
    ]
  },
  "migrations": [
    {
      "new_sqlite_classes": ["ChatAgent", "VoiceChatAgent"],
      "tag": "v1"
    }
  ]
}
```

### Phase 2: Server-Side Voice Agent (60 min)

#### 2.1 Create `src/voice-agent.ts`

A new agent class that:

- Extends `withVoice(Agent)`
- Uses `WorkersAIFluxSTT` for speech-to-text
- Uses `WorkersAITTS` for text-to-speech
- Integrates with existing AI Search for wiki queries
- Reuses SQLite for conversation persistence

**Key Features:**

- `onTurn()` method processes voice input and generates responses
- Integrates wiki search tools in voice responses
- Supports streaming LLM responses with sentence-chunked TTS
- Pipeline hooks for logging and content filtering

**Structure:**

```typescript
import { Agent } from "agents";
import {
  withVoice,
  WorkersAIFluxSTT,
  WorkersAITTS,
  type VoiceTurnContext
} from "@cloudflare/voice";
import { streamText, tool } from "ai";
import { createWorkersAI } from "workers-ai-provider";
import { z } from "zod";
import { searchWiki, uploadDocument, listDocuments } from "./ai-search";

const VoiceAgent = withVoice(Agent);

export class VoiceChatAgent extends VoiceAgent<Env> {
  transcriber = new WorkersAIFluxSTT(this.env.AI);
  tts = new WorkersAITTS(this.env.AI);

  // Shared AI Search instance
  private instance: AiSearchInstance | null = null;
  private initialized = false;

  async onStart() {
    // Initialize AI Search (same logic as ChatAgent)
    await this.initializeWiki();

    // Log voice agent startup
    await this.logActivity(
      "system",
      "Voice agent started",
      "Voice-enabled wiki agent ready"
    );
  }

  async onTurn(transcript: string, context: VoiceTurnContext) {
    // Use streaming LLM with wiki search tools
    // Return textStream for sentence-chunked TTS
  }

  // Wiki tools (queryWiki, ingestDocument via voice commands)
  // Activity logging to SQLite
}
```

#### 2.2 Update `src/server.ts`

Add voice agent routing to the existing fetch handler:

```typescript
import { VoiceChatAgent } from "./voice-agent";

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);

    // Existing health check
    if (url.pathname === "/health") {
      // ... existing health check code ...
    }

    // Route to appropriate agent
    return (
      (await routeAgentRequest(request, env)) ||
      new Response("Not found", { status: 404 })
    );
  }
} satisfies ExportedHandler<Env>;
```

### Phase 3: Client-Side Voice UI (90 min)

#### 3.1 Add Voice Controls to Chat Tab

Add a voice call button to the existing chat interface in `src/app.tsx`:

**New Components/States:**

- `isVoiceCallActive` - Track voice call state
- `voiceStatus` - "idle" | "listening" | "thinking" | "speaking"
- `voiceTranscript` - Current voice conversation transcript

**Voice UI Elements:**

- Floating voice button (microphone icon) in the chat input area
- Voice call modal/overlay with:
  - Status indicator (pulsing animation when listening)
  - Live transcript display
  - Mute/unmute button
  - End call button
  - Audio level visualization (optional)

#### 3.2 Implement `useVoiceAgent` Hook

```typescript
import { useVoiceAgent } from "@cloudflare/voice/react";

function Chat() {
  const [showVoiceUI, setShowVoiceUI] = useState(false);

  const {
    status,
    transcript,
    interimTranscript,
    audioLevel,
    isMuted,
    connected,
    startCall,
    endCall,
    toggleMute
  } = useVoiceAgent({
    agent: "VoiceChatAgent"
  });

  // ... existing chat code ...
}
```

#### 3.3 Voice UI Component Design

```
┌─────────────────────────────────────────────────────────┐
│  wiki-agent                                  [Theme] 🗑 │
│  [Chat] [Search]                                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │                                                 │   │
│  │   🎤 Voice Conversation                        │   │
│  │                                                 │   │
│  │   ┌─────────┐                                   │   │
│  │   │  ◉◉◉   │  Listening...                     │   │
│  │   │  ◉◉◉   │                                   │   │
│  │   └─────────┘                                   │   │
│  │                                                 │   │
│  │   "Find my notes on machine learning"          │   │
│  │                                                 │   │
│  │   [🔇 Mute]              [End Call 🔴]         │   │
│  │                                                 │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  [🎤] Type a message...                        [Send]  │
└─────────────────────────────────────────────────────────┘
```

### Phase 4: Voice-Specific Features (60 min)

#### 4.1 Wiki Search Integration in Voice

When user speaks a query:

1. Transcribe speech to text
2. Detect if it's a search query (keywords: "find", "search", "look up", "what do I know about")
3. Execute `queryWiki` tool
4. Synthesize search results into natural speech response

Example:

- User: "What do I know about machine learning?"
- Agent searches wiki, finds relevant documents
- Agent speaks: "You have 3 notes about machine learning. The most relevant is titled 'ML Fundamentals' which covers neural networks and training procedures. Would you like me to read it to you?"

#### 4.2 Voice Document Ingestion

Allow users to dictate documents:

- User: "Add a journal entry about my meeting today"
- Agent: "What's the content?"
- User speaks the journal content
- Agent uses `ingestDocument` tool to save it

#### 4.3 Conversation History Persistence

Voice conversations are automatically persisted to SQLite via the `withVoice` mixin. This means:

- Users can see voice transcripts in chat history
- Voice and text conversations are unified
- Conversation context is maintained across sessions

### Phase 5: Testing and Refinement (45 min)

#### 5.1 Testing Checklist

- [ ] Voice call starts successfully
- [ ] Speech is transcribed accurately
- [ ] Wiki search works via voice
- [ ] Document ingestion works via voice
- [ ] TTS responses are clear and natural
- [ ] Interruption handling works (user can interrupt agent)
- [ ] Conversation history persists
- [ ] Voice and text modes can be switched
- [ ] Mute/unmute works
- [ ] End call properly cleans up

#### 5.2 Performance Considerations

- Use `WorkersAIFluxSTT` for conversational turn detection
- Leverage streaming TTS for faster time-to-first-audio
- Consider adding `silenceThreshold` and `silenceDurationMs` tuning for different environments

## Files to Create/Modify

### New Files:

1. `src/voice-agent.ts` - Voice-enabled agent class
2. `src/components/VoiceCallModal.tsx` - Voice UI component (optional separation)

### Modified Files:

1. `package.json` - Add `@cloudflare/voice` dependency
2. `wrangler.jsonc` - Add VoiceChatAgent binding
3. `src/server.ts` - Import and export VoiceChatAgent
4. `src/app.tsx` - Add voice UI and `useVoiceAgent` hook

## Technical Specifications

### Audio Format

- Input: 16kHz mono 16-bit PCM (handled automatically by client)
- Output: MP3 (default from `WorkersAITTS`)

### Models Used

- STT: `@cf/deepgram/flux` (conversational, good turn detection)
- TTS: `@cf/deepgram/aura-1` (natural speech synthesis)
- LLM: Same as existing (`@cf/moonshotai/kimi-k2.5`)

### State Management

- Voice conversations: Auto-persisted to SQLite via `withVoice`
- Agent status: Tracked via `status` from `useVoiceAgent`
- Wiki state: Shared between ChatAgent and VoiceChatAgent via AI Search

## Future Enhancements (Post-MVP)

1. **Voice Commands Only Mode**: Use `withVoiceInput` for dictation without responses
2. **Multi-language Support**: Switch STT/TTS models based on detected language
3. **Telephony Integration**: Add Twilio adapter for phone calls
4. **Voice Search Tab**: Dedicated voice-only search interface
5. **Audio Level Visualization**: Real-time mic level display
6. **Voice Settings**: Allow users to choose TTS voice/speaker

## Deployment Notes

After implementing:

1. Run `npm install` to add new dependency
2. Run `npm run types` to regenerate TypeScript types
3. Deploy with `npm run deploy`
4. The voice agent will be available at the same URL with WebSocket upgrade

## Estimated Timeline

- Phase 1 (Dependencies): 30 min
- Phase 2 (Server Agent): 60 min
- Phase 3 (Client UI): 90 min
- Phase 4 (Voice Features): 60 min
- Phase 5 (Testing): 45 min

**Total: ~4.5 hours**

## Risks and Mitigations

| Risk                              | Mitigation                                                               |
| --------------------------------- | ------------------------------------------------------------------------ |
| Browser microphone permissions    | Clear UX explaining why mic access is needed                             |
| Network latency for voice         | Use streaming; Cloudflare's edge network minimizes latency               |
| STT accuracy with technical terms | Can add `keyterms` option to `WorkersAIFluxSTT`                          |
| TTS quality concerns              | Workers AI Aura model is high quality; can swap for ElevenLabs if needed |
| Conflicts with existing WebSocket | Use separate agent name/endpoint for voice                               |
