import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Check Airbnb inboxes every 3 minutes
crons.interval(
  "check-inboxes",
  { minutes: 3 },
  internal.worker.checkAllInboxes
);

// Sync Gmail every 15 minutes
crons.interval(
  "sync-gmail",
  { minutes: 15 },
  internal.worker.syncAllGmail
);

// Daily briefings at 8am UTC (tenants adjust via timezone)
crons.daily(
  "daily-briefings",
  { hourUTC: 13, minuteUTC: 0 }, // 8am ET
  internal.worker.sendDailyBriefings
);

// Weekly reports on Mondays at 9am UTC
crons.weekly(
  "weekly-reports",
  { dayOfWeek: "monday", hourUTC: 14, minuteUTC: 0 },
  internal.worker.sendWeeklyReports
);

export default crons;
