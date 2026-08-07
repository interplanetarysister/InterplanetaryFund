import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // 1. Get accounts created today from Convex
    const convexResponse = await fetch(
      "https://rosy-butterfly-2.convex.cloud/api/query",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: "accountTracker:getTodayAccounts",
          args: {}
        })
      }
    );
    const convexData = await convexResponse.json();
    const accounts = convexData.value || [];

    // 2. Also get unreported accounts (in case some were missed)
    const unreportedResponse = await fetch(
      "https://rosy-butterfly-2.convex.cloud/api/query",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: "accountTracker:getUnreported",
          args: {}
        })
      }
    );
    const unreportedData = await unreportedResponse.json();
    const unreported = unreportedData.value || [];

    // Combine: all accounts that need reporting
    const allAccounts = [...accounts, ...unreported.filter(
      (a: any) => !accounts.some((b: any) => b._id === a._id)
    )];

    // 3. Get Gmail access token
    const { accessToken } = await base44.asServiceRole.connectors.getConnection("gmail");
    const authHeader = { Authorization: `Bearer ${accessToken}` };

    // 4. Build email content
    const today = new Date().toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric"
    });

    let emailBody;
    if (allAccounts.length === 0) {
      emailBody = `Interplanetary Fund — Daily Account Report\n${today}\n\nNo new accounts were created today.\n\n— Lyra, Chief of Staff for Agents`;
    } else {
      const accountLines = allAccounts.map((a: any, i: number) =>
        `${i + 1}. ${a.platform}\n   Name: ${a.accountName}\n   Email: ${a.accountEmail}\n   Purpose: ${a.purpose}\n   Created: ${a.createdAt}`
      ).join("\n\n");
      emailBody = `Interplanetary Fund — Daily Account Report\n${today}\n\n${allAccounts.length} account(s) created on your behalf today:\n\n${accountLines}\n\n— Lyra, Chief of Staff for Agents`;
    }

    // 5. Build MIME message
    const subject = `Interplanetary Fund Daily Report — ${allAccounts.length} account(s) created`;
    const to = "cuddlemeplatonically@gmail.com";
    const from = "cuddlemeplatonically@gmail.com";

    const mimeMessage =
      `To: ${to}\r\n` +
      `From: ${from}\r\n` +
      `Subject: ${subject}\r\n` +
      `Content-Type: text/plain; charset=utf-8\r\n` +
      `\r\n` +
      emailBody;

    const encodedMessage = btoa(unescape(encodeURIComponent(mimeMessage)));

    // 6. Send email via Gmail API
    const sendResponse = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      {
        method: "POST",
        headers: {
          ...authHeader,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          raw: encodedMessage
        })
      }
    );

    const sendResult = await sendResponse.json();

    // 7. Mark accounts as reported in Convex
    if (allAccounts.length > 0) {
      const accountIds = allAccounts.map((a: any) => a._id);
      await fetch(
        "https://rosy-butterfly-2.convex.cloud/api/mutation",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            path: "accountTracker:markReported",
            args: {
              accountIds: accountIds,
              reportDate: new Date().toISOString()
            }
          })
        }
      );
    }

    return new Response(JSON.stringify({
      success: true,
      reportDate: today,
      accountsReported: allAccounts.length,
      emailSent: sendResult.id ? true : false,
      messageId: sendResult.id || null
    }), { headers: { "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});