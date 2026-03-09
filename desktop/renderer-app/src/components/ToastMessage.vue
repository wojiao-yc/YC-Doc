<template>
  <div v-if="toast.show" class="toast">{{ toast.text }}</div>
</template>

<script setup>
defineProps({
  toast: {
    type: Object,
    required: true
  }
});
</script>
