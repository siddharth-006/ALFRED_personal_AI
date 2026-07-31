export interface StreakData {
  currentStreak: number;
  lastActiveDate: string | null;
}

const STREAK_KEY = "alfred_streak";

export const getStreakData = (): StreakData => {
  if (typeof window === "undefined") {
    return { currentStreak: 0, lastActiveDate: null };
  }

  const stored = localStorage.getItem(STREAK_KEY);
  if (stored) {
    return JSON.parse(stored);
  }
  return { currentStreak: 0, lastActiveDate: null };
};

export const saveStreakData = (data: StreakData): void => {
  if (typeof window !== "undefined") {
    localStorage.setItem(STREAK_KEY, JSON.stringify(data));
  }
};

export const getTodayDate = (): string => {
  const today = new Date();
  return today.toISOString().split("T")[0];
};

export const getYesterdayDate = (): string => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().split("T")[0];
};

export const updateStreak = (): StreakData => {
  const today = getTodayDate();
  const yesterday = getYesterdayDate();
  const current = getStreakData();

  // First activity ever
  if (current.lastActiveDate === null) {
    const newData = { currentStreak: 1, lastActiveDate: today };
    saveStreakData(newData);
    return newData;
  }

  // Already active today, don't increment
  if (current.lastActiveDate === today) {
    return current;
  }

  // Last active was yesterday, increment
  if (current.lastActiveDate === yesterday) {
    const newData = { currentStreak: current.currentStreak + 1, lastActiveDate: today };
    saveStreakData(newData);
    return newData;
  }

  // More than 1 day gap, reset
  const newData = { currentStreak: 1, lastActiveDate: today };
  saveStreakData(newData);
  return newData;
};

export const resetStreak = (): StreakData => {
  const newData = { currentStreak: 0, lastActiveDate: null };
  saveStreakData(newData);
  return newData;
};