module.exports = {
	config: {
		name: "pending",
		version: "1.0.8",
		credits: "Joy",
		prefix: true,
		premium: false,
		permission: 2,
		description: "approve groups safely with modern FCA",
		category: "admin",
		cooldowns: 5
	},

	languages: {
		"vi": {
			"invaildNumber": "%1 không phải là một con số hợp lệ",
			"cancelSuccess": "dã từ chối thành công %1 nhóm!",
			"notiBox": "box của bạn đã được admin phê duyệt để có thể sử dụng bot",
			"approveSuccess": "dã phê duyệt thành công %1 nhóm!",
			"cantGetPendingList": "không thể lấy danh sách các nhóm đang chờ!",
			"returnListPending": "tổng số nhóm cần duyệt : %1 nhóm \n\n%2",
			"returnListClean": "「PENDING」Hiện tại không có nhóm nào trong hàng chờ"
		},
		"en": {
			"invaildNumber": "%1 is not a valid number",
			"cancelSuccess": "Refused %1 thread(s)",
			"notiBox": "Your group has been approved! You can now use the bot.",
			"approveSuccess": "Approved successfully %1 thread(s)",
			"cantGetPendingList": "Can't get the pending list from Facebook.",
			"returnListPending": "Total pending groups: %1 \n\n%2",
			"returnListClean": "There is no group in the pending list."
		}
	},

	handleReply: async function({ api, event, handleReply, getText }) {
		if (String(event.senderID) !== String(handleReply.author)) return;
		const { body, threadID, messageID } = event;
		let count = 0;

		const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

		if (isNaN(body) && (body.indexOf("c") === 0 || body.indexOf("cancel") === 0)) {
			const index = (body.slice(1).trim()).split(/\s+/);
			for (const singleIndex of index) {
				if (isNaN(singleIndex) || singleIndex <= 0 || singleIndex > handleReply.pending.length) {
					return api.sendMessage(getText("invaildNumber", singleIndex), threadID, messageID);
				}
				const targetThread = handleReply.pending[singleIndex - 1].threadID;
				try {
					await api.removeUserFromGroup(api.getCurrentUserID(), targetThread);
					count += 1;
				} catch (err) {
					console.error("Error leaving group:", err);
				}
				await delay(1500);
			}
			return api.sendMessage(getText("cancelSuccess", count), threadID, messageID);
		} else {
			const index = body.trim().split(/\s+/);
			for (const singleIndex of index) {
				if (isNaN(singleIndex) || singleIndex <= 0 || singleIndex > handleReply.pending.length) {
					return api.sendMessage(getText("invaildNumber", singleIndex), threadID, messageID);
				}
				const targetThread = handleReply.pending[singleIndex - 1].threadID;
				try {
					await api.sendMessage(getText("notiBox"), targetThread);
					count += 1;
				} catch (err) {
					console.error("Error approving group:", err);
				}
				await delay(2000);
			}
			return api.sendMessage(getText("approveSuccess", count), threadID, messageID);
		}
	},

	run: async function({ api, event, getText }) {
		const { threadID, messageID } = event;
		const commandName = this.config.name;
		let msg = "", index = 1;

		let spam = [], pending = [];

		try {
			// এখন FCA ফাইলে টাইমআউট এবং সেফটি যুক্ত থাকায় এটি দ্রুত রেসপন্স করবে
			spam = await api.getThreadList(15, null, ["OTHER"]) || [];
			pending = await api.getThreadList(15, null, ["PENDING"]) || [];
		} catch (e) {
			console.error("Pending command error:", e);
			return api.sendMessage(getText("cantGetPendingList"), threadID, messageID);
		}

		const list = [...(spam || []), ...(pending || [])].filter(group => group && group.isSubscribed && group.isGroup);

		for (const single of list) {
			msg += `${index++}/ ${single.name || "Unnamed Group"} (${single.threadID})\n`;
		}

		if (list.length !== 0) {
			return api.sendMessage(getText("returnListPending", list.length, msg), threadID, (error, info) => {
				if (error) return console.error(error);
				if (!global.client.handleReply) global.client.handleReply = [];
				global.client.handleReply.push({
					name: commandName,
					messageID: info.messageID,
					author: event.senderID,
					pending: list
				});
			}, messageID);
		} else {
			return api.sendMessage(getText("returnListClean"), threadID, messageID);
		}
	}
};
