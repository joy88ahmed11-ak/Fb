"use strict";

const utils = require("../utils");
// Fixed & Optimized by Joy

module.exports = function (defaultFuncs, api, ctx) {
  return function addUserToGroup(userID, threadID, callback) {
    let resolveFunc = function () {};
    let rejectFunc = function () {};
    const returnPromise = new Promise(function (resolve, reject) {
      resolveFunc = resolve;
      rejectFunc = reject;
    });

    if (
      !callback &&
      (utils.getType(threadID) === "Function" ||
        utils.getType(threadID) === "AsyncFunction")
    ) {
      throw new Error("please pass a threadID as a second argument.");
    }

    if (!callback) {
      callback = function (err) {
        if (err) {
          return rejectFunc(err);
        }
        resolveFunc();
      };
    }

    if (
      utils.getType(threadID) !== "Number" &&
      utils.getType(threadID) !== "String"
    ) {
      throw new Error(
        "ThreadID should be of type Number or String and not " +
        utils.getType(threadID) +
        "."
      );
    }

    if (utils.getType(userID) !== "Array") {
      userID = [userID];
    }

    const messageAndOTID = utils.generateOfflineThreadingID();
    const form = {
      client: "mercury",
      action_type: "ma-type:log-message",
      author: "fbid:" + (ctx.userID),
      thread_id: "",
      timestamp: Date.now(),
      timestamp_absolute: "Today",
      timestamp_relative: utils.generateTimestampRelative(),
      timestamp_time_passed: "0",
      is_unread: false,
      is_cleared: false,
      is_forward: false,
      is_filtered_content: false,
      is_filtered_content_bh: false,
      is_filtered_content_account: false,
      is_spoof_warning: false,
      source: "source:chat:web",
      "source_tags[0]": "source:chat",
      log_message_type: "log:subscribe",
      status: "0",
      offline_threading_id: messageAndOTID,
      message_id: messageAndOTID,
      threading_id: utils.generateThreadingID(ctx.clientID),
      manual_retry_cnt: "0",
      thread_fbid: threadID,
    };

    for (let i = 0; i < userID.length; i++) {
      if (
        utils.getType(userID[i]) !== "Number" &&
        utils.getType(userID[i]) !== "String"
      ) {
        throw new Error(
          "Elements of userID should be of type Number or String and not " +
          utils.getType(userID[i]) +
          "."
        );
      }

      form["log_message_data[added_participants][" + i + "]"] =
        "fbid:" + userID[i];
    }

    // ফেসবুকের অ্যান্টি-স্প্যাম সিকিউরিটি বাইপাস করতে মডার্ন ব্রাউজার হেডার যুক্ত করা হয়েছে
    const customHeader = {
      "Sec-Fetch-Site": "same-origin",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Dest": "empty",
      "Referer": "https://www.facebook.com/"
    };

    defaultFuncs
      .post("https://www.facebook.com/messaging/send/", ctx.jar, form, ctx.globalOptions, ctx, customHeader)
      .then(utils.parseAndCheckLogin(ctx, defaultFuncs))
      .then(function (resData) {
        if (!resData) {
          throw new Error("Add to group failed.");
        }
        if (resData.error) {
          throw new Error(JSON.stringify(resData));
        }

        return callback();
      })
      .catch(function (err) {
        utils.error("addUserToGroup", err);
        return callback(err);
      });

    return returnPromise;
  };
};
