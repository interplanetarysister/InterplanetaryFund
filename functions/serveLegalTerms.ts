/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL. Do not copy, distribute, or modify without
 * express written permission. See LICENSE file for full terms.
 */

export default async function serveLegalTerms(req: any) {
  const terms = {
    copyright: "© 2026 Michelle Rogers. All Rights Reserved.",
    license: "PROPRIETARY — UNLICENSED. No copying, forking, or redistribution permitted.",
    trademark: "Interplanetary Fund™ — Common-law trademark claimed by Michelle Rogers.",
    liability: "Platform provided AS IS. Liability capped at $50 per claim. Users assume all risk.",
    contact: "interplanetarysister@gmail.com",
    effectiveDate: "August 3, 2026",
    legalDocuments: [
      "Terms of Service",
      "Privacy Policy",
      "Copyright & Trademark Notice",
      "Disclaimer of Liability",
      "Contributor License Agreement",
      "DMCA Takedown Notice",
    ],
  };

  return {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "X-Copyright": "© 2026 Michelle Rogers. All Rights Reserved.",
      "X-License": "PROPRIETARY",
    },
    body: terms,
  };
}
