<template>
  <Teleport to="body">
    <TransitionGroup
      tag="div"
      name="toast"
      class="fixed top-4 right-4 z-[60] flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)] pointer-events-none"
    >
      <div
        v-for="n in notifications.items"
        :key="n.id"
        class="pointer-events-auto flex flex-col gap-1.5 p-4 rounded-xl border border-amber-500/30 bg-amber-950/90 backdrop-blur shadow-2xl"
        data-testid="toast-notification"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="flex flex-col gap-0.5 min-w-0">
            <span class="text-sm font-semibold text-amber-300 break-words">{{ n.heading }}</span>
            <span v-if="n.subheading" class="text-xs text-amber-400/70">{{ n.subheading }}</span>
          </div>
          <button
            class="shrink-0 -mr-1 -mt-1 p-1 text-amber-400/60 hover:text-amber-200 transition-colors"
            title="Dismiss"
            data-testid="toast-dismiss"
            @click="notifications.dismiss(n.id)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 6 6 18" /><path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        <p v-if="n.body" class="text-sm text-amber-100/80 leading-relaxed break-words max-h-40 overflow-y-auto">
          {{ n.body }}
        </p>

        <div v-if="n.onRetry" class="flex justify-end pt-0.5">
          <button
            :disabled="n.retrying"
            class="px-3 py-1 rounded-lg border border-amber-400/40 text-amber-200 text-xs font-medium hover:bg-amber-400/10 transition-colors disabled:opacity-50"
            data-testid="toast-retry"
            @click="notifications.retry(n.id)"
          >
            <span v-if="n.retrying" class="flex items-center gap-1.5">
              <span class="inline-block w-3 h-3 border-2 border-amber-300/50 border-t-transparent rounded-full animate-spin" />
              Retrying…
            </span>
            <span v-else>Retry</span>
          </button>
        </div>
      </div>
    </TransitionGroup>
  </Teleport>
</template>

<script setup lang="ts">
const notifications = useNotificationsStore()
</script>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: opacity 200ms ease, transform 200ms ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(1rem);
}
/* Smoothly reflow remaining toasts when one is removed from the stack. */
.toast-move {
  transition: transform 200ms ease;
}
.toast-leave-active {
  position: absolute;
  right: 0;
  width: 100%;
}
</style>
