export type AppRole = "guest" | "customer" | "repairer" | "admin";
export type JobStatus =
  | "draft"
  | "submitted"
  | "analyzed"
  | "matching"
  | "matched"
  | "booked"
  | "awaiting_dropoff"
  | "in_repair"
  | "ready"
  | "collected"
  | "completed"
  | "disputed"
  | "cancelled";

export type ThreadSummary = {
  id: string;
  title: string;
  category: string;
  author: string;
  authorUserId?: string | null;
  replies: number;
  updatedAt: string;
  body: string;
};

export type ThreadReply = {
  id: string;
  author: string;
  authorUserId?: string | null;
  authorRole: Exclude<AppRole, "guest">;
  body: string;
  postedAt: string;
};

export type ThreadDetail = ThreadSummary & {
  replyItems: ThreadReply[];
};

export type EventSummary = {
  id: string;
  title: string;
  excerpt: string;
  when: string;
  location: string;
  lat: number;
  lng: number;
  cta: string;
};

export type TutorialSummary = {
  id: string;
  title: string;
  category: string;
  level: string;
  duration: string;
  format: string;
  summary: string;
  youtubeUrl?: string;
};

export type RepairMatch = {
  id: string;
  repairer: string;
  initials: string;
  rating: number;
  reviews: number;
  distanceKm: number;
  availability: string;
  quote: number;
  warrantyDays: number;
  specialties: string[];
  score: number;
};

export type ActiveRepair = {
  id: string;
  item: string;
  status: JobStatus;
  issue: string;
  repairer: string;
  rating: number;
  quote: number;
  eta: string;
  reference: string;
  timeline: string[];
  currentStep: number;
  latestUpdate: string;
};

type PastRepair = {
  item: string;
  repairer: string;
  date: string;
  amount: string;
  rating: number;
};

type RepairerDashboardStat = {
  label: string;
  detail: string;
  value: string;
};

type RepairerDashboardJob = {
  customer: string;
  item: string;
  status: string;
  due: string;
  amount: string;
};

type RepairerDashboardHistoryRow = {
  customer: string;
  item: string;
  date: string;
  earned: string;
  rating: string;
  status: string;
};

type ClientWorkspaceData = {
  summary: {
    name: string;
    totalRepairs: number;
    moneySaved: string;
    co2Avoided: string;
    greenPoints: number;
  };
  activeRepairs: ActiveRepair[];
  pastRepairs: PastRepair[];
};

type RepairerDashboardData = {
  stats: RepairerDashboardStat[];
  activeJobs: RepairerDashboardJob[];
  history: RepairerDashboardHistoryRow[];
};

export type HomePageData = {
  heroStats: { label: string; value: string }[];
  categories: { name: string; repairers: string }[];
  featuredRepairers: {
    name: string;
    city: string;
    rating: number;
    specialties: string[];
    quoteFrom: string;
  }[];
  tutorials: TutorialSummary[];
  threads: ThreadSummary[];
  events: EventSummary[];
};

export type CommunityData = {
  points: number;
  tutorials: TutorialSummary[];
  threads: ThreadSummary[];
  events: EventSummary[];
};

type CreateThreadInput = {
  title: string;
  category: string;
  body: string;
  author: string;
  authorUserId: string;
};

type CreateReplyInput = {
  body: string;
  author: string;
  authorUserId: string;
  authorRole: Exclude<AppRole, "guest">;
};

type UpdateThreadInput = {
  title: string;
  category: string;
  body: string;
  authorUserId: string;
};

type UpdateReplyInput = {
  body: string;
  authorUserId: string;
};

