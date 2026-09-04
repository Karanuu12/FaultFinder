export const leaderboardData = [
  {
    name: "Yuki Tanaka",
    focusMinutes: 4820,
    sessions: 156,
    streak: 32,
    rank: 1,
    color: "#5e2ac4",
    initial: "Y",
  },
  {
    name: "Samiran De",
    focusMinutes: 4590,
    sessions: 142,
    streak: 14,
    rank: 2,
    color: "#359462",
    initial: "S",
  },
  {
    name: "Michael Chen",
    focusMinutes: 4310,
    sessions: 138,
    streak: 21,
    rank: 3,
    color: "#c64e27",
    initial: "M",
  },
  {
    name: "Alex Rivera",
    focusMinutes: 3980,
    sessions: 121,
    streak: 8,
    rank: 4,
    color: "#0ea5e9",
    initial: "A",
  },
  {
    name: "Sarah Jenkins",
    focusMinutes: 3760,
    sessions: 115,
    streak: 5,
    rank: 5,
    color: "#94cd59",
    initial: "S",
  },
  {
    name: "Priya Sharma",
    focusMinutes: 3420,
    sessions: 109,
    streak: 12,
    rank: 6,
    color: "#f59e0b",
    initial: "P",
  },
  {
    name: "Lucas Moreau",
    focusMinutes: 3180,
    sessions: 97,
    streak: 18,
    rank: 7,
    color: "#ec4899",
    initial: "L",
  },
  {
    name: "Hana Kobayashi",
    focusMinutes: 2910,
    sessions: 91,
    streak: 6,
    rank: 8,
    color: "#8b5cf6",
    initial: "H",
  },
  {
    name: "Diego Torres",
    focusMinutes: 2640,
    sessions: 84,
    streak: 3,
    rank: 9,
    color: "#14b8a6",
    initial: "D",
  },
  {
    name: "Emily Zhang",
    focusMinutes: 2380,
    sessions: 72,
    streak: 9,
    rank: 10,
    color: "#ef4444",
    initial: "E",
  },
];

export const heatmapData = (() => {
  let seed = 2024;
  const next = () => {
    seed = (seed * 16807 + 11) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const weeks = [];
  for (let w = 0; w < 52; w++) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      const roll = next();
      let level = 0;
      if (roll > 0.3) level = 1;
      if (roll > 0.55) level = 2;
      if (roll > 0.78) level = 3;
      if (roll > 0.92) level = 4;
      if (d >= 1 && d <= 5 && level > 0 && next() > 0.4) {
        level = Math.min(4, level + 1);
      }
      if (w > 48 && d > new Date().getDay()) level = 0;
      week.push(level);
    }
    weeks.push(week);
  }
  return weeks;
})();

export const focusTags = [
  { name: "Deep Work", color: "#5e2ac4", minutes: 12480 },
  { name: "Coding", color: "#c64e27", minutes: 8930 },
  { name: "Reading", color: "#bbf451", minutes: 6120 },
  { name: "Studying", color: "#359462", minutes: 7840 },
  { name: "Meditation", color: "#94cd59", minutes: 2980 },
  { name: "Writing", color: "#f59e0b", minutes: 5340 },
];

export const analyticsStats = {
  totalFocusHours: 214,
  sessionsCompleted: 1180,
  avgSessionMin: 47,
  bestStreakDays: 32,
};

export const weeklyFocus = [
  { day: "Mon", minutes: 210 },
  { day: "Tue", minutes: 165 },
  { day: "Wed", minutes: 240 },
  { day: "Thu", minutes: 130 },
  { day: "Fri", minutes: 190 },
  { day: "Sat", minutes: 275 },
  { day: "Sun", minutes: 95 },
];

export const notifications = [
  { name: "Session complete", action: "2h 15m deep work logged", time: "2m ago" },
  { name: "Streak claimed", action: "14-day focus streak", time: "8m ago" },
  { name: "Leaderboard climb", action: "You moved up to #3", time: "15m ago" },
  { name: "New personal best", action: "Longest focus block today", time: "32m ago" },
  { name: "Timer finished", action: "Pomodoro cycle complete", time: "1h ago" },
  { name: "Tag unlocked", action: "Consistency badge earned", time: "2h ago" },
];

export const streakData = {
  currentStreak: 14,
  longestStreak: 32,
  weeklyGoalPercent: 72,
};
