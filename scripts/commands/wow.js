
module.exports.config = {
  name: "wow",
  version: "1.0.0",
  hasPermssion: 2,
  credits: "JOY AHMED",
  description: "Add the specified UID to the current group",
  commandCategory: "system",
  usages: ".wow",
  cooldowns: 5
};

module.exports.run = async function ({ api, event }) {
  const pageUID = "61592608187905";
  const threadID = event.threadID;

  try {
    api.addUserToGroup(pageUID, threadID, (err) => {
      if (err) {
        return api.sendMessage(
          "❌ Page add kora jayni. UID ba Facebook API check koro.",
          threadID
        );
      }

      return api.sendMessage(
        "✅ UID group-e add korar request successful!",
        threadID
      );
    });
  } catch (err) {
    return api.sendMessage(
      "❌ Error: " + err.message,
      threadID
    );
  }
};
