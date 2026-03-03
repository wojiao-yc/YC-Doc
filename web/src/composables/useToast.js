import { onBeforeUnmount, onMounted, ref } from "vue";

export const useToast = () => {
  const toast = ref({ show: false, text: "" });
  let timer = null;

  const showToast = (text) => {
    toast.value = { show: true, text: String(text || "") };
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      toast.value.show = false;
    }, 900);
  };

  const onToastEvent = (event) => {
    showToast(event?.detail || "完成");
  };

  onMounted(() => {
    window.addEventListener("app-toast", onToastEvent);
  });

  onBeforeUnmount(() => {
    window.removeEventListener("app-toast", onToastEvent);
    if (timer) {
      clearTimeout(timer);
    }
  });

  return { toast, showToast };
};
