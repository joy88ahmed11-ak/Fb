"use strict";
// Fixed by @NethWs3Dev & Joy (Optimized for Facebook MQTT Updates)
var utils = require("../utils");
var mqtt = require('mqtt');
var websocket = require('websocket-stream');
var HttpsProxyAgent = require('https-proxy-agent');
const EventEmitter = require('events');
var identity = () => {};
var form = {};
var getSeqID = () => {};
var topics = [
  "/legacy_web",
  "/webrtc",
  "/rtc_multi",
  "/onevc",
  "/br_sr",
  "/sr_res",
  "/t_ms",
  "/thread_typing",
  "/orca_typing_notifications",
  "/notify_disconnect",
  "/orca_presence",
  "/inbox",
  "/mercury",
  "/messaging_events",
  "/orca_message_notifications",
  "/pp",
  "/webrtc_response",
];

function listenMqtt(defaultFuncs, api, ctx, globalCallback) {
  var chatOn = ctx.globalOptions.online;
  var foreground = false;
  const sessionID = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER) + 1;
  const GUID = utils.getGUID();
  
  // লেটেস্ট ব্রাউজার ইউজার-এজেন্ট ব্যবহার নিশ্চিত করা হয়েছে
  const userAgent = ctx.globalOptions.userAgent || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

  const username = {
    u: ctx.userID,
    s: sessionID,
    chat_on: chatOn,
    fg: foreground,
    d: GUID,
    ct: 'websocket',
    aid: '219994525426954',
    aids: null,
    mqtt_sid: '',
    cp: 3,
    ecp: 10,
    st: [],
    pm: [],
    dc: '',
    no_auto_fg: true,
    gas: null,
    pack: [],
    a: userAgent,
    p: null,
    php_override: ""
  };

  const cookies = ctx.jar.getCookies('https://www.facebook.com').join('; ');
  let host;
  if (ctx.mqttEndpoint) {
    host = `${ctx.mqttEndpoint}&sid=${sessionID}`;
  } else if (ctx.region) {
    host = `wss://edge-chat.facebook.com/chat?region=${ctx.region.toLowerCase()}&sid=${sessionID}`;
  } else {
    host = `wss://edge-chat.facebook.com/chat?sid=${sessionID}`;
  }

  const options = {
    clientId: 'mqttwsclient',
    protocolId: 'MQIsdp',
    protocolVersion: 3,
    username: JSON.stringify(username),
    clean: true,
    wsOptions: {
      headers: {
        Cookie: cookies,
        Origin: 'https://www.facebook.com',
        Referer: 'https://www.facebook.com/',
        "User-Agent": userAgent,
        "Sec-Fetch-Site": "same-origin",
        "Sec-Fetch-Mode": "websocket",
        "Sec-Fetch-Dest": "empty",
        Host: new URL(host).hostname,
      },
      origin: 'https://www.facebook.com',
      protocolVersion: 13,
      binaryType: 'arraybuffer',
    },
    keepalive: 30, // কানেকশন স্টেবল রাখতে কিপ-এলাইভ টাইম বাড়িয়ে ৩০ করা হয়েছে
    reschedulePings: true,
    connectTimeout: 15 * 1000,
    reconnectPeriod: 3 * 1000,
  };

  if (typeof ctx.globalOptions.proxy != "undefined") {
    var agent = new HttpsProxyAgent(ctx.globalOptions.proxy);
    options.wsOptions.agent = agent;
  }

  ctx.mqttClient = new mqtt.Client(_ => websocket(host, options.wsOptions), options);
  var mqttClient = ctx.mqttClient;

  function stopListening() {
    if (mqttClient) {
      mqttClient.unsubscribe("/webrtc");
      mqttClient.unsubscribe("/rtc_multi");
      mqttClient.unsubscribe("/onevc");
      mqttClient.publish("/browser_close", "{}");
      mqttClient.end(false, function(...data) {
        ctx.mqttClient = null;
        mqttClient = null;
      });
    }
  }

  mqttClient.on('error', function(err) {
    stopListening();
    if (ctx.globalOptions.autoReconnect) {
      getSeqID();
    } else {
      globalCallback({ type: "stop_listen", error: "Connection refused: Server unavailable" }, null);
    }
    utils.warn("Error detected in MQTT. Reconnecting automatically...");
    if (api.ws3 && typeof api.ws3.relogin === 'function') {
      api.ws3.relogin();
    }
    return;
  });

  mqttClient.on('connect', () => {
    topics.forEach(topicsub => mqttClient.subscribe(topicsub));
    var topic;
    var queue = {
      sync_api_version: 10,
      max_deltas_able_to_process: 1000,
      delta_batch_size: 500,
      encoding: "JSON",
      entity_fbid: ctx.userID,
    };

    if (ctx.syncToken) {
      topic = "/messenger_sync_get_diffs";
      queue.last_seq_id = ctx.lastSeqId;
      queue.sync_token = ctx.syncToken;
    } else {
      topic = "/messenger_sync_create_queue";
      queue.initial_titan_sequence_id = ctx.lastSeqId;
      queue.device_params = null;
    }
    mqttClient.publish(topic, JSON.stringify(queue), { qos: 1, retain: false });
    mqttClient.publish("/foreground_state", JSON.stringify({ foreground: chatOn }), { qos: 1 });
    mqttClient.publish("/set_client_settings", JSON.stringify({ make_user_available_when_in_foreground: true }), { qos: 1 });
    
    const rTimeout = setTimeout(() => {
      if (mqttClient) {
        mqttClient.end();
        listenMqtt(defaultFuncs, api, ctx, globalCallback);
      }
    }, 5000);

    ctx.tmsWait = () => {
      clearTimeout(rTimeout);
      ctx.globalOptions.emitReady ? globalCallback({
        type: "ready",
        error: null
      }) : "";
      delete ctx.tmsWait;
    };
  });

  mqttClient.on('message', (topic, message, _packet) => {
    try {
      var jsonMessage = JSON.parse(message);
    } catch (ex) {
      return utils.error("listenMqtt", ex);
    }
    if (topic === "/t_ms") {
      if (ctx.tmsWait && typeof ctx.tmsWait == "function") ctx.tmsWait();
      if (jsonMessage.firstDeltaSeqId && jsonMessage.syncToken) {
        ctx.lastSeqId = jsonMessage.firstDeltaSeqId;
        ctx.syncToken = jsonMessage.syncToken;
      }
      if (jsonMessage.lastIssuedSeqId) ctx.lastSeqId = parseInt(jsonMessage.lastIssuedSeqId);
      
      if (jsonMessage.deltas) {
        for (var i in jsonMessage.deltas) {
          var delta = jsonMessage.deltas[i];
          parseDelta(defaultFuncs, api, ctx, globalCallback, { "delta": delta });
        }
      }
    } else if (topic === "/thread_typing" || topic === "/orca_typing_notifications") {
      var typ = {
        type: "typ",
        isTyping: !!jsonMessage.state,
        from: jsonMessage.sender_fbid ? jsonMessage.sender_fbid.toString() : "",
        threadID: utils.formatID((jsonMessage.thread || jsonMessage.sender_fbid || "").toString())
      };
      (function() { globalCallback(null, typ); })();
    } else if (topic === "/orca_presence") {
      if (!ctx.globalOptions.updatePresence && jsonMessage.list) {
        for (var i in jsonMessage.list) {
          var data = jsonMessage.list[i];
          var userID = data["u"];
          if (userID) {
            var presence = {
              type: "presence",
              userID: userID.toString(),
              timestamp: data["l"] * 1000,
              statuses: data["p"]
            };
            (function() { globalCallback(null, presence); })();
          }
        }
      }
    }
  });
  mqttClient.on('close', () => {});
  mqttClient.on('disconnect', () => {});
}

