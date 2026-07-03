// @vitest-environment nuxt
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ModelSelector from '../../../app/components/workspace/ModelSelector.vue'

describe('Workspace ModelSelector', () => {
  it('restores the saved model for each stage when switching tabs', async () => {
    const wrapper = mount(ModelSelector, {
      props: {
        stage: 'script',
        savedProviderIds: ['gemini', 'runway'],
        initialProviderId: 'gemini',
        initialModelId: 'gemini-3.5-flash',
      },
    })

    expect(wrapper.text()).toContain('Gemini 3.5 Flash')

    await wrapper.setProps({
      stage: 'video',
      initialProviderId: 'runway',
      initialModelId: 'gen4',
    })
    expect(wrapper.text()).toContain('Gen-4')

    await wrapper.setProps({
      stage: 'script',
      initialProviderId: 'gemini',
      initialModelId: 'gemini-3.5-flash',
    })
    expect(wrapper.text()).toContain('Gemini 3.5 Flash')
    expect(wrapper.text()).not.toContain('Gemini 2.5 Flash')
  })

  it('emits the saved model instead of falling back to the provider default on stage changes', async () => {
    const wrapper = mount(ModelSelector, {
      props: {
        stage: 'image',
        savedProviderIds: ['fal', 'openai_image'],
        initialProviderId: 'fal',
        initialModelId: 'fal-ai/flux/schnell',
      },
    })

    await wrapper.setProps({
      stage: 'video',
      initialProviderId: 'runway',
      initialModelId: 'gen4',
      savedProviderIds: ['fal', 'openai_image', 'runway'],
    })
    await wrapper.setProps({
      stage: 'image',
      initialProviderId: 'fal',
      initialModelId: 'fal-ai/flux/schnell',
    })

    const providerChangedEvents = wrapper.emitted('providerChanged') ?? []
    expect(providerChangedEvents.at(-1)).toEqual(['fal', 'fal-ai/flux/schnell'])
  })

  it('updates when only the saved model changes for the current stage', async () => {
    const wrapper = mount(ModelSelector, {
      props: {
        stage: 'audio',
        savedProviderIds: ['elevenlabs'],
        initialProviderId: 'elevenlabs',
        initialModelId: 'eleven_multilingual_v2',
      },
    })

    await wrapper.setProps({
      initialModelId: 'eleven_v3',
    })

    expect(wrapper.text()).toContain('v3 (expressive)')
  })
})
