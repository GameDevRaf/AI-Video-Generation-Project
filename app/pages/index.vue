<template>
  <section class="flex flex-col items-center justify-center min-h-[calc(100vh-65px)] text-center px-6 gap-8">
    <div class="flex flex-col items-center gap-4 max-w-2xl">
      <h1 class="text-5xl font-bold tracking-tight leading-tight">
        Turn ideas into<br />polished videos
      </h1>
      <p class="text-lg text-gray-400 max-w-xl">
        Write a prompt. Get a script, scenes, images, voice, and video — all in one workspace.
      </p>
    </div>
    <div class="flex items-center gap-4">
      <NuxtLink
        to="/auth/signup"
        class="px-6 py-2.5 bg-white text-gray-950 rounded-full font-medium hover:bg-gray-100 transition-colors"
      >
        Start for free
      </NuxtLink>
      <NuxtLink
        to="/auth/login"
        class="px-6 py-2.5 text-gray-400 hover:text-white transition-colors"
      >
        Log in
      </NuxtLink>
    </div>
  </section>
</template>