function buildYouTubeSearchUrl(title: string) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(title)}`;
}

const homeData: HomePageData = {
  heroStats: [
    { label: "Local repairers", value: "2,840" },
    { label: "Waste diverted", value: "14.8 t" },
    { label: "Average savings", value: "A$187" },
  ],
  categories: [
    { name: "Electronics", repairers: "2,840 repairers" },
    { name: "Furniture", repairers: "1,920 repairers" },
    { name: "Clothing", repairers: "1,560 repairers" },
    { name: "Bikes", repairers: "980 repairers" },
  ],
  featuredRepairers: [],
  tutorials: [
    {
      id: "phone-battery",
      title: "Replace a Phone Battery",
      category: "Electronics",
      level: "Beginner",
      duration: "12 min",
      format: "Video",
      summary: "Safely replace a phone battery with common tools and a simple teardown plan.",
      youtubeUrl: buildYouTubeSearchUrl("Replace a Phone Battery"),
    },
    {
      id: "denim-seam",
      title: "Mend a Torn Seam",
      category: "Clothing",
      level: "Easy",
      duration: "8 min",
      format: "Video",
      summary: "Repair ripped denim seams with strong thread and durable finishing stitches.",
      youtubeUrl: buildYouTubeSearchUrl("Mend a Torn Seam"),
    },
    {
      id: "chair-leg",
      title: "Fix a Wobbly Chair Leg",
      category: "Furniture",
      level: "Intermediate",
      duration: "15 min",
      format: "Video",
      summary: "Stabilize loose chair joints without over-clamping or damaging the finish.",
      youtubeUrl: buildYouTubeSearchUrl("Fix a Wobbly Chair Leg"),
    },
  ],
  threads: [],
  events: [
    {
      id: "electronics-repair-cafe",
      title: "Sydney Repair Cafe",
      excerpt: "Bring broken gadgets and get help from volunteers and local pros.",
      when: "5 April, 10:00 am - 2:00 pm",
      location: "Redfern Community Centre, Sydney",
      lat: -33.8925,
      lng: 151.2048,
      cta: "Join",
    },
    {
      id: "fix-your-bike-day",
      title: "Inner West Bike Fix Day",
      excerpt: "Free bike maintenance workshop for every skill level.",
      when: "12 April, 9:00 am - 1:00 pm",
      location: "Sydney Park Cycling Hub, Alexandria",
      lat: -33.9102,
      lng: 151.1887,
      cta: "RSVP",
    },
    {
      id: "upcycling-workshop",
      title: "Clothing Upcycling Workshop",
      excerpt: "Transform old clothes into pieces worth keeping.",
      when: "19 April, 2:00 pm - 5:00 pm",
      location: "Brunswick Maker Studio, Melbourne",
      lat: -37.7658,
      lng: 144.9631,
      cta: "RSVP",
    },
  ],
};

const defaultThreads: ThreadDetail[] = [
  {
    id: "laptop-charge",
    title: "Laptop won't charge even with new cable. Any ideas?",
    category: "Electronics",
    author: "Elena K.",
    authorUserId: "seed-customer-elena",
    replies: 2,
    updatedAt: "2h ago",
    body: "Start with the port, adapter wattage, and battery health report before assuming the logic board failed.",
    replyItems: [
      {
        id: "laptop-charge-reply-2",
        author: "Nadia P.",
        authorUserId: "seed-customer-nadia",
        authorRole: "customer",
        body: "I had the same issue and the adapter wattage was the cause. Compare the charger output against the laptop's required wattage before opening it up.",
        postedAt: "45m ago",
      },
    ],
  },
  {
    id: "best-denim-thread",
    title: "Best thread type for repairing denim jeans?",
    category: "Clothing",
    author: "Pierre W.",
    authorUserId: "seed-customer-pierre",
    replies: 2,
    updatedAt: "5h ago",
    body: "Use topstitch or heavy-duty polyester and match the original stitch density to avoid puckering.",
    replyItems: [
      {
        id: "best-denim-thread-reply-2",
        author: "Mina K.",
        authorUserId: "seed-customer-mina",
        authorRole: "customer",
        body: "I doubled the thread on my last repair and it got bulky. Matching the original stitch spacing mattered more than using extra thickness.",
        postedAt: "3h ago",
      },
    ],
  },
  {
    id: "water-stain-table",
    title: "How to remove a water stain from a hardwood table?",
    category: "Furniture",
    author: "Mia O.",
    authorUserId: "seed-customer-mia",
    replies: 2,
    updatedAt: "1d ago",
    body: "Most light rings respond to low heat and a dry cloth before you move to refinishing.",
    replyItems: [
      {
        id: "water-stain-table-reply-2",
        author: "Ben C.",
        authorUserId: "seed-customer-ben",
        authorRole: "customer",
        body: "A microfiber cloth worked better for me than a paper towel because it distributed the heat more evenly.",
        postedAt: "18h ago",
      },
    ],
  },
];

let communityThreads = [...defaultThreads];

function summarizeThread(thread: ThreadDetail): ThreadSummary {
  return {
    id: thread.id,
    title: thread.title,
    category: thread.category,
    author: thread.author,
    authorUserId: thread.authorUserId,
    replies: thread.replies,
    updatedAt: thread.updatedAt,
    body: thread.body,
  };
}

export const analysisFixture = {
  damageType: "Cracked screen + LCD damage",
  severity: "Moderate",
  costRange: "A$80-A$130",
  repairTime: "1-2 hours",
  savings: "A$770 saved and 14 kg of e-waste avoided",
};

export const repairMatchesFixture: RepairMatch[] = [];

const clientRepairs: ActiveRepair[] = [];

const repairerDashboardData: RepairerDashboardData = {
  stats: [],
  activeJobs: [],
  history: [],
};

const adminOverview = {
  queues: [],
  applications: [],
  payouts: [],
  disputes: [],
};

export const chatMessages = [
  { from: "repairer", body: "Screen parts arrived. Starting work now. Should take about two hours.", time: "11:03 am" },
  { from: "customer", body: "Will the phone be ready before 5:00 pm?", time: "11:15 am" },
  { from: "repairer", body: "Yes. I will send a notification once testing is complete.", time: "11:18 am" },
];

function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) => window.setTimeout(() => resolve(value), 120));
}

function requireThread(threadId: string) {
  const thread = communityThreads.find((item) => item.id === threadId);
  if (!thread) {
    throw new Error("Thread not found.");
  }
  return thread;
}

function requireThreadOwner(thread: ThreadDetail, authorUserId: string) {
  if (thread.authorUserId !== authorUserId) {
    throw new Error("You can only edit or delete your own questions.");
  }
}

function requireReplyOwner(reply: ThreadReply, authorUserId: string) {
  if (reply.authorUserId !== authorUserId) {
    throw new Error("You can only edit or delete your own replies.");
  }
}

function upsertThread(thread: ThreadDetail) {
  communityThreads = [thread, ...communityThreads.filter((item) => item.id !== thread.id)];
  return thread;
}

export function fetchHomePageData() {
  return delay({
    ...homeData,
    threads: communityThreads.map(summarizeThread),
  });
}

export function fetchCommunityData() {
  return delay({
    points: 840,
    tutorials: homeData.tutorials,
    threads: communityThreads.map(summarizeThread),
    events: homeData.events,
  });
}

export function fetchClientWorkspaceData() {
  return delay<ClientWorkspaceData>({
    summary: {
      name: "Elena Adeyemi",
      totalRepairs: 7,
      moneySaved: "A$640",
      co2Avoided: "9.2 kg",
      greenPoints: 840,
    },
    activeRepairs: clientRepairs,
    pastRepairs: [],
  });
}

export function fetchRepairerDashboardData() {
  return delay<RepairerDashboardData>(repairerDashboardData);
}

export function fetchAdminOverview() {
  return delay(adminOverview);
}

export function fetchThreadById(threadId: string) {
  return delay(communityThreads.find((thread) => thread.id === threadId) ?? communityThreads[0]);
}

export function fetchEventById(eventId: string) {
  return delay(homeData.events.find((event) => event.id === eventId) ?? homeData.events[0]);
}

export const realtimeStatusEvent = {
  type: "job.status_changed" as const,
  payload: {
    jobId: "iphone-14-pro",
    status: "ready" as JobStatus,
    latestUpdate: "Calibration passed. Your phone is ready for pickup.",
    eta: "Ready for pickup",
  },
};

export function createCommunityThread(input: CreateThreadInput) {
  const thread: ThreadDetail = {
    id: `${input.category.toLowerCase()}-${Date.now()}`,
    title: input.title,
    category: input.category,
    author: input.author,
    authorUserId: input.authorUserId,
    replies: 0,
    updatedAt: "Just now",
    body: input.body,
    replyItems: [],
  };

  return delay(upsertThread(thread));
}

export function createCommunityReply(threadId: string, input: CreateReplyInput) {
  const existingThread = requireThread(threadId);

  const updatedThread: ThreadDetail = {
    ...existingThread,
    updatedAt: "Just now",
    replyItems: [
      {
        id: `${threadId}-reply-${Date.now()}`,
        author: input.author,
        authorUserId: input.authorUserId,
        authorRole: input.authorRole,
        body: input.body,
        postedAt: "Just now",
      },
      ...existingThread.replyItems,
    ],
  };

  updatedThread.replies = updatedThread.replyItems.length;
  return delay(upsertThread(updatedThread));
}

export function updateCommunityThread(threadId: string, input: UpdateThreadInput) {
  const existingThread = requireThread(threadId);
  requireThreadOwner(existingThread, input.authorUserId);

  const updatedThread: ThreadDetail = {
    ...existingThread,
    title: input.title,
    category: input.category,
    body: input.body,
    updatedAt: "Just now",
  };

  return delay(upsertThread(updatedThread));
}

export function deleteCommunityThread(threadId: string, authorUserId: string) {
  const existingThread = requireThread(threadId);
  requireThreadOwner(existingThread, authorUserId);
  communityThreads = communityThreads.filter((thread) => thread.id !== threadId);
  return delay(threadId);
}

export function updateCommunityReply(threadId: string, replyId: string, input: UpdateReplyInput) {
  const existingThread = requireThread(threadId);
  const existingReply = existingThread.replyItems.find((reply) => reply.id === replyId);
  if (!existingReply) {
    throw new Error("Reply not found.");
  }
  requireReplyOwner(existingReply, input.authorUserId);

  const updatedThread: ThreadDetail = {
    ...existingThread,
    updatedAt: "Just now",
    replyItems: existingThread.replyItems.map((reply) =>
      reply.id === replyId
        ? {
            ...reply,
            body: input.body,
            postedAt: "Edited just now",
          }
        : reply,
    ),
  };

  return delay(upsertThread(updatedThread));
}

export function deleteCommunityReply(threadId: string, replyId: string, authorUserId: string) {
  const existingThread = requireThread(threadId);
  const existingReply = existingThread.replyItems.find((reply) => reply.id === replyId);
  if (!existingReply) {
    throw new Error("Reply not found.");
  }
  requireReplyOwner(existingReply, authorUserId);

  const updatedThread: ThreadDetail = {
    ...existingThread,
    updatedAt: "Just now",
    replyItems: existingThread.replyItems.filter((reply) => reply.id !== replyId),
  };
  updatedThread.replies = updatedThread.replyItems.length;
  return delay(upsertThread(updatedThread));
}

export function resetCommunityThreads() {
  communityThreads = [...defaultThreads];
}
