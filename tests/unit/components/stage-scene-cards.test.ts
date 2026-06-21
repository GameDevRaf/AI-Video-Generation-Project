// @vitest-environment nuxt
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
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
