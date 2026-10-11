"use strict";

const utils = require("../utils");

function formatEventReminders(reminder) {
  return {
    reminderID: reminder.id,
    eventCreatorID: reminder.lightweight_event_creator ? reminder.lightweight_event_creator.id : null,
    time: reminder.time,
    eventType: reminder.lightweight_event_type ? reminder.lightweight_event_type.toLowerCase() : "",
    locationName: reminder.location_name,
    locationCoordinates: reminder.location_coordinates,
    locationPage: reminder.location_page,
    eventStatus: reminder.lightweight_event_status ? reminder.lightweight_event_status.toLowerCase() : "",
    note: reminder.note,
    repeatMode: reminder.repeat_mode ? reminder.repeat_mode.toLowerCase() : "",
    eventTitle: reminder.event_title,
    triggerMessage: reminder.trigger_message,
    secondsToNotifyBefore: reminder.seconds_to_notify_before,
    allowsRsvp: reminder.allows_rsvp,
    relatedEvent: reminder.related_event,
    members: reminder.event_reminder_members && reminder.event_reminder_members.edges ? reminder.event_reminder_members.edges.map(function (member) {
      return {
        memberID: member.node.id,
        state: member.guest_list_state ? member.guest_list_state.toLowerCase() : "",
      };
    }) : [],
  };
}

function formatThreadGraphQLResponse(messageThread) {
  if (!messageThread) return null;

  const threadID = messageThread.thread_key && (messageThread.thread_key.thread_fbid || messageThread.thread_key.other_user_id)
    ? (messageThread.thread_key.thread_fbid || messageThread.thread_key.other_user_id)
    : null;

  const lastM = messageThread.last_message;
  const snippetID =
    lastM &&
    lastM.nodes &&
    lastM.nodes[0] &&
    lastM.nodes[0].message_sender &&
    lastM.nodes[0].message_sender.messaging_actor
      ? lastM.nodes[0].message_sender.messaging_actor.id
      : null;
  const snippetText =
    lastM && lastM.nodes && lastM.nodes[0] ? lastM.nodes[0].snippet : null;
  const lastR = messageThread.last_read_receipt;
  const lastReadTimestamp =
    lastR && lastR.nodes && lastR.nodes[0] && lastR.nodes[0].timestamp_precise
      ? lastR.nodes[0].timestamp_precise
      : null;

  return {
    threadID: threadID,
    threadName: messageThread.name || "",
    participantIDs: messageThread.all_participants && messageThread.all_participants.edges ? messageThread.all_participants.edges.map(
      (d) => d.node && d.node.messaging_actor ? d.node.messaging_actor.id : null
    ).filter(Boolean) : [],
    userInfo: messageThread.all_participants && messageThread.all_participants.edges ? messageThread.all_participants.edges.map((d) => {
      const actor = d.node ? d.node.messaging_actor : {};
      return {
        id: actor ? actor.id : null,
        name: actor ? actor.name : "",
        firstName: actor ? actor.short_name : "",
        vanity: actor ? actor.username : "",
        url: actor ? actor.url : "",
        thumbSrc: actor && actor.big_image_src ? actor.big_image_src.uri : null,
        profileUrl: actor && actor.big_image_src ? actor.big_image_src.uri : null,
        gender: actor ? actor.gender : null,
        type: actor ? actor.__typename : "",
        isFriend: actor ? actor.is_viewer_friend : false,
        isBirthday: !!(actor && actor.is_birthday),
      };
    }) : [],
    unreadCount: messageThread.unread_count || 0,
    messageCount: messageThread.messages_count || 0,
    timestamp: messageThread.updated_time_precise,
    muteUntil: messageThread.mute_until,
    isGroup: messageThread.thread_type === "GROUP",
    isSubscribed: messageThread.is_viewer_subscribed,
    isArchived: messageThread.has_viewer_archived,
    folder: messageThread.folder,
    cannotReplyReason: messageThread.cannot_reply_reason,
    eventReminders: messageThread.event_reminders && messageThread.event_reminders.nodes
      ? messageThread.event_reminders.nodes.map(formatEventReminders)
      : null,
    emoji: messageThread.customization_info
      ? messageThread.customization_info.emoji
      : null,
    color:
      messageThread.customization_info &&
      messageThread.customization_info.outgoing_bubble_color
        ? messageThread.customization_info.outgoing_bubble_color.slice(2)
        : null,
    threadTheme: messageThread.thread_theme,
    nicknames:
      messageThread.customization_info &&
      messageThread.customization_info.participant_customizations
        ? messageThread.customization_info.participant_customizations.reduce(
            function (res, val) {
              if (val.nickname) res[val.participant_id] = val.nickname;
              return res;
            },
            {},
          )
        : {},
    adminIDs: messageThread.thread_admins || [],
    approvalMode: Boolean(messageThread.approval_mode),
    approvalQueue: messageThread.group_approval_queue && messageThread.group_approval_queue.nodes ? messageThread.group_approval_queue.nodes.map((a) => ({
      inviterID: a.inviter ? a.inviter.id : null,
      requesterID: a.requester ? a.requester.id : null,
      timestamp: a.request_timestamp,
      request_source: a.request_source,
    })) : [],

    reactionsMuteMode: messageThread.reactions_mute_mode ? messageThread.reactions_mute_mode.toLowerCase() : "",
    mentionsMuteMode: messageThread.mentions_mute_mode ? messageThread.mentions_mute_mode.toLowerCase() : "",
    isPinProtected: messageThread.is_pin_protected,
    relatedPageThread: messageThread.related_page_thread,

    name: messageThread.name || "",
    snippet: snippetText,
    snippetSender: snippetID,
    snippetAttachments: [],
    serverTimestamp: messageThread.updated_time_precise,
    imageSrc: messageThread.image ? messageThread.image.uri : null,
    isCanonicalUser: messageThread.is_canonical_neo_user,
    isCanonical: messageThread.thread_type !== "GROUP",
    recipientsLoadable: true,
    hasEmailParticipant: false,
    readOnly: false,
    canReply: messageThread.cannot_reply_reason == null,
    lastMessageTimestamp: messageThread.last_message && messageThread.last_message.timestamp_precise
      ? messageThread.last_message.timestamp_precise
      : null,
    lastMessageType: "message",
    lastReadTimestamp: lastReadTimestamp,
    threadType: messageThread.thread_type === "GROUP" ? 2 : 1,

    inviteLink: {
      enable: messageThread.joinable_mode
        ? messageThread.joinable_mode.mode === 1
        : false,
      link: messageThread.joinable_mode
        ? messageThread.joinable_mode.link
        : null,
    },
  };
}

