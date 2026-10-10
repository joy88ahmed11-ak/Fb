"use strict";

const utils = require("../utils");
// Fixed by @NethWs3Dev & Joy

function formatData(data) {
  return {
    userID: utils.formatID(data.uid ? data.uid.toString() : ""),
    photoUrl: data.photo || "",
    indexRank: data.index_rank || 0,
    name: data.text || "",
    isVerified: data.is_verified || false,
    profileUrl: data.path || "",
    category: data.category || "",
    score: data.score || 0,
    type: data.type || "",
  };
}

module.exports = function (defaultFuncs, api, ctx) {
  return function getUserID(name, callback) {
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

    const form = {
      value: name.toLowerCase(),
      viewer: ctx.userID,
      rsp: "search",
      context: "search",
      path: "/home.php",
      request_id: utils.getGUID(),
    };

    // মডার্ন ব্রাউজার হেডার যুক্ত করা হয়েছে যাতে ফেসবুক স্প্যাম হিসেবে ব্লক না করে
    const customHeader = {
      "Sec-Fetch-Site": "same-origin",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Dest": "empty",
      "Referer": "https://www.facebook.com/"
    };

    defaultFuncs
      .get("https://www.facebook.com/ajax/typeahead/search.php", ctx.jar, form, ctx.globalOptions, ctx, customHeader)
      .then(utils.parseAndCheckLogin(ctx, defaultFuncs))
      .then(function (resData) {
        if (!resData || resData.error) {
          throw resData || new Error("Invalid response from Facebook search API");
        }

        const data = resData.payload && resData.payload.entries ? resData.payload.entries : [];

        callback(null, data.map(formatData));
      })
      .catch(function (err) {
        utils.error("getUserID", err);
        return callback(err);
      });

    return returnPromise;
  };
};
