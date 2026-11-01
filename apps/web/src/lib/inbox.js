import { verifyAccountLifecycle } from "./accountLifecycle.js";
import { isVerifiedEmailUser } from "./verifiedEmailUser.js";

const INBOX_COLUMNS = "id,owner_id,platform,type,author,content,link,campaign_id,campaign_title,status,ai_draft,recipient_address,mailbox_priority,created_at";
const NOTIFICATION_COLUMNS = "id,owner_id,title,body,type,link,read,created_at";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function verifiedOwner(client) {
  const { data, error } = await client.auth.getUser();
  const user = data?.user;
  if (error || !isVerifiedEmailUser(user)) throw new Error("Sign in with a confirmed email to view your inbox.");
  const lifecycle = await verifyAccountLifecycle(client, user);
  if (!lifecycle.ok) throw new Error(lifecycle.message || "Account access could not be verified.");
  return user.id;
}

export async function loadUniversalInbox(client) {
  const owner = await verifiedOwner(client);
  const [inboxResult, notificationResult] = await Promise.all([
    client.from("ifund_inbox_items").select(INBOX_COLUMNS)
      .eq("owner_id", owner).order("created_at", { ascending: false }).limit(100),
    client.from("ifund_notifications").select(NOTIFICATION_COLUMNS)
      .eq("owner_id", owner).order("created_at", { ascending: false }).limit(50),
  ]);
  if (inboxResult.error || notificationResult.error)
    throw new Error("We couldn't load your inbox. Please try again.");
  const inbox = (inboxResult.data || []).map(item => ({
    key: "i-" + item.id,
    id: item.id,
    owner_id: item.owner_id,
    source: "inbox",
    platform: item.platform,
    type: item.type,
    author: item.author || "",
    content: item.content || "",
    link: item.link || null,
    campaign_id: item.campaign_id,
    campaign_title: item.campaign_title,
    status: item.status,
    date: item.created_at,
    priority: item.mailbox_priority === "priority",
  }));
  const notifications = (notificationResult.data || []).map(item => ({
    key: "n-" + item.id,
    id: item.id,
    owner_id: item.owner_id,
    source: "notification",
    platform: "Interplanetary Fund",
    type: item.type,
    author: "",
    content: [item.title, item.body].filter(Boolean).join(" — "),
    link: item.link || null,
    status: item.read ? "done" : "open",
    date: item.created_at,
    priority: false,
  }));
  return [...inbox, ...notifications].sort((a, b) =>
    Number(b.priority) - Number(a.priority) || new Date(b.date) - new Date(a.date)
  );
}

export async function markInboxItemDone(client, itemId) {
  if (!UUID.test(itemId || "")) throw new Error("Invalid inbox item.");
  const owner = await verifiedOwner(client);
  const { data, error } = await client.from("ifund_inbox_items")
    .update({ status: "done" })
    .eq("id", itemId).eq("owner_id", owner)
    .select("id,owner_id,status").maybeSingle();
  if (error || data?.id !== itemId || data.owner_id !== owner || data.status !== "done")
    throw new Error("This inbox item could not be marked done.");
  return data.id;
}

export async function markInboxNotificationRead(client, notificationId) {
  if (!UUID.test(notificationId || "")) throw new Error("Invalid notification.");
  const owner = await verifiedOwner(client);
  const { data, error } = await client.from("ifund_notifications")
    .update({ read: true })
    .eq("id", notificationId).eq("owner_id", owner)
    .select("id,owner_id,read").maybeSingle();
  if (error || data?.id !== notificationId || data.owner_id !== owner || data.read !== true)
    throw new Error("This notification could not be marked read.");
  return data.id;
}