function parseDelta(defaultFuncs, api, ctx, globalCallback, v) {
  if (!v || !v.delta) return;

  if (v.delta.class == "NewMessage") {
    if (ctx.globalOptions.pageID && ctx.globalOptions.pageID != v.queue) return;
    (function resolveAttachmentUrl(i) {
      if (v.delta.attachments && (i == v.delta.attachments.length)) {
        var fmtMsg;
        try {
          fmtMsg = utils.formatDeltaMessage(v);
        } catch (err) {
          return globalCallback({
            error: "Problem parsing message object.",
            detail: err,
            res: v,
            type: "parse_error"
          });
        }
        if (fmtMsg && ctx.globalOptions.autoMarkDelivery) {
          markDelivery(ctx, api, fmtMsg.threadID, fmtMsg.messageID);
        }

        return !ctx.globalOptions.selfListen && fmtMsg && fmtMsg.senderID === ctx.userID ? undefined : (function() { globalCallback(null, fmtMsg); })();
      } else {
        if (v.delta.attachments && v.delta.attachments[i] && v.delta.attachments[i].mercury && v.delta.attachments[i].mercury.attach_type == "photo") {
          api.resolvePhotoUrl(v.delta.attachments[i].fbid, (err, url) => {
            if (!err && url) v.delta.attachments[i].mercury.metadata.url = url;
            return resolveAttachmentUrl(i + 1);
          });
        } else return resolveAttachmentUrl(i + 1);
      }
    })(0);
  }

  if (v.delta.class == "ClientPayload") {
    try {
      var clientPayload = utils.decodeClientPayload(v.delta.payload);
      if (clientPayload && clientPayload.deltas) {
        for (var i in clientPayload.deltas) {
          var delta = clientPayload.deltas[i];
          if (delta.deltaMessageReaction && !!ctx.globalOptions.listenEvents) {
            globalCallback(null, {
              type: "message_reaction",
              threadID: (delta.deltaMessageReaction.threadKey.threadFbId ? delta.deltaMessageReaction.threadKey.threadFbId : delta.deltaMessageReaction.threadKey.otherUserFbId).toString(),
              messageID: delta.deltaMessageReaction.messageId,
              reaction: delta.deltaMessageReaction.reaction,
              senderID: delta.deltaMessageReaction.senderId.toString(),
              userID: delta.deltaMessageReaction.userId.toString()
            });
          } else if (delta.deltaRecallMessageData && !!ctx.globalOptions.listenEvents) {
            globalCallback(null, {
              type: "message_unsend",
              threadID: (delta.deltaRecallMessageData.threadKey.threadFbId ? delta.deltaRecallMessageData.threadKey.threadFbId : delta.deltaRecallMessageData.threadKey.otherUserFbId).toString(),
              messageID: delta.deltaRecallMessageData.messageID,
              senderID: delta.deltaRecallMessageData.senderID.toString(),
              deletionTimestamp: delta.deltaRecallMessageData.deletionTimestamp,
              timestamp: delta.deltaRecallMessageData.timestamp
            });
          }
        }
      }
    } catch (e) {
      utils.error("parseDelta ClientPayload", e);
    }
  }

  if (v.delta.class !== "NewMessage" && !ctx.globalOptions.listenEvents) return;
  
  switch (v.delta.class) {
    case "ReadReceipt":
      var fmtMsg;
      try {
        fmtMsg = utils.formatDeltaReadReceipt(v.delta);
      } catch (err) {
        return globalCallback({
          error: "Problem parsing read receipt.",
          detail: err,
          res: v.delta,
          type: "parse_error"
        });
      }
      return (function() { globalCallback(null, fmtMsg); })();
    case "AdminTextMessage":
      switch (v.delta.type) {
        case "change_thread_theme":
        case "change_thread_nickname":
        case "change_thread_admins":
        case "change_thread_approval_mode":
        case "joinable_group_link_mode_change":
        case "rtc_call_log":
        case "group_poll":
        case "update_vote":
        case "magic_words":
        case "messenger_call_log":
        case "participant_joined_group_call":
          var fmtEventMsg;
          try {
            fmtEventMsg = utils.formatDeltaEvent(v.delta);
          } catch (err) {
            return globalCallback({
              error: "Problem parsing admin text event.",
              detail: err,
              res: v.delta,
              type: "parse_error"
            });
          }
          return (function() { globalCallback(null, fmtEventMsg); })();
        default:
          return;
      }
    case "ThreadName":
    case "ParticipantsAddedToGroupThread":
    case "ParticipantLeftGroupThread":
      var formattedEvent;
      try {
        formattedEvent = utils.formatDeltaEvent(v.delta);
      } catch (err) {
        return globalCallback({
          error: "Problem parsing thread event.",
          detail: err,
          res: v.delta,
          type: "parse_error"
        });
      }
      return (!ctx.globalOptions.selfListen && formattedEvent && formattedEvent.author.toString() === ctx.userID) || !ctx.loggedIn ? undefined : (function() { globalCallback(null, formattedEvent); })();
  }
}

