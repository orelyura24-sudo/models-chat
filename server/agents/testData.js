// Fixed "test data" that the complex agent substitutes into the user's prompt.
// Deterministic on purpose so the demo is reproducible.
export function makeTestData() {
  return {
    company: "Acme Analytics",
    period: "FY2026",
    currency: "USD",
    kpis: {
      revenue: 1250000,
      growthPct: 12.5,
      activeUsers: 48230,
      nps: 61,
      churnPct: 3.2,
    },
    quarterly: [
      { quarter: "Q1", revenue: 280000, target: 250000, users: 40100 },
      { quarter: "Q2", revenue: 310000, target: 300000, users: 43250 },
      { quarter: "Q3", revenue: 330000, target: 320000, users: 46010 },
      { quarter: "Q4", revenue: 330000, target: 350000, users: 48230 },
    ],
    channels: [
      { name: "Direct", share: 45 },
      { name: "Partner", share: 30 },
      { name: "Online", share: 25 },
    ],
    regions: [
      { region: "North America", revenue: 540000 },
      { region: "EMEA", revenue: 410000 },
      { region: "APAC", revenue: 300000 },
    ],
  };
}
