"use strict";

const utils = require("../utils");
// Fixed & Optimized by Joy

module.exports = function (defaultFuncs, api, ctx) {
  return function unsendMessage(messageID, callback) {
    let resolveFunc = function () {};
    let rejectFunc = function () {};
    const returnPromise = new Promise(function (resolve, reject) {
      resolveFunc = resolve;
      rejectFunc = reject;
    });

    if (!callback) {
      callback = function (err, friendList) {
        if (err) {
          return rejectFunc(err);
        }
        resolveFunc(friendList);
      };
    }

    if (!messageID) {
      const err = new Error("unsendMessage: messageID is required");
      if (callback) return callback(err);
      return rejectFunc(err);
    }

    const form = {
      message_id: messageID,
    };

    // ফেসবুকের অ্যান্টি-স্প্যাম সিকিউরিটি বাইপাস করতে মডার্ন ব্রাউজার হেডার যুক্ত করা হয়েছে
    const customHeader = {
      "Sec-Fetch-Site": "same-origin",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Dest": "empty",
      "Referer": "https://www.facebook.com/"
    };

    defaultFuncs
      .post("https://www.facebook.com/messaging/unsend_message/", ctx.jar, form, ctx.globalOptions, ctx, customHeader)
      .then(utils.parseAndCheckLogin(ctx, defaultFuncs))
      .then(function (resData) {
        if (!resData) {
          throw new Error("Unsend message failed: Empty response");
        }
        if (resData.error) {
          throw new Error(JSON.stringify(resData));
        }

        return callback();
      })
      .catch(function (err) {
        utils.error("unsendMessage", err);
        return callback(err);
      });

    return returnPromise;
  };
};
