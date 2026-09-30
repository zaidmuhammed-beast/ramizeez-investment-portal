// Netlify scheduled function: once a day, asks the app to remind founders whose monthly
// investor reports are overdue. Needs JOBS_SECRET set on the site (the app checks it).
async function reportReminders() {
  const base = process.env.APP_URL || process.env.URL;
  const secret = process.env.JOBS_SECRET;
  if (!base || !secret) {
    console.log("report-reminders: skipped (set JOBS_SECRET to enable)");
    return;
  }
  const res = await fetch(`${base}/api/jobs/report-reminders`, { method: "POST", headers: { Authorization: `Bearer ${secret}` } });
  console.log(`report-reminders: ${res.status} ${await res.text()}`);
}

export default reportReminders;

// 05:00 UTC = 10:00 in Pakistan.
export const config = { schedule: "0 5 * * *" };
