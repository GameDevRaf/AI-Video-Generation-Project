// @vitest-environment nuxt
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import ScriptEditor from '../../../app/components/stages/ScriptEditor.vue'
import { useProjectStore } from '../../../app/stores/project'
import type { DbProject, DbProjectSettings } from '../../../app/types/database.types'

function makeProject(): DbProject {
  return {
    id: 'p1',
    user_id: 'u1',
    name: 'Test project',
    description: null,
    status: 'active',
    current_stage: 'script',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  }
}

function makeSettings(targetDurationSeconds: number): DbProjectSettings {
  return {
    id: 's1',
    project_id: 'p1',
    prompt_edit_mode: 'after_generation',
    default_image_model: null,
    default_audio_model: null,
    default_video_model: null,
    default_music_model: null,
    timeline_density: null,
    default_script_provider: null,
    default_image_provider: null,
    default_audio_provider: null,
    default_video_provider: null,
    default_script_model: null,
    skip_video_gen: false,
    target_duration_seconds: targetDurationSeconds,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  }
}

function words(n: number): string {
  return Array.from({ length: n }, (_, i) => `word${i}`).join(' ')
}

describe('ScriptEditor — Script Length Guard warning', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('shows no warning when the script is within the target', () => {
    const projectStore = useProjectStore()
    projectStore.currentProject = makeProject()
    projectStore.settings = makeSettings(60) // ~130 words

    const wrapper = mount(ScriptEditor, {
      props: { projectId: 'p1', initialText: words(50), outputId: 'out-1' },
    })

    expect(wrapper.find('[data-testid="script-length-warning"]').exists()).toBe(false)
  })

  it('shows an amber warning (not hard-blocked) when over the target but under the 3m ceiling', () => {
    const projectStore = useProjectStore()
    projectStore.currentProject = makeProject()
    projectStore.settings = makeSettings(60) // target ~130 words

    const wrapper = mount(ScriptEditor, {
      props: { projectId: 'p1', initialText: words(200), outputId: 'out-1' }, // ~92s, over 60s target
    })

    const warning = wrapper.find('[data-testid="script-length-warning"]')
    expect(warning.exists()).toBe(true)
    expect(warning.text()).toContain('60s target')
    expect(warning.text()).not.toContain('hard limit')
  })

  it('escalates to the hard-ceiling warning when far over the 3-minute limit', () => {
    const projectStore = useProjectStore()
    projectStore.currentProject = makeProject()
    projectStore.settings = makeSettings(180)

    const wrapper = mount(ScriptEditor, {
      props: { projectId: 'p1', initialText: words(500), outputId: 'out-1' }, // ~231s > 210s ceiling
    })

    const warning = wrapper.find('[data-testid="script-length-warning"]')
    expect(warning.exists()).toBe(true)
    expect(warning.text()).toContain('hard limit')
  })

  it('clears the warning once the script is trimmed below the target', async () => {
    const projectStore = useProjectStore()
    projectStore.currentProject = makeProject()
    projectStore.settings = makeSettings(60)

    const wrapper = mount(ScriptEditor, {
      props: { projectId: 'p1', initialText: words(200), outputId: 'out-1' },
    })
    expect(wrapper.find('[data-testid="script-length-warning"]').exists()).toBe(true)

    await wrapper.get('textarea').setValue(words(20))

    expect(wrapper.find('[data-testid="script-length-warning"]').exists()).toBe(false)
  })

  it('emits regenerate when the Regenerate button is clicked', async () => {
    const projectStore = useProjectStore()
    projectStore.currentProject = makeProject()
    projectStore.settings = makeSettings(60)

    const wrapper = mount(ScriptEditor, {
      props: { projectId: 'p1', initialText: words(200), outputId: 'out-1' },
    })

    await wrapper.get('[data-testid="script-length-regenerate"]').trigger('click')

    expect(wrapper.emitted('regenerate')).toBeTruthy()
  })

  it('allows using the script when under the 3-minute hard ceiling', async () => {
    const projectStore = useProjectStore()
    projectStore.currentProject = makeProject()
    projectStore.settings = makeSettings(180)

    const wrapper = mount(ScriptEditor, {
      props: { projectId: 'p1', initialText: words(200), outputId: 'out-1' },
    })

    const useButton = wrapper.get('[data-testid="use-script-button"]')
    expect(useButton.attributes('disabled')).toBeUndefined()

    await useButton.trigger('click')

    expect(wrapper.emitted('use')).toBeTruthy()
  })

  it('disables Use this script and blocks locking in when over the 3-minute hard ceiling', async () => {
    const projectStore = useProjectStore()
    projectStore.currentProject = makeProject()
    projectStore.settings = makeSettings(180)

    const wrapper = mount(ScriptEditor, {
      props: { projectId: 'p1', initialText: words(500), outputId: 'out-1' }, // ~231s > 210s ceiling
    })

    const useButton = wrapper.get('[data-testid="use-script-button"]')
    expect(useButton.attributes('disabled')).toBeDefined()

    await useButton.trigger('click')

    expect(wrapper.emitted('use')).toBeUndefined()
  })

  it('re-enables Use this script once trimmed back under the hard ceiling', async () => {
    const projectStore = useProjectStore()
    projectStore.currentProject = makeProject()
    projectStore.settings = makeSettings(180)

    const wrapper = mount(ScriptEditor, {
      props: { projectId: 'p1', initialText: words(500), outputId: 'out-1' },
    })
    expect(wrapper.get('[data-testid="use-script-button"]').attributes('disabled')).toBeDefined()

    await wrapper.get('textarea').setValue(words(50))

    const useButton = wrapper.get('[data-testid="use-script-button"]')
    expect(useButton.attributes('disabled')).toBeUndefined()
    await useButton.trigger('click')
    expect(wrapper.emitted('use')).toBeTruthy()
  })
})
