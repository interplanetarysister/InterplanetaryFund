// Inline coach-mark tours. Each step targets a real element on the page via a
// `data-coach="<key>"` attribute, with a short title + body and a placement
// hint for the tooltip card. Add data-coach attributes to the elements you
// want to highlight, then mount <CoachMarks tourId="dashboard" /> on the page.
export const coachTours = {
  dashboard: {
    name: "Dashboard tour",
    steps: [
      { selector: "new-campaign", title: "Start a campaign", body: "Create your first campaign here — it becomes the hub for every gift you receive.", placement: "bottom" },
      { selector: "stat-raised", title: "Track your impact", body: "Your total raised, supporters, and active campaigns update live as gifts arrive.", placement: "bottom" },
      { selector: "mission-control", title: "Mission Control", body: "Your AI assistants post recommendations here — review and approve their suggestions anytime.", placement: "top" },
    ],
  },
  profile: {
    name: "Profile tour",
    steps: [
      { selector: "profile-photo", title: "Your photo", body: "Upload a photo so supporters and institutions recognize you.", placement: "bottom" },
      { selector: "ai-config", title: "AI configuration", body: "Set your fundraising focus and automation preferences — your agents use this to work on your behalf.", placement: "bottom" },
      { selector: "connections", title: "Connected platforms", body: "Link crowdfunding and social platforms so one campaign reaches everywhere.", placement: "bottom" },
    ],
  },
};