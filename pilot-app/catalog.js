"use strict";

const catalog = {
  robots: [
    { id: "K1-01", name: "训练机 01", model: "K1", firmware: "1.8.3", battery: 86, lan: true },
    { id: "K1-02", name: "训练机 02", model: "K1", firmware: "1.8.3", battery: 73, lan: true },
    { id: "K1-03", name: "训练机 03", model: "K1", firmware: "1.8.3", battery: 61 },
    { id: "K1-04", name: "训练机 04", model: "K1", firmware: "1.8.2", battery: 49 },
    { id: "T1-01", name: "展演机 01", model: "T1", firmware: "1.8.3", battery: 69, lan: true },
    { id: "K1-05", name: "训练机 05", model: "K1", firmware: "1.8.3", battery: 26, lan: true }
  ],
  networks: [
    { id: "studio", name: "Pilot Studio", secret: "12345678" },
    { id: "phone", name: "Pilot Phone Hotspot", secret: "24681357" },
    { id: "guest", name: "Pilot Guest", secret: "" }
  ],
  agents: [
    { id: "base", name: "基础互动", en: "Essentials", icon: "✦", tone: "clay", models: ["K1", "T1"], builtIn: true, description: ["日常问候和互动动作", "Everyday greetings and gestures"], actions: [
      ["挥手", "Wave", 4, true], ["握手", "Handshake", 4, true], ["抱拳", "Salute", 3, false], ["欢呼", "Cheer", 6, true]
    ] },
    { id: "dance", name: "舞蹈训练", en: "Dance Practice", icon: "♫", tone: "iris", models: ["K1", "T1"], builtIn: true, description: ["节奏练习和舞蹈表演", "Rhythm practice and dance routines"], actions: [
      ["节奏步", "Rhythm Steps", 8, true], ["未来舞步", "Future Dance", 10, true], ["结束动作", "Finale", 5, false]
    ] },
    { id: "talk", name: "对话伙伴", en: "Conversation", icon: "◌", tone: "moss", models: ["K1", "T1"], builtIn: true, description: ["模拟语音互动和角色切换", "Simulated dialogue and personas"], actions: [
      ["打招呼", "Say Hello", 4, true], ["介绍自己", "Introduction", 6, true]
    ] },
    { id: "teach", name: "轻松示教", en: "Motion Teaching", icon: "◇", tone: "sky", models: ["K1", "T1"], builtIn: true, description: ["录制姿态并保存为可复用技能", "Record poses and save reusable skills"], actions: [
      ["姿态示范", "Pose Demo", 6, true]
    ] },
    { id: "soccer", name: "足球训练", en: "Football Practice", icon: "◎", tone: "moss", models: ["K1", "T1"], description: ["模拟盯球、追球和射门", "Simulated tracking, dribbling, and shooting"], actions: [
      ["盯球", "Track Ball", 6, true], ["追球", "Follow Ball", 7, true], ["射门", "Shoot", 4, false]
    ] },
    { id: "odance", name: "ODance", en: "ODance", icon: "♬", tone: "iris", models: ["K1"], region: "CN", description: ["第三方舞蹈训练示例", "Third-party dance training example"], actions: [
      ["分解练习", "Step Practice", 8, true], ["连贯演示", "Full Routine", 12, true]
    ] },
    { id: "festival", name: "节日展演", en: "Festival Show", icon: "✺", tone: "clay", models: ["K1"], catalogRevision: 2, description: ["节庆互动和展演动作", "Festival gestures and routines"], actions: [
      ["节庆问好", "Festival Greeting", 6, true], ["展演动作", "Show Routine", 9, true]
    ] }
  ]
};