function formatThreadList(data) {
  if (!Array.isArray(data)) return [];
  return data.map((t) => formatThreadGraphQLResponse(t)).filter(Boolean);
}

module.exports = function (defaultFuncs, api, ctx) {
  return function getThreadList(limit, timestamp, tags, callback) {
    if (
      !callback &&
      (utils.getType(tags) === "Function" ||
        utils.getType(tags) === "AsyncFunction")
    ) {
      callback = tags;
      tags = ["INBOX"];
    }

    if (utils.getType(tags) === "String") {
      tags = [tags];
    }
    
    // PENDING ও OTHER ট্যাগের ফিল্টারিং হ্যান্ডলিং
    if (!Array.isArray(tags) || tags.length === 0) {
      tags = ["INBOX"];
    }

    let resolveFunc = function () {};
    let rejectFunc = function () {};
    const returnPromise = new Promise(function (resolve, reject) {
      resolveFunc = resolve;
      rejectFunc = reject;
    });

    if (
      utils.getType(callback) !== "Function" &&
      utils.getType(callback) !== "AsyncFunction"
    ) {
      callback = function (err, data) {
        if (err) {
          return rejectFunc(err);
        }
        resolveFunc(data);
      };
    }

    const form = {
      av: ctx.userID,
      queries: JSON.stringify({
        o0: {
          doc_id: "3426149104143726",
          query_params: {
            limit: limit + (timestamp ? 1 : 0),
            before: timestamp,
            tags: tags,
            includeDeliveryReceipts: false,
            includeSeqID: false,
          },
        },
      }),
      batch_name: "MessengerGraphQLThreadlistFetcher",
    };

    const customHeader = {
      "Sec-Fetch-Site": "same-origin",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Dest": "empty",
      "Referer": "https://www.facebook.com/"
    };

    // ৩ সেকেন্ডের হার্ড টাইমআউট সেফটি
    let isHandled = false;
    const requestTimeout = setTimeout(() => {
      if (!isHandled) {
        isHandled = true;
        return callback(null, []);
      }
    }, 3000);

    defaultFuncs
      .post("https://www.facebook.com/api/graphqlbatch/", ctx.jar, form, ctx.globalOptions, ctx, customHeader)
      .then(utils.parseAndCheckLogin(ctx, defaultFuncs))
      .then((resData) => {
        if (isHandled) return;
        clearTimeout(requestTimeout);
        isHandled = true;

        if (!resData || !Array.isArray(resData)) {
          return callback(null, []);
        }

        if (resData[resData.length - 1] && resData[resData.length - 1].error_results > 0) {
          return callback(null, []);
        }

        if (resData[resData.length - 1] && resData[resData.length - 1].successful_results === 0) {
          return callback(null, []);
        }

        const nodes = resData[0] && resData[0].o0 && resData[0].o0.data && resData[0].o0.data.viewer && resData[0].o0.data.viewer.message_threads
          ? resData[0].o0.data.viewer.message_threads.nodes 
          : [];

        callback(null, formatThreadList(nodes));
      })
      .catch((err) => {
        if (isHandled) return;
        clearTimeout(requestTimeout);
        isHandled = true;
        return callback(null, []);
      });

    return returnPromise;
  };
};
