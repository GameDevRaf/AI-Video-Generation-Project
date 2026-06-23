// @vitest-environment nuxt
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import ImageSceneCard from '../../../app/components/stages/ImageSceneCard.vue'
import VideoSceneCard from '../../../app/components/stages/VideoSceneCard.vue'

const scene = {
  id: 'scene-1',
  project_id: 'project-1',
  job_id: null,
  scene_index: 0,
  title: 'Opening',
  script_text: 'Hello',
  start_time: 0,
  end_time: 5,
  duration: 5,
  order_index: 0,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

describe('stage scene cards', () => {
  it('emits the scene id when image prompt regeneration is clicked', async () => {
    const wrapper = mount(ImageSceneCard, {
      props: {
        scene,
        prompt: 'wide cinematic shot',
        hasPrompt: true,
        imageUrl: 'https://cdn.test/scene.png',
        generating: false,
        generatingPrompt: false,
      },
    })

    await wrapper.get('[data-testid="image-regenerate-prompt"]').trigger('click')

    expect(wrapper.emitted('regenerate-prompt')).toEqual([['scene-1']])
  })

  it('emits view-image when an image thumbnail is clicked', async () => {
    const wrapper = mount(ImageSceneCard, {
      props: {
        scene,
        prompt: 'wide cinematic shot',
        hasPrompt: true,
        imageUrl: 'https://cdn.test/scene.png',
        generating: false,
        generatingPrompt: false,
      },
    })

    await wrapper.get('[data-testid="image-preview-trigger"]').trigger('click')

    expect(wrapper.emitted('view-image')).toEqual([['scene-1']])
  })

  it('emits the scene id when video prompt regeneration is clicked', async () => {
    const wrapper = mount(VideoSceneCard, {
      props: {
        scene,
        prompt: 'slow dolly in',
        videoUrl: 'https://cdn.test/scene.mp4',
        imageUrl: null,
        isActive: true,
        generating: false,
        generatingPrompt: false,
      },
    })

    await wrapper.get('[data-testid="video-regenerate-prompt"]').trigger('click')

    expect(wrapper.emitted('regenerate-prompt')).toEqual([['scene-1']])
  })
})

// ── ImageSceneCard prompt watcher behaviour ────────────────────────────────────

describe('ImageSceneCard prompt watcher', () => {
  it('syncs new prompt from parent when user has not edited', async () => {
    const wrapper = mount(ImageSceneCard, {
      props: {
        scene, prompt: 'original AI prompt', hasPrompt: true,
        imageUrl: null, generating: false, generatingPrompt: false,
      },
    })
    const textarea = wrapper.get('textarea')
    expect(textarea.element.value).toBe('original AI prompt')

    await wrapper.setProps({ prompt: 'new AI prompt' })
    await nextTick()

    expect(textarea.element.value).toBe('new AI prompt')
  })

  it('preserves user edit when parent prompt prop changes (tab-switch simulation)', async () => {
    const wrapper = mount(ImageSceneCard, {
      props: {
        scene, prompt: 'original AI prompt', hasPrompt: true,
        imageUrl: null, generating: false, generatingPrompt: false,
      },
    })
    const textarea = wrapper.get('textarea')

    await textarea.setValue('my manual edit')
    await textarea.trigger('input')

    await wrapper.setProps({ prompt: 'original AI prompt' })
    await nextTick()

    expect(textarea.element.value).toBe('my manual edit')
  })

  it('preserves user edit even when parent cycles through optimistic-update and back', async () => {
    const wrapper = mount(ImageSceneCard, {
      props: {
        scene, prompt: 'original AI prompt', hasPrompt: true,
        imageUrl: null, generating: false, generatingPrompt: false,
      },
    })
    const textarea = wrapper.get('textarea')

    await textarea.setValue('my edit')
    await textarea.trigger('input')

    await wrapper.setProps({ prompt: 'my edit' })
    await nextTick()

    await wrapper.setProps({ prompt: 'original AI prompt' })
    await nextTick()

    expect(textarea.element.value).toBe('my edit')
  })

  it('accepts new prompt from AI regeneration when generatingPrompt goes true→false', async () => {
    const wrapper = mount(ImageSceneCard, {
      props: {
        scene, prompt: 'original AI prompt', hasPrompt: true,
        imageUrl: null, generating: false, generatingPrompt: false,
      },
    })
    const textarea = wrapper.get('textarea')

    await textarea.setValue('my edit')
    await textarea.trigger('input')

    await wrapper.setProps({ generatingPrompt: true })
    await wrapper.setProps({ generatingPrompt: false })
    await nextTick()

    await wrapper.setProps({ prompt: 'fresh AI prompt' })
    await nextTick()

    expect(textarea.element.value).toBe('fresh AI prompt')
  })
})

// ── Image orange dot: only on tab return (dataLoaded) ─────────────────────────

describe('ImageSceneCard prompt mismatch indicator', () => {
  it('shows orange dot when dataLoaded fires with mismatched prompts', async () => {
    const wrapper = mount(ImageSceneCard, {
      props: {
        scene,
        prompt: 'my edited prompt',
        generationPrompt: 'original generation prompt',
        dataLoaded: false,
        hasPrompt: true,
        imageUrl: 'https://cdn.test/scene.png',
        generating: false,
        generatingPrompt: false,
      },
    })

    // No dot before data has loaded
    expect(wrapper.find('[data-testid="prompt-mismatch-dot"]').exists()).toBe(false)

    // Parent signals both fetchPrompts and fetchImages have resolved
    await wrapper.setProps({ dataLoaded: true })
    await nextTick()

    expect(wrapper.find('[data-testid="prompt-mismatch-dot"]').exists()).toBe(true)
  })

  it('hides orange dot when saved prompt matches generation prompt', async () => {
    const wrapper = mount(ImageSceneCard, {
      props: {
        scene,
        prompt: 'same prompt',
        generationPrompt: 'same prompt',
        dataLoaded: true,
        hasPrompt: true,
        imageUrl: 'https://cdn.test/scene.png',
        generating: false,
        generatingPrompt: false,
      },
    })
    await nextTick()

    expect(wrapper.find('[data-testid="prompt-mismatch-dot"]').exists()).toBe(false)
  })

  it('hides orange dot when there is no image yet', async () => {
    const wrapper = mount(ImageSceneCard, {
      props: {
        scene,
        prompt: 'edited prompt',
        generationPrompt: 'different generation prompt',
        dataLoaded: true,
        hasPrompt: true,
        imageUrl: null,
        generating: false,
        generatingPrompt: false,
      },
    })
    await nextTick()

    expect(wrapper.find('[data-testid="prompt-mismatch-dot"]').exists()).toBe(false)
  })

  it('hides orange dot when generationPrompt is not yet available (old image before metadata)', async () => {
    const wrapper = mount(ImageSceneCard, {
      props: {
        scene,
        prompt: 'any prompt',
        generationPrompt: '',
        dataLoaded: true,
        hasPrompt: true,
        imageUrl: 'https://cdn.test/scene.png',
        generating: false,
        generatingPrompt: false,
      },
    })
    await nextTick()

    expect(wrapper.find('[data-testid="prompt-mismatch-dot"]').exists()).toBe(false)
  })

  it('clears the dot when a new image generation resolves the mismatch', async () => {
    const wrapper = mount(ImageSceneCard, {
      props: {
        scene,
        prompt: 'current prompt',
        generationPrompt: 'old prompt',
        dataLoaded: true,
        hasPrompt: true,
        imageUrl: 'https://cdn.test/scene.png',
        generating: false,
        generatingPrompt: false,
      },
    })
    await nextTick()
    expect(wrapper.find('[data-testid="prompt-mismatch-dot"]').exists()).toBe(true)

    // User generates with "current prompt" → fetchImages updates generationPrompt to match
    await wrapper.setProps({ generationPrompt: 'current prompt' })
    await nextTick()

    expect(wrapper.find('[data-testid="prompt-mismatch-dot"]').exists()).toBe(false)
  })

  it('does not show dot when user edits during active session (no new dataLoaded transition)', async () => {
    const wrapper = mount(ImageSceneCard, {
      props: {
        scene,
        prompt: 'original',
        generationPrompt: 'original',
        dataLoaded: true,
        hasPrompt: true,
        imageUrl: 'https://cdn.test/scene.png',
        generating: false,
        generatingPrompt: false,
      },
    })
    await nextTick()
    expect(wrapper.find('[data-testid="prompt-mismatch-dot"]').exists()).toBe(false)

    // In-session edit: props.prompt changes (optimistic save) but no new dataLoaded edge
    await wrapper.setProps({ prompt: 'edited in session' })
    await nextTick()

    expect(wrapper.find('[data-testid="prompt-mismatch-dot"]').exists()).toBe(false)
  })
})

// ── VideoSceneCard prompt mismatch indicator ───────────────────────────────────

describe('VideoSceneCard prompt mismatch indicator', () => {
  it('shows orange dot when dataLoaded fires with mismatched prompts', async () => {
    const wrapper = mount(VideoSceneCard, {
      props: {
        scene,
        prompt: 'my edited motion prompt',
        generationPrompt: 'original motion prompt',
        dataLoaded: false,
        videoUrl: 'https://cdn.test/scene.mp4',
        imageUrl: null,
        isActive: false,
        generating: false,
      },
    })

    expect(wrapper.find('[data-testid="video-prompt-mismatch-dot"]').exists()).toBe(false)

    await wrapper.setProps({ dataLoaded: true })
    await nextTick()

    expect(wrapper.find('[data-testid="video-prompt-mismatch-dot"]').exists()).toBe(true)
  })

  it('hides orange dot when video prompts match', async () => {
    const wrapper = mount(VideoSceneCard, {
      props: {
        scene,
        prompt: 'same motion prompt',
        generationPrompt: 'same motion prompt',
        dataLoaded: true,
        videoUrl: 'https://cdn.test/scene.mp4',
        imageUrl: null,
        isActive: false,
        generating: false,
      },
    })
    await nextTick()

    expect(wrapper.find('[data-testid="video-prompt-mismatch-dot"]').exists()).toBe(false)
  })

  it('hides orange dot when there is no video yet', async () => {
    const wrapper = mount(VideoSceneCard, {
      props: {
        scene,
        prompt: 'edited',
        generationPrompt: 'different',
        dataLoaded: true,
        videoUrl: null,
        imageUrl: null,
        isActive: false,
        generating: false,
      },
    })
    await nextTick()

    expect(wrapper.find('[data-testid="video-prompt-mismatch-dot"]').exists()).toBe(false)
  })

  it('clears the dot when a new video generation resolves the mismatch', async () => {
    const wrapper = mount(VideoSceneCard, {
      props: {
        scene,
        prompt: 'current motion',
        generationPrompt: 'old motion',
        dataLoaded: true,
        videoUrl: 'https://cdn.test/scene.mp4',
        imageUrl: null,
        isActive: false,
        generating: false,
      },
    })
    await nextTick()
    expect(wrapper.find('[data-testid="video-prompt-mismatch-dot"]').exists()).toBe(true)

    await wrapper.setProps({ generationPrompt: 'current motion' })
    await nextTick()

    expect(wrapper.find('[data-testid="video-prompt-mismatch-dot"]').exists()).toBe(false)
  })
})
