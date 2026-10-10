
"use strict";

module.exports.config = {
  name: "wow",
  version: "1.1.0",
  permssion: 2,
  credits: "JOY AHMED",
  prefix: true,
  description: "Add UID to current group",
  category: "system",
  usages: ".wow",
  cooldowns: 5
};

module.exports.run = async function ({ api, event }) {
  const pageUID = "61592608187905";
  const threadID = event.threadID;

  if (!threadID) return;

  if (typeof api.addUserToGroup !== "function") {
    return api.sendMessage(
      "❌ FCA te addUserToGroup function paoa jayni.",
      threadID
    );
  }

  try {
    await api.addUserToGroup(pageUID, threadID);

    return api.sendMessage(
      "✅ Add request successful.",
      threadID
    );
  } catch (err) {
    console.error("WOW command error:", err);

    const errorText =
      err?.error ||
      err?.message ||
      JSON.stringify(err);

    return api.sendMessage(
      "❌ Add failed!\nReason: " + errorText,
      threadID
    );
  }
};
