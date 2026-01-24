export const MOODS = {
    GREAT: { value: "GREAT", label: "Great", emoji: "🤩", color: "text-green-600 bg-green-100", icon: "sentiment_very_satisfied" },
    GOOD: { value: "GOOD", label: "Good", emoji: "🙂", color: "text-emerald-600 bg-emerald-100", icon: "sentiment_satisfied" },
    OKAY: { value: "OKAY", label: "Okay", emoji: "😐", color: "text-blue-600 bg-blue-100", icon: "sentiment_neutral" },
    LOW: { value: "LOW", label: "Frustrated", emoji: "😕", color: "text-orange-600 bg-orange-100", icon: "sentiment_dissatisfied" },
    BAD: { value: "BAD", label: "Overwhelmed", emoji: "😫", color: "text-red-600 bg-red-100", icon: "sentiment_very_dissatisfied" },
} as const;

export type MoodValue = keyof typeof MOODS;

export const MOOD_LIST = Object.values(MOODS);

export const getMoodConfig = (value: string) => {
    // Handle legacy numeric values
    const numericMap: Record<string, MoodValue> = {
        "1": "BAD",
        "2": "LOW",
        "3": "OKAY",
        "4": "GOOD",
        "5": "GREAT"
    };

    const normalizedValue = (numericMap[value] || value).toUpperCase();
    return MOODS[normalizedValue as MoodValue] || MOODS.OKAY;
};
