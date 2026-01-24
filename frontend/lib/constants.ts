export const CATEGORIES = [
    { id: "health", name: "Health", icon: "fitness_center" },
    { id: "finance", name: "Finance", icon: "payments" },
    { id: "productivity", name: "Productivity", icon: "bolt" },
    { id: "learning", name: "Learning", icon: "menu_book" },
];

export const STATUS_COLORS: Record<string, string> = {
    ACTIVE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    PAUSED: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    COMPLETED: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
};