function markDelivery(ctx, api, threadID, messageID) {
  if (threadID && messageID) {
    api.markAsDelivered(threadID, messageID, (err) => {
      if (err) utils.error("markAsDelivered", err);
      else {
        if (ctx.globalOptions.autoMarkRead) {
          api.markAsRead(threadID, (err) => {
            if (err) utils.error("markAsRead", err);
          });
        }
      }
    });
  }
}

module.exports = function(defaultFuncs, api, ctx) {
  var globalCallback = identity;
  getSeqID = function getSeqID() {
    ctx.t_mqttCalled = false;
    defaultFuncs
      .post("https://www.facebook.com/api/graphqlbatch/", ctx.jar, form)
      .then(utils.parseAndCheckLogin(ctx, defaultFuncs))
      .then((resData) => {
        if (utils.getType(resData) != "Array")
          throw { error: "Not logged in", res: resData };
        if (resData[resData.length - 1].error_results > 0) {
          const errorL = resData[0].o0.errors;
          throw errorL;
        }
        if (resData[resData.length - 1].successful_results === 0) throw { error: "getSeqId: there was no successful_results", res: resData };
        if (resData[0].o0.data.viewer.message_threads.sync_sequence_id) {
          ctx.lastSeqId = resData[0].o0.data.viewer.message_threads.sync_sequence_id;
          listenMqtt(defaultFuncs, api, ctx, globalCallback);
        } else throw { error: "getSeqId: no sync_sequence_id found.", res: resData };
      })
      .catch((err) => {
        if (utils.getType(err) == "Object" && err.error === "Not logged in") {
          ctx.loggedIn = false;
        }
        return globalCallback(err);
      });
  };

  return async (callback) => {
    var msgEmitter = new EventEmitter();
    globalCallback = (callback || function(error, message) {
      if (error) return msgEmitter.emit("error", error);
      msgEmitter.emit("message", message);
    });
    if (!ctx.firstListen) ctx.lastSeqId = null;
    ctx.syncToken = undefined;
    ctx.t_mqttCalled = false;
    form = {
      "av": ctx.globalOptions.pageID,
      "queries": JSON.stringify({
        "o0": {
          "doc_id": "3336396659757871",
          "query_params": {
            "limit": 1,
            "before": null,
            "tags": ["INBOX"],
            "includeDeliveryReceipts": false,
            "includeSeqID": true
          }
        }
      })
    };
    if (!ctx.firstListen || !ctx.lastSeqId) getSeqID();
    else listenMqtt(defaultFuncs, api, ctx, globalCallback);
    ctx.firstListen = false;
    return msgEmitter;
  };
};
