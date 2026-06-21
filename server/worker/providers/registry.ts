import type { ScriptProvider, ImageProvider, AudioProvider, VideoProvider } from './types'
import { AnthropicScriptProvider } from './script/anthropic'
import { OpenAIScriptProvider } from './script/openai'
import { GeminiScriptProvider } from './script/gemini'
import { GroqScriptProvider } from './script/groq'
import { MistralScriptProvider } from './script/mistral'
import { OpenRouterScriptProvider } from './script/openrouter'
import { HuggingFaceScriptProvider } from './script/huggingface'
import { FalImageProvider } from './image/fal'
import { OpenAIImageProvider } from './image/openai_image'
import { StabilityImageProvider } from './image/stability'
import { IdeogramImageProvider } from './image/ideogram'
import { TogetherImageProvider } from './image/together_image'
import { NanaBananaImageProvider } from './image/nanobanana'
import { ReplicateImageProvider } from './image/replicate'
import { HuggingFaceImageProvider } from './image/huggingface_image'
import { ElevenLabsAudioProvider } from './audio/elevenlabs'
import { OpenAITTSProvider } from './audio/openai_tts'
import { PlayHTAudioProvider } from './audio/playht'
import { CartesiaAudioProvider } from './audio/cartesia'
import { FishAudioProvider } from './audio/fish_audio'
import { GeminiTTSProvider } from './audio/gemini_tts'
import { HuggingFaceAudioProvider } from './audio/huggingface_audio'
import { RunwayVideoProvider } from './video/runway'
import { KlingVideoProvider } from './video/kling'
import { LumaVideoProvider } from './video/luma'
import { MiniMaxVideoProvider } from './video/minimax'
import { FalVideoProvider } from './video/fal_video'
import { VeoVideoProvider } from './video/veo'
import { ReplicateVideoProvider } from './video/replicate_video'
import { HuggingFaceVideoProvider } from './video/huggingface_video'

const scriptProviders: Record<string, ScriptProvider> = {
  anthropic:   new AnthropicScriptProvider(),
  openai:      new OpenAIScriptProvider(),
  gemini:      new GeminiScriptProvider(),
  groq:        new GroqScriptProvider(),
  mistral:     new MistralScriptProvider(),
  openrouter:  new OpenRouterScriptProvider(),
  huggingface: new HuggingFaceScriptProvider(),
}

const imageProviders: Record<string, ImageProvider> = {
  fal:               new FalImageProvider(),
  openai_image:      new OpenAIImageProvider(),
  stability:         new StabilityImageProvider(),
  ideogram:          new IdeogramImageProvider(),
  together_image:    new TogetherImageProvider(),
  nanobanana:        new NanaBananaImageProvider(),
  replicate:         new ReplicateImageProvider(),
  huggingface_image: new HuggingFaceImageProvider(),
}

const audioProviders: Record<string, AudioProvider> = {
  elevenlabs:        new ElevenLabsAudioProvider(),
  openai_tts:        new OpenAITTSProvider(),
  playht:            new PlayHTAudioProvider(),
  cartesia:          new CartesiaAudioProvider(),
  fish_audio:        new FishAudioProvider(),
  gemini_tts:        new GeminiTTSProvider(),
  huggingface_audio: new HuggingFaceAudioProvider(),
}

const videoProviders: Record<string, VideoProvider> = {
  runway:             new RunwayVideoProvider(),
  kling:              new KlingVideoProvider(),
  luma:               new LumaVideoProvider(),
  minimax:            new MiniMaxVideoProvider(),
  fal_video:          new FalVideoProvider(),
  veo:                new VeoVideoProvider(),
  replicate_video:    new ReplicateVideoProvider(),
  huggingface_video:  new HuggingFaceVideoProvider(),
}

function resolve<T>(map: Record<string, T>, id: string, type: string): T {
  const p = map[id]
  if (!p) throw new Error(`Unknown ${type} provider: "${id}". Check your project settings.`)
  return p
}

export const providerRegistry = {
  script: (id: string): ScriptProvider => resolve(scriptProviders, id, 'script'),
  image:  (id: string): ImageProvider  => resolve(imageProviders,  id, 'image'),
  audio:  (id: string): AudioProvider  => resolve(audioProviders,  id, 'audio'),
  video:  (id: string): VideoProvider  => resolve(videoProviders,  id, 'video'),
}
