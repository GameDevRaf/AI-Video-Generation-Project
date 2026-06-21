<template>
  <div class="min-h-screen bg-gray-950 text-white">
    <header class="flex items-center justify-between px-6 py-4 border-b border-white/10">
      <NuxtLink to="/" class="text-lg font-semibold tracking-tight">VideoAI</NuxtLink>
      <nav class="flex items-center gap-4">
        <NuxtLink to="/auth/login" class="text-sm text-gray-400 hover:text-white transition-colors">Log in</NuxtLink>
        <NuxtLink to="/auth/signup" class="text-sm px-4 py-1.5 bg-white text-gray-950 rounded-full font-medium hover:bg-gray-100 transition-colors">
          Get started
        </NuxtLink>
      </nav>
    </header>
    <main>
      <slot />
    </main>
  </div>
</template>
