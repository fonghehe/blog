import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute } from "vitepress";
import { readFilters, writeFilters, type Filters } from "./post-list";

export function usePostFilters(categories: string[]) {
  const route = useRoute();
  const filters = ref<Filters>({ query: "", category: null, page: 1 });

  function restore() {
    filters.value = readFilters(window.location.search, categories);
  }

  function update(patch: Partial<Filters>, replace = false) {
    filters.value = { ...filters.value, ...patch };
    if (typeof window === "undefined") return;
    const href = writeFilters(window.location.href, filters.value);
    if (href === window.location.pathname + window.location.search + window.location.hash) return;
    window.history[replace ? "replaceState" : "pushState"](
      window.history.state, "", href,
    );
  }

  onMounted(() => {
    restore();
    window.addEventListener("popstate", restore);
  });
  onUnmounted(() => window.removeEventListener("popstate", restore));
  watch(() => route.path, () => {
    if (typeof window !== "undefined") restore();
  });

  const query = computed({
    get: () => filters.value.query,
    set: (query: string) => update({ query, page: 1 }, true),
  });
  const page = computed({
    get: () => filters.value.page,
    set: (page: number) => update({ page }),
  });
  const category = computed(() => filters.value.category);
  function selectCategory(id: string) {
    update({ category: filters.value.category === id ? null : id, page: 1 });
  }
  function clear() {
    update({ query: "", category: null, page: 1 });
  }
  return { filters, query, page, category, selectCategory, clear, update };
}
