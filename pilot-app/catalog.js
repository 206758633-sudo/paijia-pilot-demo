"use strict";

const catalog = {
  robots: [
    { id: "K1-01", name: "训练机 01", model: "K1", firmware: "1.8.3", battery: 86, lan: true },
    { id: "K1-02", name: "训练机 02", model: "K1", firmware: "1.8.3", battery: 73, lan: true },
    { id: "K1-03", name: "训练机 03", model: "K1", firmware: "1.8.3", battery: 61 },
    { id: "K1-04", name: "训练机 04", model: "K1", firmware: "1.8.2", battery: 49 },
    { id: "T1-01", name: "展演机 01", model: "T1", firmware: "1.8.3", battery: 69, lan: true },
    { id: "K1-05", name: "训练机 05", model: "K1", firmware: "1.8.3", battery: 26, lan: true },
    ...[78, 67, 92, 81, 55, 74, 65].map((battery, index) => {
      const number = String(index + 6).padStart(2, "0");
      return { id: "K1-" + number, name: "训练机 " + number, model: "K1", firmware: "1.8.3", battery, lan: true };
    })
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
    { id: "dance", name: "舞蹈训练", en: "Dance Practice", icon: "♫", tone: "iris", models: ["K1", "T1"], builtIn: true,
      scene: ["排练舞台", "Rehearsal stage"], addShortcut: true, description: ["节奏练习、舞蹈表演和自定义快捷动作", "Dance routines and custom shortcuts"], actions: [
      ["摇滚舞蹈", "Rock Dance", 8, true, "♬"], ["拜年舞蹈", "New Year Dance", 8, true, "✺"], ["走向未来舞蹈", "Future Dance", 10, true, "⌁"],
      ["MJ舞蹈", "MJ Dance", 9, true, "↟"], ["阿拉伯舞蹈", "Arabic Dance", 9, true, "✧"], ["格斗踢腿", "Stage Kick", 6, true, "↗"],
      ["回旋踢", "Stage Spin", 6, true, "⟳"], ["山河故人", "Mountains & Rivers", 9, true, "◇"], ["改革春风", "Spring Breeze", 9, true, "✦"],
      ["节奏步", "Rhythm Steps", 8, true, "♪"], ["结束动作", "Finale", 5, false, "◈"]
    ] },
    { id: "talk", name: "Hi Chat", en: "Hi Chat", icon: "◌", tone: "moss", models: ["K1", "T1"], builtIn: true,
      scene: ["居家会客厅", "Living room"], description: ["切换角色并试聊", "Choose a persona and try a conversation"], actions: [], personas: [
      { id: "default", name: ["默认", "Default"], icon: "◎", tone: "moss", reply: ["你好！今天想聊聊什么？", "Hi! What would you like to talk about?"] },
      { id: "kid", name: ["天真小宝", "Little Explorer"], icon: "✦", tone: "clay", reply: ["我们来玩猜谜吧！你出第一题。", "Let's play a guessing game! You go first."] },
      { id: "tutor", name: ["英语家教", "English Tutor"], icon: "Aa", tone: "sky", reply: ["Hello! 试着用英语做一个简单的自我介绍。", "Hello! Try introducing yourself in English."] },
      { id: "pet", name: ["可爱萌宠", "Playful Pet"], icon: "♡", tone: "clay", reply: ["汪！可以陪我玩一会儿吗？", "Woof! Can we play for a while?"] },
      { id: "alien", name: ["外星怪咖", "Alien Visitor"], icon: "⚝", tone: "iris", reply: ["地球通讯已建立！今天要研究什么？", "Earth contact established. What shall we study today?"] },
      { id: "ella", name: ["Gentle Ella", "Gentle Ella"], icon: "❋", tone: "moss", reply: ["我在听。我们可以从今天最让你开心的事说起。", "I'm listening. Tell me about the best part of your day."] },
      { id: "jax", name: ["Grumpy Jax", "Grumpy Jax"], icon: "ϟ", tone: "iris", reply: ["行吧，我有空。说吧，有什么新鲜事？", "All right, I've got a minute. What's new?"] }
    ] },
    { id: "teach", name: "轻松示教", en: "Motion Teaching", icon: "◇", tone: "sky", models: ["K1", "T1"], builtIn: true, description: ["录制姿态并保存为可复用技能", "Record poses and save reusable skills"], actions: [
      ["姿态示范", "Pose Demo", 6, true]
    ] },
    { id: "soccer", name: "足球训练", en: "Football Practice", icon: "◎", tone: "moss", models: ["K1", "T1"], builtIn: true,
      scene: ["足球训练场", "Football training ground"], description: ["模拟盯球、追球、射门与庆祝", "Simulated ball tracking, shooting and celebrations"], actions: [
      ["挥手", "Wave", 4, true, "◔"], ["握手", "Handshake", 4, true, "◇"], ["盯球", "Track Ball", 6, true, "⊙"],
      ["追球", "Follow Ball", 7, true, "➝"], ["射门", "Shoot", 4, false, "◎"], ["大力踢球", "Power Shot", 5, false, "➚"],
      ["Siuuu", "Siuuu", 6, true, "✦"], ["抱胸", "Cross Arms", 4, true, "×"], ["指天", "Point Up", 4, true, "↑"], ["摇篮", "Cradle", 5, true, "⌁"]
    ] },
    { id: "lion", name: "舞狮", en: "Lion Dance", icon: "✺", tone: "clay", models: ["K1", "T1"], builtIn: true,
      scene: ["灯会庭院", "Lantern courtyard"], description: ["舞狮准备、行走与两套表演动作", "Lion Dance stance, steps and two routines"], actions: [
      ["舞狮准备", "Lion Stance", 4, true, "✦"], ["舞狮行走", "Lion Steps", 6, true, "➝"],
      ["舞狮 1", "Lion Dance 1", 8, true, "✺"], ["舞狮 2", "Lion Dance 2", 9, true, "❋"]
    ] },
    { id: "odance", name: "ODance", en: "ODance", icon: "♬", tone: "iris", models: ["K1"], region: "CN", description: ["第三方舞蹈训练示例", "Third-party dance training example"], actions: [
      ["分解练习", "Step Practice", 8, true], ["连贯演示", "Full Routine", 12, true]
    ] },
    { id: "festival", name: "节日展演", en: "Festival Show", icon: "✺", tone: "clay", models: ["K1"], catalogRevision: 2, description: ["节庆互动和展演动作", "Festival gestures and routines"], actions: [
      ["节庆问好", "Festival Greeting", 6, true], ["展演动作", "Show Routine", 9, true]
    ] }
  ]
};
