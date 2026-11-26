"use strict";

const root = document.querySelector("#app");
const toastBox = document.querySelector("#toasts");
const storageKey = "paijia-pilot-workbench-v27";
const defaults = { user: "", accounts: [], region: "CN", language: "zh", skills: [], installed: {},
  preferences: {}, robotAgents: {}, lan: [], calibration: {}, directory: 1 };

function load() {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(storageKey) || "{}") };
  } catch {
    return { ...defaults };
  }
}
const saved = load();
const session = {
  page: saved.user ? "home" : "auth", register: false, connection: null, join: null,
  mode: "damp", agent: "base", camera: true, running: null, motion: {}, view: { x: 0, y: 0, scale: 1.07 },
  group: null, teaching: null, calibration: null, dialog: "", error: "", update: null,
  actionsExpanded: true, stoppedRobots: new Set()
};

let operationTimer;
let actionTimer;
let groupTimer;
let poseTimer;
let toastTimer;
let renderedPage;

const tr = (zh, en) => saved.language === "en" ? en : zh;
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const robotById = id => catalog.robots.find(item => item.id === id);
const currentRobot = () => robotById(session.connection?.id);
const agentById = id => catalog.agents.find(item => item.id === id);
const getAgent = () => agentById(session.agent);
const agentLabel = agent => tr(agent.name, agent.en);
const robotLabel = robot => tr(robot.name, (robot.model === "K1" ? "Training unit " : "Show unit ") + robot.id.split("-")[1]);
const modeLabel = mode => ({ damp: tr("阻尼", "Damping"), ready: tr("准备", "Ready"), walk: tr("行走", "Walking") })[mode];
const selectedMode = mode => session.mode === mode;
const connected = () => session.connection?.status === "connected";

function persist() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(saved));
  } catch {
    // The current demo remains available when storage is unavailable.
  }
}

function toast(message) {
  clearTimeout(toastTimer);
  toastBox.textContent = message;
  toastBox.classList.add("on");
  toastTimer = setTimeout(() => toastBox.classList.remove("on"), 3300);
}

function button(label, action, kind = "", options = {}) {
  const { disabled = false, value, pressed, type = "button", description } = options;
  return '<button type="' + type + '" class="btn ' + kind + '" data-action="' + action + '"' +
    (value === undefined ? "" : ' data-value="' + escapeHtml(value) + '"') +
    (pressed === undefined ? "" : ' aria-pressed="' + pressed + '"') +
    (description ? ' aria-describedby="' + escapeHtml(description) + '"' : "") +
    (disabled ? " disabled" : "") + ">" + escapeHtml(label) + "</button>";
}

function chip(label, color = "") {
  return '<span class="pill ' + color + '">' + escapeHtml(label) + "</span>";
}

function heading(title, description = "") {
  return '<header class="section-title"><h1>' + escapeHtml(title) + "</h1>" +
    (description ? "<p>" + escapeHtml(description) + "</p>" : "") + "</header>";
}

function tile(icon, title, description, action, options = {}) {
  const suffix = options.cta ? '<span class="tile-cta">' + escapeHtml(options.cta) + "</span>" : '<span aria-hidden="true">›</span>';
  return '<button class="card tile" type="button" data-action="' + action + '"' +
    (options.value ? ' data-value="' + escapeHtml(options.value) + '"' : "") + (options.disabled ? " disabled" : "") +
    '><span class="symbol ' + (options.tone || "") + '" aria-hidden="true">' + escapeHtml(icon) +
    '</span><span><span class="tile-title">' + escapeHtml(title) + "</span><small>" + escapeHtml(description) +
    "</small></span>" + suffix + "</button>";
}

function alertMessage() {
  return session.error ? '<p class="error" role="alert">' + escapeHtml(session.error) + "</p>" : "";
}

function navigation() {
  const links = saved.user ? [
    ["home", tr("设备", "Devices")], ["store", "Agent"], ["skills", tr("技能库", "Skills")], ["account", tr("账户", "Account")]
  ] : [];
  return '<header class="bar"><div class="brand"><span class="mark" aria-hidden="true">✦</span><strong>派加 Pilot</strong></div><nav class="nav" aria-label="' +
    tr("主导航", "Main navigation") + '">' + links.map(([page, name]) =>
      '<button type="button" data-action="nav" data-value="' + page + '"' + (page === session.page ? ' aria-current="page"' : "") + ">" + name + "</button>"
    ).join("") + "</nav></header>";
}

function shell(content, narrow = false) {
  return '<div class="shell">' + navigation() + '<div class="wrap stack-lg' + (narrow ? " narrow" : "") + '">' + content + "</div></div>";
}

function screen(title, description, content, back, narrow = true, value) {
  return shell((back ? '<div class="row">' + button(tr("‹ 返回", "‹ Back"), back, "ghost", { value }) + "</div>" : "") +
    heading(title, description) + content, narrow);
}

function render() {
  const views = { auth, home, connect: connectView, control, store, account, skills, teaching, settings, group: groupView, calibration: calibrationView };
  const focusedAction = document.activeElement?.dataset.action;
  const focusedValue = document.activeElement?.dataset.value;
  const priorDialog = root.querySelector("[role=dialog]")?.dataset.dialog;
  document.documentElement.lang = saved.language === "en" ? "en" : "zh-CN";
  root.innerHTML = views[session.page]();
  if (renderedPage !== session.page) {
    renderedPage = session.page;
    root.scrollTop = 0;
    window.scrollTo(0, 0);
    root.focus({ preventScroll: true });
  } else if (session.dialog && session.dialog !== priorDialog) {
    (root.querySelector(".confirm-slider") || root.querySelector("[role=dialog] button"))?.focus();
  } else if (priorDialog && !session.dialog) {
    const opener = priorDialog.startsWith("mode-") ? '[data-action="mode"][data-value="' + priorDialog.slice(5) + '"]' :
      priorDialog === "stop-release" ? '[data-action="emergency"]' : '[data-action="agent-picker"]';
    root.querySelector(opener)?.focus({ preventScroll: true });
  } else if (focusedAction) {
    Array.from(root.querySelectorAll("button[data-action]")).find(item =>
      item.dataset.action === focusedAction && item.dataset.value === focusedValue
    )?.focus({ preventScroll: true });
  }
  if (session.page === "control") updateMotion();
}

function clearOperation() {
  clearTimeout(operationTimer);
  operationTimer = undefined;
}

function stopAction() {
  clearInterval(actionTimer);
  session.running = null;
}

function clearGroupTimer() {
  clearInterval(groupTimer);
  if (session.group) {
    session.group.countdown = null;
    session.group.active = null;
  }
}

function clearInputs() {
  session.motion = {};
  root.querySelectorAll(".stick").forEach(stick => {
    const pointer = Number(stick.dataset.pointer);
    delete stick.dataset.pointer;
    if (Number.isFinite(pointer) && stick.hasPointerCapture(pointer)) stick.releasePointerCapture(pointer);
    stick.style.removeProperty("--stick-x");
    stick.style.removeProperty("--stick-y");
  });
}

function route(page) {
  clearOperation();
  stopAction();
  clearGroupTimer();
  clearTimeout(poseTimer);
  clearInputs();
  session.dialog = "";
  session.error = "";
  session.update = null;
  session.page = page;
  render();
}

function auth() {
  return '<div class="shell">' + navigation() + '<div class="wrap"><section class="auth"><div class="auth-visual">' +
    '<span>' + tr("机器人训练工作台", "Robot training workspace") + '</span><h1>派加 Pilot</h1><p>' +
    tr("连接设备，操控机器人，创建和复用动作。", "Connect robots, operate them, and teach reusable motions.") +
    '</p></div><div class="auth-content">' + heading(session.register ? tr("创建演示账户", "Create a demo account") : tr("登录工作台", "Sign in to your workspace")) +
    '<form class="form" data-form="account"><label class="field">' + tr("昵称", "Display name") +
    '<input name="name" required maxlength="24" autocomplete="off" placeholder="' + tr("例如 派加体验员", "e.g. Pilot operator") +
    '"></label><label class="field">' + tr("地区", "Region") + regionSelect() + "</label>" + alertMessage() +
    button(session.register ? tr("注册并登录", "Create and sign in") : tr("登录", "Sign in"), "account-submit", "primary", { type: "submit" }) +
    '</form><div class="row">' + button(tr("使用演示账号", "Use demo account"), "demo-login") +
    button(session.register ? tr("返回登录", "Back to sign in") : tr("注册", "Sign up"), "register", "ghost") +
    '</div><p class="caption">' + tr("这是网页模拟。请使用演示信息。", "Browser simulation. Use demo details only.") + "</p></div></section></div></div>";
}

function regionSelect() {
  return '<select name="region" aria-label="' + tr("地区", "Region") + '"><option value="CN"' + (saved.region === "CN" ? " selected" : "") + '>' +
    tr("中国大陆", "Mainland China") + '</option><option value="GLOBAL"' + (saved.region === "GLOBAL" ? " selected" : "") + ">" +
    tr("其他地区", "Other regions") + "</option></select>";
}

function signIn(name, region = saved.region) {
  saved.user = name.trim();
  saved.region = region;
  if (!saved.accounts.some(account => account.name === saved.user && account.region === region)) {
    saved.accounts = [...saved.accounts, { name: saved.user, region }];
  }
  persist();
  route("home");
}

function home() {
  const robot = currentRobot();
  return shell('<section class="hero"><div class="hero-body">' + chip(tr("网页模拟", "Web simulation")) +
    "<h1>" + tr("机器人工作台", "Robot workspace") + "</h1><p>" +
    tr("查看同网机器人，配对新设备，或开始多机训练。", "Find robots on your network, pair a new device, or start a group session.") +
    '</p><div class="row">' + button(tr("连接机器人", "Connect a robot"), "begin-connect", "primary") +
    (connected() ? button(tr("返回操控", "Resume controls"), "nav", "", { value: "control" }) : "") +
    '</div></div><div class="hero-img" aria-hidden="true"></div></section>' +
    '<section class="stack"><div class="row-between"><h2>' + tr("工作区", "Workspace") + '</h2>' +
    (robot && connected() ? chip(robot.id + " · " + tr("已连接", "Connected"), "green") : "") +
    '</div><div class="three">' +
    tile("⠿", tr("群控", "Group control"), tr("组队与同步执行", "Team up and run synchronized actions"), "begin-group") +
    tile("✦", tr("Agent 商店", "Agent store"), tr("发现和安装机器人能力", "Discover and install robot capabilities"), "nav", { value: "store", tone: "clay" }) +
    tile("◇", tr("技能库", "Skill library"), tr("管理和复用自定义动作", "Manage and reuse custom motions"), "nav", { value: "skills", tone: "sky" }) +
    "</div></section>");
}

function robotCard(robot, action, details = "") {
  const cta = action === "join-lan" ? tr("连接", "Connect") : "";
  return tile(robot.model, robotLabel(robot), robot.id + " · " + (details || robot.firmware + " · " + robot.battery + "%"), action, { value: robot.id, cta });
}

function lanRobots() {
  return catalog.robots.filter(robot => robot.lan || saved.lan.includes(robot.id));
}

function startJoin() {
  session.join = { step: "lan", id: "", network: "", permissions: false, kind: "" };
  route("connect");
}

function joinStep(step) {
  clearOperation();
  session.join.step = step;
  session.error = "";
  render();
}

function connectView() {
  const join = session.join;
  let title;
  let description;
  let content;
  let back = "join-back";
  switch (join.step) {
    case "lan":
      title = tr("连接机器人", "Connect a robot");
      description = tr("选择同一网络中的机器人，连接后自动进入操控台。", "Select a robot on your network. Controls open after connection.");
      content = '<div class="stack">' + lanRobots().map(robot => robotCard(robot, "join-lan")).join("") +
        button(tr("发现附近机器人", "Discover nearby robots"), "discover", "primary") + "</div>";
      back = "nav";
      break;
    case "permissions":
      title = tr("开启附近发现", "Enable nearby discovery");
      description = tr("模拟蓝牙和定位权限，用于查找附近机器人。", "Mock Bluetooth and location permissions for device discovery.");
      content = '<form class="form card" data-form="permissions"><label class="check"><input type="checkbox" name="bluetooth">' +
        tr("启用蓝牙", "Enable Bluetooth") + '</label><label class="check"><input type="checkbox" name="location">' +
        tr("允许定位", "Allow location") + "</label>" + alertMessage() +
        button(tr("开始扫描", "Start scan"), "permissions-submit", "primary", { type: "submit" }) + "</form>";
      break;
    case "scanning":
      title = tr("正在发现机器人", "Discovering robots");
      description = tr("正在扫描模拟附近设备。", "Scanning for simulated nearby devices.");
      content = '<progress aria-label="' + escapeHtml(title) + '"></progress>';
      break;
    case "nearby":
      title = tr("附近机器人", "Nearby robots");
      description = tr("选择机器人以查看连接方式。", "Select a robot to choose its connection method.");
      content = '<div class="stack">' + catalog.robots.map(robot => robotCard(robot, "join-device", tr("蓝牙已发现", "Found over Bluetooth"))).join("") +
        button(tr("重新扫描", "Scan again"), "scan") + "</div>";
      break;
    case "method":
      title = tr("选择连接方式", "Choose a connection method");
      description = robotLabel(robotById(join.id)) + " · " + join.id;
      content = '<div class="two">' + tile("≋", tr("Wi-Fi 连接", "Wi-Fi connection"),
        tr("连接同一 Wi-Fi 或手机热点", "Join the same Wi-Fi or a phone hotspot"), "join-wifi") +
        tile("↗", tr("热点直连", "Direct connection"), tr("手机连接机器人热点", "Join the robot’s hotspot"),
          "join-direct", { tone: "sky" }) + "</div>";
      break;
    case "wifi": {
      title = tr("为机器人配置 Wi-Fi", "Configure robot Wi-Fi");
      description = tr("使用示例网络和演示密码。", "Use a sample network and its demo password.");
      const network = catalog.networks.find(item => item.id === join.network) || catalog.networks[0];
      content = '<form class="form card" data-form="wifi"><label class="field">' + tr("目标网络", "Network") +
        networkSelect(network.id) + '</label>' + passwordField(network) + alertMessage() +
        button(tr("连接", "Connect"), "wifi-submit", "primary", { type: "submit" }) + "</form>";
      break;
    }
    case "direct":
      title = tr("连接机器人热点", "Join the robot hotspot");
      description = join.id + "-Pilot";
      content = '<div class="stack card"><p>' + tr("模拟手机切换到机器人热点，再返回操控。", "Simulate joining the robot hotspot, then return to controls.") +
        "</p>" + button(tr("加入热点", "Join hotspot"), "direct-confirm", "primary") + "</div>";
      break;
    case "progress":
      title = tr("正在连接", "Connecting");
      description = join.id + " · " + linkLabel(join.kind);
      content = '<progress aria-label="' + escapeHtml(title) + '"></progress>';
      break;
    case "failed":
      title = tr("连接失败", "Connection failed");
      description = tr("请检查示例密码，或返回选择热点直连。", "Check the demo password or try direct connection.");
      content = '<div class="row">' + button(tr("重试 Wi-Fi", "Retry Wi-Fi"), "join-wifi", "primary") +
        button(tr("选择连接方式", "Choose method"), "join-method-back") + "</div>";
      break;
  }
  return screen(title, description, content, back, true, "home");
}

function networkSelect(id) {
  return '<select name="network" aria-label="' + tr("目标网络", "Network") + '">' + catalog.networks.map(item =>
    '<option value="' + item.id + '"' + (item.id === id ? " selected" : "") + ">" + item.name + "</option>"
  ).join("") + "</select>";
}

function passwordField(network) {
  return network.secret ? '<label class="field">' + tr("演示密码", "Demo password") +
    '<input name="password" type="password" inputmode="numeric" autocomplete="off" required aria-describedby="password-hint"></label>' +
    '<p id="password-hint" class="caption">' + tr("示例密码 ", "Sample password ") + network.secret + "</p>" :
    '<p class="note">' + tr("访客网络无需密码。", "No password needed for this guest network.") + "</p>";
}

function linkLabel(kind) {
  return ({
    lan: tr("同网连接", "Local network"), wifi: "Wi-Fi", direct: tr("热点直连", "Direct hotspot")
  })[kind] || "";
}

function startScan() {
  joinStep("scanning");
  operationTimer = setTimeout(() => joinStep("nearby"), 800);
}

function finishJoin(id, kind, succeeded, network = "") {
  session.join.id = id;
  session.join.kind = kind;
  joinStep("progress");
  operationTimer = setTimeout(() => {
    if (!succeeded) {
      joinStep("failed");
      return;
    }
    if (kind === "wifi" && network === "studio" && !saved.lan.includes(id)) {
      saved.lan = [...saved.lan, id];
      persist();
    }
    session.connection = { id, kind, status: "connected" };
    session.agent = preferredAgent(robotById(id)).id;
    session.camera = true;
    session.mode = "damp";
    session.actionsExpanded = true;
    session.view = { x: 0, y: 0, scale: 1.07 };
    route("control");
  }, 850);
}

const stickNames = () => ({ move: tr("全向行走", "Walk"), head: tr("头部转动", "Head"), turn: tr("机身转向", "Turn") });

function compatible(agent, robot) {
  return Boolean(robot && agent.models.includes(robot.model) && (!agent.region || agent.region === saved.region));
}

function installed(robot, agent) {
  return agent.builtIn || Boolean(saved.installed[robot?.id]?.includes(agent.id));
}

function preferredAgent(robot) {
  const candidate = agentById(saved.robotAgents[robot.id]);
  return candidate && compatible(candidate, robot) && installed(robot, candidate) ? candidate : agentById("base");
}

function robotStopped() {
  return session.stoppedRobots.has(session.connection?.id);
}

function activeActions() {
  const agent = getAgent();
  const robot = currentRobot();
  if (session.mode !== "walk") {
    return agent.id === "base" && robot.model === "K1" ? [
      { id: "base-get-up", label: tr("起身", "Get up"), duration: 4, cancel: true, icon: "↑" }
    ] : [];
  }
  const builtin = agent.actions.map(([zh, en, duration, cancel], index) =>
    ({ id: agent.id + "-" + index, label: tr(zh, en), duration, cancel, icon: agent.id === "base" ? ["◔", "◇", "⌁", "✦"][index] : agent.icon }));
  const custom = saved.skills.filter(skill => skill.targets.includes(robot.id + "/" + agent.id)).map(skill =>
    ({ id: skill.id, label: skill.name, duration: Math.max(3, skill.poses.length), cancel: true, icon: skill.icon }));
  return [...builtin, ...custom];
}

function control() {
  const robot = currentRobot();
  const online = connected();
  const locked = !online || robotStopped();
  const adjustable = !locked && !session.running && !session.dialog;
  const canWalk = adjustable && session.mode === "walk";
  const showFeed = online && session.camera;
  const status = online ? tr("已连接", "Connected") + " · " + linkLabel(session.connection.kind) : tr("已掉线", "Connection lost");
  return '<section class="console"><div class="control-surface"' + (session.dialog ? " inert" : "") +
    '><div class="stage' + (showFeed ? "" : " paused") + '" role="region" aria-label="' + tr("机器人图传", "Robot feed") +
    '"><div class="feed"></div>' +
    (!showFeed ? '<div class="stage-message"><span>' + (online ? tr("图传已暂停", "Feed paused") : tr("连接已中断", "Connection lost")) + "</span></div>" : "") +
    '</div><header class="console-top"><div class="row">' +
    button(tr("‹ 设备", "‹ Devices"), "nav", "", { value: "home" }) +
    '<h1 class="console-title">' + tr("机器人操控台", "Robot controls") + "</h1>" +
    button(agentLabel(getAgent()) + " ▾", "agent-picker", "agent-button", { disabled: !online }) +
    '</div><div class="row control-device-tools">' +
    chip(robot.id) + chip(status, online ? "green" : "warm") + chip(robot.battery + "%") +
    button(showFeed ? tr("暂停图传", "Pause feed") : tr("打开图传", "Resume feed"), "camera", "", { disabled: !online }) +
    button(tr("设备设置", "Robot settings"), "nav", "", { value: "settings" }) +
    (online ? button(robotStopped() ? tr("解除急停", "Release stop") : tr("急停", "Stop"), "emergency", "stop-button",
      { value: robotStopped() ? "release" : "stop" }) : "") +
    '</div></header><span class="pill feed-note">' + tr("模拟 · 前相机", "Simulation · Front camera") +
    '</span><output class="stage-meter" id="motion-output"></output>' +
    '<div class="sticks">' + Object.entries(stickNames()).map(([key, name]) =>
      '<div class="stick-slot stick-' + key + '"><button type="button" class="stick" data-stick="' + key + '" aria-label="' + name +
      '" aria-describedby="motion-output"' + ((key === "head" ? adjustable && session.mode !== "damp" : canWalk) ? "" : " disabled") +
      '><i aria-hidden="true"></i></button><span aria-hidden="true">' + name + "</span></div>"
    ).join("") + '</div><div class="mode-controls" role="group" aria-label="' + tr("机器人模式", "Robot mode") + '">' +
    (online ? ["ready", "walk"].map(mode => button(modeLabel(mode), "mode", "mode-button", {
      value: mode, pressed: selectedMode(mode),
      disabled: locked || Boolean(session.running) || (mode === "walk" && session.mode === "damp"),
      description: "action-output"
    })).join("") : button(tr("重新连接", "Reconnect"), "reconnect", "primary")) +
    '</div>' + controlActions(locked) + '</div>' + (session.dialog ? controlDialog() : "") + "</section>";
}

function controlActions(locked) {
  const actions = activeActions();
  const expanded = session.actionsExpanded;
  const content = actions.map(action => {
    const active = session.running?.action.id === action.id;
    const disabled = locked || (session.running && !active);
    return '<button type="button" class="action-tile" data-action="run" data-value="' + escapeHtml(action.id) +
      '" aria-pressed="' + Boolean(active) + '"' + (disabled ? " disabled" : "") + '><span aria-hidden="true">' +
      escapeHtml(action.icon) + "</span>" + escapeHtml(action.label) + "</button>";
  }).join("") + (session.agent === "teach" ? button(tr("打开示教", "Open teaching"), "begin-teach", "", { disabled: locked }) : "") +
    (session.agent === "talk" ? button(tr("模拟对话", "Simulated conversation"), "open-chat", "", { disabled: locked }) : "");
  return '<footer class="action-panel' + (expanded ? " expanded" : "") + '"><div class="action-panel-top"><button type="button" class="panel-toggle" data-action="toggle-actions" aria-controls="control-actions" aria-expanded="' +
    expanded + '" aria-label="' + (expanded ? tr("收起动作", "Collapse actions") : tr("展开动作", "Expand actions")) + '">' +
    tr("动作", "Actions") + '<span aria-hidden="true">' + (expanded ? "⌄" : "⌃") + '</span></button>' +
    '<p class="caption" id="action-output" role="status">' + escapeHtml(actionMessage()) + '</p></div>' +
    '<div class="action-grid" id="control-actions"' + (expanded ? "" : " hidden") + '>' + content + "</div></footer>";
}

function actionMessage() {
  const run = session.running;
  if (run) return run.action.label + " · " + (run.remaining > run.action.duration ?
    tr("准备中", "Preparing") : tr("执行中", "Running") + " " + run.remaining + " s");
  if (!connected()) return tr("连接恢复后，请重新选择操作。", "Choose a new action after reconnecting.");
  if (robotStopped()) return tr("已急停 · 操作锁定", "Stopped · Controls locked");
  if (session.mode === "damp") return tr("阻尼模式 · 先进入准备", "Damping · Select Ready first");
  if (session.mode === "ready") return tr("准备模式 · 站稳后进入行走", "Ready · Select Walking once stable");
  return tr("行走模式 · 可操控并执行动作", "Walking · Controls and actions available");
}

function askMode(mode) {
  if (!connected() || robotStopped() || session.running || mode === session.mode) return;
  if (mode === "ready" || (mode === "walk" && session.mode === "ready")) openControlDialog("mode-" + mode);
}

function confirmMode(slider) {
  const mode = slider.dataset.mode;
  if (Number(slider.value) !== 100 || !connected() || robotStopped() || session.dialog !== "mode-" + mode) return;
  if (mode !== "ready" && !(mode === "walk" && session.mode === "ready")) return;
  stopAction();
  clearInputs();
  session.mode = mode;
  session.dialog = "";
  render();
}

function emergency(value) {
  if (!connected()) return;
  if (value === "release") {
    if (robotStopped()) openControlDialog("stop-release");
    return;
  }
  session.stoppedRobots.add(session.connection.id);
  stopAction();
  clearInputs();
  session.mode = "damp";
  render();
  toast(tr("模拟急停已触发", "Simulated stop engaged"));
}

function releaseStop() {
  if (!connected() || !robotStopped() || session.dialog !== "stop-release") return;
  session.stoppedRobots.delete(session.connection.id);
  session.mode = "damp";
  session.dialog = "";
  render();
  toast(tr("已解除急停，请重新进入准备模式", "Stop released. Select Ready again."));
}

function runAction(id) {
  if (!connected() || robotStopped() || session.dialog) return;
  if (session.running) {
    if (session.running.action.id === id && session.running.action.cancel) {
      stopAction();
      render();
      toast(tr("动作已停止", "Action stopped"));
    } else {
      toast(tr("此动作执行期间无法取消", "This action cannot be interrupted"));
    }
    return;
  }
  const action = activeActions().find(item => item.id === id);
  if (!action) return;
  clearInputs();
  session.running = { action, remaining: action.duration + 1 };
  render();
  actionTimer = setInterval(() => {
    session.running.remaining -= 1;
    if (!session.running.remaining) {
      stopAction();
      render();
      toast(action.label + " · " + tr("已完成", "Completed"));
    } else {
      document.querySelector("#action-output").textContent = actionMessage();
    }
  }, 1000);
}

function updateMotion() {
  const output = root.querySelector("#motion-output");
  if (!output) return;
  const { move, head, turn } = session.motion;
  const view = session.view;
  const speed = Math.hypot(move?.x || 0, move?.y || 0);
  const drift = session.running ? Math.sin(performance.now() / 450) * 1.2 : 0;
  const feed = root.querySelector(".feed");
  feed.style.setProperty("--pan-x", (view.x + drift).toFixed(2) + "%");
  feed.style.setProperty("--pan-y", view.y.toFixed(2) + "%");
  feed.style.setProperty("--zoom", view.scale.toFixed(3));
  output.textContent = tr("模拟速度", "Sim speed") + " " + (speed * 0.8).toFixed(2) + " m/s · " +
    tr("头向", "Head input") + " " + Math.round((head?.x || 0) * 55) + "° · " +
    tr("转向", "Turn input") + " " + Math.round((turn?.x || 0) * 80) + "°";
}

function applyMotion() {
  if (session.page !== "control" || !connected() || (!Object.keys(session.motion).length && !session.running)) return;
  const { move, head, turn } = session.motion;
  const view = session.view;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  view.x = clamp(view.x + ((head?.x || 0) + (turn?.x || 0) + (move?.x || 0)) * 0.65, -5, 5);
  view.y = clamp(view.y + (head?.y || 0) * 0.5, -4, 4);
  view.scale = clamp(view.scale - (move?.y || 0) * 0.008, 1.07, 1.28);
  updateMotion();
}
setInterval(applyMotion, 85);

function stickInput(event, stick) {
  const bounds = stick.getBoundingClientRect();
  const max = bounds.width * 0.35;
  const x = event.clientX - bounds.left - bounds.width / 2;
  const y = stick.dataset.stick === "turn" ? 0 : event.clientY - bounds.top - bounds.height / 2;
  const factor = Math.max(1, Math.hypot(x, y) / max);
  session.motion[stick.dataset.stick] = { x: x / factor / max, y: y / factor / max };
  stick.style.setProperty("--stick-x", x / factor + "px");
  stick.style.setProperty("--stick-y", y / factor + "px");
  updateMotion();
}

root.addEventListener("pointerdown", event => {
  const slider = event.target.closest(".confirm-slider");
  if (slider) {
    const bounds = slider.getBoundingClientRect();
    const handle = 18 + Number(slider.value) / 100 * (bounds.width - 36);
    if (Math.abs(event.clientX - bounds.left - handle) > 27) event.preventDefault();
    return;
  }
  const stick = event.target.closest("[data-stick]");
  if (!stick || stick.disabled || stick.dataset.pointer) return;
  stick.dataset.pointer = String(event.pointerId);
  stick.setPointerCapture(event.pointerId);
  stickInput(event, stick);
});
root.addEventListener("pointermove", event => {
  const stick = event.target.closest("[data-stick]");
  if (stick?.dataset.pointer === String(event.pointerId)) stickInput(event, stick);
});
for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
  root.addEventListener(type, event => {
    const stick = event.target.closest("[data-stick]");
    if (stick?.dataset.pointer !== String(event.pointerId)) return;
    delete stick.dataset.pointer;
    delete session.motion[stick.dataset.stick];
    stick.style.removeProperty("--stick-x");
    stick.style.removeProperty("--stick-y");
    updateMotion();
  });
}
root.addEventListener("pointercancel", event => {
  if (event.target.matches(".confirm-slider")) event.target.value = "0";
});
const keyboardDirections = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
root.addEventListener("keydown", event => {
  const stick = event.target.closest("[data-stick]");
  const direction = keyboardDirections[event.key];
  if (!stick || stick.disabled || !direction || stick.dataset.pointer) return;
  event.preventDefault();
  const [x, y] = direction;
  if (stick.dataset.stick === "turn" && y) return;
  session.motion[stick.dataset.stick] = { x, y };
  stick.style.setProperty("--stick-x", x * 18 + "px");
  stick.style.setProperty("--stick-y", y * 18 + "px");
});
root.addEventListener("keyup", event => {
  if (event.target.closest("[data-stick]") && keyboardDirections[event.key]) {
    clearInputs();
    updateMotion();
  }
});
root.addEventListener("focusout", event => {
  if (event.target.closest("[data-stick]") && !event.target.dataset.pointer) clearInputs();
});
window.addEventListener("blur", () => {
  clearInputs();
  updateMotion();
});

function controlDialog() {
  const robot = currentRobot();
  const agent = getAgent();
  let body;
  const picker = session.dialog === "agents";
  const mode = session.dialog.startsWith("mode-") ? session.dialog.slice(5) : "";
  let title = agentLabel(agent);
  if (picker) {
    title = tr("切换 Agent", "Switch Agent");
    body = '<div class="agent-grid">' + catalog.agents.filter(item => installed(robot, item) && compatible(item, robot)).map(item =>
      '<button type="button" class="agent-tile" data-action="switch-agent" data-value="' + item.id + '" aria-pressed="' +
      (item.id === agent.id) + '"><span class="symbol ' + item.tone + '" aria-hidden="true">' + item.icon +
      "</span><strong>" + agentLabel(item) + "</strong><small>" + tr(...item.description) + "</small></button>"
    ).join("") + '</div><div class="row">' + button(tr("当前 Agent 设置", "Current Agent settings"), "agent-settings") +
      button(tr("管理 Agent", "Manage Agents"), "nav", "", { value: "store" }) + "</div>";
  } else if (mode) {
    const isWalk = mode === "walk";
    title = isWalk ? tr("确认行走模式", "Confirm Walking") : tr("确认准备模式", "Confirm Ready");
    const message = isWalk ?
      tr("确认模拟机器人已落地站稳。完成确认后，行走和转身摇杆将启用。", "Confirm the simulated robot is standing stably. Walking and turning will then be enabled.") :
      tr("准备模式下，模拟机器人将伸直身体。", "In Ready mode, the simulated robot straightens its body.");
    const hint = tr("向右滑动确认", "Slide right to confirm");
    body = '<div class="mode-confirm"><p>' + message + '</p><label class="confirm-track"><span>' + hint +
      '</span><input class="confirm-slider" name="confirm-mode" data-mode="' + mode +
      '" type="range" min="0" max="100" value="0" aria-label="' + hint + '"></label></div>';
  } else if (session.dialog === "stop-release") {
    title = tr("解除模拟急停", "Release simulated stop");
    body = '<p>' + tr("解除后回到阻尼模式，请重新选择准备。此前的运动和动作保持停止。", "Returns to Damping. Select Ready again. Previous movement and actions stay stopped.") +
      '</p><div>' + button(tr("确认解除", "Confirm release"), "release-stop", "primary") + "</div>";
  } else if (session.dialog === "chat") {
    body = '<form class="form" data-form="chat"><label class="field">' +
      tr("给对话伙伴发送问候", "Send a greeting to your companion") +
      '<input name="chat" required maxlength="80" autocomplete="off"></label>' +
      button(tr("发送", "Send"), "chat-submit", "primary", { type: "submit" }) +
      '</form><p id="chat-reply" role="status"></p>';
  } else {
    const level = saved.preferences[robot.id + "/" + agent.id] || "standard";
    body = '<form class="form" data-form="agent-preference"><label class="field">' +
      (agent.id === "talk" ? tr("对话角色", "Conversation persona") : tr("演示节奏", "Practice pace")) +
      '<select name="preference"><option value="standard"' + (level === "standard" ? " selected" : "") + ">" +
      (agent.id === "talk" ? tr("日常伙伴", "Everyday companion") : tr("标准", "Standard")) + '</option><option value="slow"' +
      (level === "slow" ? " selected" : "") + ">" + (agent.id === "talk" ? tr("语言教练", "Language coach") : tr("慢速", "Slow")) +
      "</option></select></label>" + button(tr("保存设置", "Save settings"), "preference-submit", "primary", { type: "submit" }) + "</form>";
  }
  return '<div class="overlay' + (picker ? " agent-overlay" : "") + '"><section class="panel' +
    (picker ? " agent-panel" : "") + '" role="dialog" data-dialog="' + session.dialog +
    '" aria-modal="true" aria-labelledby="dialog-title"><div class="row-between">' +
    '<h2 id="dialog-title">' + title + "</h2>" +
    button(tr("关闭", "Close"), "close-dialog") + "</div>" + body + "</section></div>";
}

function openControlDialog(name) {
  if (!connected()) return;
  clearInputs();
  session.dialog = name;
  render();
}

function store() {
  const robot = currentRobot();
  return screen(tr("Agent 商店", "Agent store"),
    robot ? tr("管理设备 ", "Manage device ") + robot.id : tr("连接机器人后可安装 Agent。", "Connect a robot to install Agents."),
    '<div class="row">' + chip(tr("目录修订 ", "Catalog revision ") + saved.directory) +
      button(tr("同步目录", "Sync catalog"), "sync-directory", "", { disabled: Boolean(session.update) }) +
      (robot ? button(tr("返回操控", "Back to controls"), "nav", "ghost", { value: "control" }) : "") +
    '</div>' + updateStatus() + '<div class="two">' + catalog.agents.filter(agent => !agent.catalogRevision ||
      agent.catalogRevision <= saved.directory).map(agent => {
      const available = compatible(agent, robot);
      const isInstalled = robot && installed(robot, agent);
      const status = agent.builtIn ? tr("内置", "Built-in") : isInstalled ? tr("已安装", "Installed") : tr("可选", "Optional");
      const scope = agent.models.join(" / ") + (agent.region ? " · " + tr("中国大陆", "Mainland China") : "");
      const footer = agent.builtIn || !robot ? "" :
        button(isInstalled ? tr("卸载", "Uninstall") : tr("安装", "Install"), "manage-agent", "", {
          value: agent.id, disabled: (!available && !isInstalled) || Boolean(session.update) || !connected()
        });
      return '<article class="card stack"><div class="row"><span class="symbol ' + agent.tone + '" aria-hidden="true">' +
        agent.icon + "</span><div><h3>" + agentLabel(agent) + "</h3><p>" + tr(...agent.description) +
        '</p></div></div><div class="row-between"><div class="row">' + chip(status, isInstalled ? "green" : "") + chip(scope) +
        "</div>" + footer + "</div></article>";
    }).join("") + "</div>", null, false);
}

function demoUpdate(label, complete) {
  if (session.update) return;
  session.update = label;
  render();
  operationTimer = setTimeout(() => {
    operationTimer = undefined;
    session.update = null;
    complete();
    render();
    toast(tr("模拟操作完成", "Demo operation complete"));
  }, 850);
}

function updateStatus() {
  return session.update ? '<div class="stack" role="status"><p>' + escapeHtml(session.update) + '</p><progress aria-label="' +
    escapeHtml(session.update) + '"></progress></div>' : "";
}

function account() {
  return screen(tr("账户", "Account"), tr("演示偏好仅保存在此浏览器中。", "Demo preferences are stored in this browser."),
    '<form class="form card" data-form="account-settings"><label class="field">' + tr("昵称", "Display name") +
    '<input name="name" required maxlength="24" value="' + escapeHtml(saved.user) + '"></label><label class="field">' +
    tr("地区", "Region") + regionSelect() + '</label><label class="field">' + tr("语言", "Language") +
    '<select name="language" aria-label="' + tr("语言", "Language") + '"><option value="zh"' + (saved.language === "zh" ? " selected" : "") +
    '>简体中文</option><option value="en"' + (saved.language === "en" ? " selected" : "") + ">English</option></select></label>" +
    alertMessage() + '<div class="row">' + button(tr("保存", "Save"), "account-save", "primary", { type: "submit" }) +
    button(tr("退出登录", "Sign out"), "sign-out", "ghost") + "</div></form>");
}

function settings() {
  const robot = currentRobot();
  const online = connected();
  const result = saved.calibration[robot.id];
  return screen(tr("设备设置", "Robot settings"), robotLabel(robot) + " · " + robot.id,
    '<section class="card stack"><div class="row">' + chip(online ? tr("已连接", "Connected") : tr("已掉线", "Connection lost"), online ? "green" : "warm") +
    chip(robot.model) + chip("FW " + robot.firmware) + chip(tr("电量 ", "Battery ") + robot.battery + "%") +
    '</div><div class="row">' + button(session.camera ? tr("关闭图传", "Disable camera feed") : tr("开启图传", "Enable camera feed"), "camera", "", { disabled: !online }) +
    button(tr("检查更新", "Check for updates"), "device-update", "", { disabled: Boolean(session.update) }) +
    (robot.model === "K1" ? button(tr("手眼标定", "Hand–eye calibration"), "start-calibration", "", { disabled: !online || robotStopped() }) : "") +
    '</div>' + updateStatus() + (result ? '<p class="caption">' + tr("已保存模拟标定结果", "Simulated calibration saved") +
    " · " + result.size + " mm</p>" : "") + '</section><section class="card stack"><h3>' +
    tr("连接诊断", "Connection diagnostics") + '</h3><div class="row">' +
    (online ? button(tr("模拟网络掉线", "Simulate connection loss"), "drop-link") : button(tr("重新连接", "Reconnect"), "reconnect", "primary")) +
    button(tr("断开连接", "Disconnect"), "disconnect", "danger") + "</div></section>", "nav", true, "control");
}

function skills() {
  const rows = saved.skills.map(skill =>
    '<article class="card stack"><div class="row"><span class="symbol ' + skill.tone + '" aria-hidden="true">' + escapeHtml(skill.icon) +
    "</span><div><h3>" + escapeHtml(skill.name) + '</h3><p>' + skill.poses.length + tr(" 帧 · ", " frames · ") +
    skill.targets.length + tr(" 处已分配", " assignments") + '</p></div></div><div class="row">' +
    button(tr("编辑与分配", "Edit and assign"), "edit-skill", "", { value: skill.id }) + "</div></article>"
  ).join("");
  return screen(tr("技能库", "Skill library"), tr("动作可复用到兼容的机器人和 Agent。", "Reuse motions across compatible robots and Agents."),
    '<div class="row">' + button(tr("创建示教技能", "Create a taught skill"), "begin-teach", "primary") +
    '</div>' + (rows ? '<div class="two">' + rows + "</div>" :
      '<p class="empty">' + tr("暂无自定义技能。完成一次示教就能添加。", "No custom skills yet. Finish a teaching session to add one.") + "</p>"),
    null, false);
}

function startTeaching(id) {
  const old = saved.skills.find(skill => skill.id === id);
  session.teaching = {
    id: old?.id, name: old?.name || "", poses: old ? [...old.poses] : [], targets: old ? [...old.targets] : [],
    icon: old?.icon || "◇", tone: old?.tone || "sky", recording: false, playing: false, pose: 0, deletePrompt: false
  };
  route("teaching");
}

function teaching() {
  const item = session.teaching;
  const preview = '<div class="robot-preview" aria-label="' + tr("示教姿态预览", "Teaching pose preview") +
    '"><div class="pose-figure" style="--pose:' + item.pose + 'deg" aria-hidden="true"><i></i><b></b><span></span></div></div>';
  const poses = item.poses.map((angle, index) => '<span>' + (index + 1) + " · " + angle + "°</span>").join("");
  const assignmentOptions = catalog.robots.flatMap(robot => catalog.agents.filter(agent =>
    compatible(agent, robot) && installed(robot, agent)
  ).map(agent => {
    const value = robot.id + "/" + agent.id;
    return '<option value="' + value + '">' + robot.id + " · " + agentLabel(agent) + "</option>";
  })).join("");
  return screen(item.id ? tr("编辑技能", "Edit skill") : tr("动作示教", "Motion teaching"),
    tr("模拟手动示教。拖动姿态滑块，录入动作帧并预览。", "Simulated manual teaching. Set a pose, record frames and preview the motion."),
    '<section class="card stack">' + preview +
    '<label class="field">' + tr("模拟关节角度", "Simulated joint angle") + '<input name="pose" type="range" min="-55" max="55" value="' + item.pose +
    '"' + (item.playing ? " disabled" : "") + '></label><div class="row">' +
    button(item.recording ? tr("结束录制", "End recording") : tr("开始录制", "Start recording"), "record-skill", "primary", { disabled: item.playing }) +
    button(tr("记录姿态", "Record pose"), "record-frame", "", { disabled: !item.recording || item.poses.length >= 12 }) +
    button(tr("播放预览", "Preview"), "play-poses", "", { disabled: item.recording || item.playing || !item.poses.length }) +
    button(tr("移除首帧", "Trim first frame"), "trim-poses", "", { value: "first", disabled: item.recording || item.playing || !item.poses.length }) +
    button(tr("移除尾帧", "Trim last frame"), "trim-poses", "", { value: "last", disabled: item.recording || item.playing || !item.poses.length }) +
    '</div><div class="track" aria-label="' + tr("已录制姿态", "Recorded poses") + '">' + poses +
    (!poses ? '<p class="caption">' + tr("还没有录入姿态。", "No poses recorded.") + "</p>" : "") +
    '</div></section><form class="form card" data-form="save-skill"><label class="field">' +
    tr("技能名称", "Skill name") + '<input name="skill-name" required maxlength="30" value="' + escapeHtml(item.name) +
    '"></label><div class="row"><span class="symbol ' + item.tone + '">' + escapeHtml(item.icon) + "</span>" +
    button(tr("模拟生成图标", "Simulate icon generation"), "generate-icon") +
    '</div><label class="field">' + tr("分配给设备和 Agent", "Assign to device and Agent") + '<select name="skill-target" aria-label="' +
    tr("分配给设备和 Agent", "Assign to device and Agent") + '">' + assignmentOptions +
    '</select></label><div class="row">' + button(tr("添加分配", "Add assignment"), "add-skill-target") + "</div>" +
    '<div class="row">' + item.targets.map(value => {
      const [robot, agent] = value.split("/");
      return button(robot + " · " + agentLabel(agentById(agent)) + " ×", "remove-skill-target", "", { value });
    }).join("") + "</div>" + alertMessage() +
    '<div class="row">' + button(tr("保存技能", "Save skill"), "skill-submit", "primary", {
      type: "submit", disabled: item.recording || item.playing || item.poses.length < 2
    }) + (item.id ? button(item.deletePrompt ? tr("确认删除技能", "Confirm skill deletion") : tr("删除技能", "Delete skill"), "delete-skill", "danger") : "") +
    '</div></form>', "nav", true, "skills");
}

function playPoses(index = 0) {
  const item = session.teaching;
  if (index === item.poses.length) {
    item.playing = false;
    render();
    return;
  }
  item.playing = true;
  item.pose = item.poses[index];
  render();
  poseTimer = setTimeout(() => playPoses(index + 1), 420);
}

function persistSkill(name) {
  const item = session.teaching;
  if (item.poses.length < 2 || item.playing || item.recording) return;
  if (!name.trim()) {
    session.error = tr("请输入技能名称。", "Enter a skill name.");
    render();
    return;
  }
  const id = item.id || "skill-" + Date.now().toString(36);
  const skill = { id, name: name.trim(), poses: item.poses, targets: item.targets, icon: item.icon, tone: item.tone };
  saved.skills = [...saved.skills.filter(existing => existing.id !== id), skill];
  persist();
  route("skills");
  toast(tr("技能已保存", "Skill saved"));
}

function startGroup() {
  session.group = { step: "choose", ids: [], lead: "", hold: 3, delay: null, active: null, countdown: null,
    batch: [], results: {}, walk: false };
  route("group");
}

function groupChecks(ids) {
  if (ids.length < 2 || ids.length > 10) return tr("请选择 2–10 台设备。", "Select 2–10 robots.");
  if (ids.some(id => session.stoppedRobots.has(id))) return tr("有设备已急停，请解除后再组队。", "Release stopped robots before grouping.");
  const units = ids.map(robotById);
  const same = units.every(unit => unit.model === units[0].model && unit.firmware === units[0].firmware);
  if (!same) return tr("机型和固件版本须一致。", "Robot models and firmware versions must match.");
  if (units.some(unit => unit.battery < 30)) return tr("有设备电量不足，请更换后继续。", "Replace the low-battery device before continuing.");
  return "";
}

function groupCards(items, name, checked, details) {
  return items.map(robot => '<label class="card check-card"><input name="' + name + '" type="checkbox" value="' + robot.id + '"' +
    (checked.includes(robot.id) ? " checked" : "") + '><div><strong>' + robotLabel(robot) + '</strong><p class="caption">' +
    robot.id + " · FW " + robot.firmware + '</p></div>' + chip(robot.battery + "%", robot.battery < 30 ? "warm" : "") +
    (details ? '<span class="caption">' + details(robot) + "</span>" : "") + "</label>").join("");
}

function groupView() {
  const item = session.group;
  const inGroup = item.step === "run";
  let content;
  let description;
  switch (item.step) {
    case "choose":
      description = tr("从同一网络选择同型号设备。", "Select robots of the same model on the same network.");
      content = '<form class="form" data-form="group-choose">' + groupCards(lanRobots(), "members", item.ids) + alertMessage() +
        '<div class="row">' + button(tr("下一步", "Next"), "group-choose-submit", "primary", { type: "submit" }) +
        button(tr("批量配网", "Batch Wi-Fi setup"), "group-batch") + "</div></form>";
      break;
    case "batch":
      description = tr("为附近设备批量加入演示网络 Pilot Studio。", "Join nearby devices to the Pilot Studio demo network.");
      content = '<form class="form" data-form="group-batch">' +
        '<label class="check card"><input name="permission" type="checkbox">' +
        tr("允许模拟蓝牙与定位发现", "Allow simulated Bluetooth and location discovery") + "</label>" +
        groupCards(catalog.robots.filter(robot => !lanRobots().includes(robot)), "batch", item.batch) +
        (!catalog.robots.some(robot => !lanRobots().includes(robot)) ? '<p class="note">' +
          tr("全部设备已在演示网络中。", "All devices are already on the demo network.") + "</p>" : "") +
        '<label class="field">' + tr("演示密码", "Demo password") + '<input name="password" required type="password" autocomplete="off" aria-describedby="group-password"></label>' +
        '<p id="group-password" class="caption">' + tr("示例密码 12345678", "Sample password 12345678") + "</p>" + alertMessage() +
        button(tr("开始批量配网", "Start batch setup"), "group-batch-submit", "primary", { type: "submit" }) + "</form>";
      break;
    case "results":
      description = tr("查看每台设备的配网进度与结果。", "Review setup progress and results for each robot.");
      content = '<div class="stack">' + item.batch.map(id => {
        const status = item.results[id];
        const label = { waiting: tr("等待", "Queued"), working: tr("配置中", "Configuring"), done: tr("已配网", "Configured"), failed: tr("失败", "Failed") }[status];
        return '<div class="card row-between"><strong>' + id + '</strong><div class="row">' + chip(label, status === "failed" ? "warm" : status === "done" ? "green" : "") +
          (status === "failed" ? button(tr("重试", "Retry"), "group-retry", "", { value: id, disabled: Boolean(operationTimer) }) : "") + "</div></div>";
      }).join("") + '<div class="row">' + button(tr("完成", "Done"), "group-choose", "primary", { disabled: Boolean(operationTimer) }) +
        (item.batch.some(id => item.results[id] === "failed") ?
          button(tr("批量重试", "Retry failed devices"), "group-retry", "", { disabled: Boolean(operationTimer) }) : "") + "</div></div>";
      break;
    case "lead":
      description = tr("其他成员使用领队的动作库。", "Group members use the lead robot’s action library.");
      content = '<form class="form card" data-form="group-lead"><label class="field">' + tr("选择领队", "Select lead robot") +
        '<select name="lead" aria-label="' + tr("选择领队", "Select lead robot") + '">' +
        item.ids.map(id => '<option value="' + id + '">' + id + "</option>").join("") + '</select></label>' +
        button(tr("进入群控", "Enter group control"), "group-lead-submit", "primary", { type: "submit" }) + "</form>";
      break;
    case "run": {
      description = tr("领队 ", "Lead robot ") + item.lead;
      const leadAgent = preferredAgent(robotById(item.lead));
      const actions = leadAgent.actions.map(([zh, en, seconds], index) =>
        ({ id: String(index), label: tr(zh, en), duration: seconds }));
      const custom = saved.skills.filter(skill => skill.targets.includes(item.lead + "/" + leadAgent.id)).map(skill =>
        ({ id: skill.id, label: skill.name, duration: Math.max(3, skill.poses.length) }));
      item.actions = [...actions, ...custom];
      content = '<div class="three">' + item.ids.map(id => {
        const robot = robotById(id);
        return '<article class="card stack"><h3>' + id + '</h3><div class="row">' + chip(robot.battery + "%", "green") +
          chip(item.walk ? tr("行走", "Walking") : tr("准备", "Ready")) + '</div><p class="caption">' +
          (item.active ? escapeHtml(item.active.label) : tr("待命", "Standing by")) + '</p></article>';
      }).join("") + '</div><section class="card stack"><div class="row">' +
        button(item.walk ? tr("切回准备", "Return to Ready") : tr("统一进入行走", "Set all to Walking"), "group-walk") +
        button(tr("停止群控动作", "Stop group action"), "group-stop", "", { disabled: !item.active }) +
        '</div><label class="field">' + tr("同步等待时间（秒）", "Start delay (seconds)") +
        '<input type="number" min="1" max="10" name="group-delay" value="' + item.hold + '"' + (item.active ? " disabled" : "") +
        '></label><div class="row">' + item.actions.map(action =>
          button(action.label, "group-run", "", { value: action.id, disabled: !item.walk || Boolean(item.active) })
        ).join("") + '</div><p id="group-status" class="caption" role="status">' + groupMessage() +
        '</p></section><div>' + button(tr("退出群控", "Exit group control"), "nav", "ghost", { value: "home" }) + "</div>";
      break;
    }
  }
  const back = inGroup || item.step === "choose" ? "nav" : "group-choose";
  return screen(tr("群控", "Group control"), description, content, back, !inGroup, "home");
}

function groupMessage() {
  const item = session.group;
  if (!item.active) return tr("等待同步指令。", "Waiting for a group command.");
  if (item.countdown > 0) return tr("同步倒计时 ", "Group countdown ") + item.countdown + " s";
  return tr("正在同步执行 ", "Running together ") + Math.abs(item.countdown + item.active.duration) + " s";
}

function batchNext(queue, failId) {
  const item = session.group;
  const id = queue[0];
  if (!id) {
    operationTimer = undefined;
    persist();
    render();
    return;
  }
  item.results[id] = "working";
  operationTimer = setTimeout(() => {
    item.results[id] = id === failId ? "failed" : "done";
    if (id !== failId && !saved.lan.includes(id)) saved.lan = [...saved.lan, id];
    persist();
    batchNext(queue.slice(1), failId);
  }, 600);
  render();
}

function startGroupAction(id) {
  const item = session.group;
  const action = item.actions.find(entry => entry.id === id);
  const delay = root.querySelector('[name="group-delay"]');
  if (!action || !item.walk || item.active || !delay.reportValidity()) return;
  item.hold = Number(delay.value);
  item.active = action;
  item.countdown = item.hold;
  render();
  groupTimer = setInterval(() => {
    item.countdown -= 1;
    if (item.countdown <= -action.duration) {
      clearGroupTimer();
      render();
      toast(tr("群控动作完成", "Group action complete"));
    } else {
      root.querySelector("#group-status").textContent = groupMessage();
    }
  }, 1000);
}

function startCalibration() {
  const robot = currentRobot();
  if (!connected() || robotStopped() || robot.model !== "K1") return;
  session.calibration = { step: "setup", size: saved.calibration[robot.id]?.size || 20, aligned: false, stage: 0 };
  route("calibration");
}

function calibrationView() {
  const item = session.calibration;
  const robot = currentRobot();
  const blocked = robot.battery <= 30;
  const stages = [tr("路径规划", "Path planning"), tr("数据采集", "Data capture"), tr("计算结果", "Solve calibration")];
  let content = "";
  switch (item.step) {
    case "setup":
      content = '<div class="stack"><p class="note">' + tr("要求 K1 电量高于 30%。流程使用模拟标定板。", "Requires a K1 above 30% battery. This workflow uses a simulated board.") +
        "</p>" + (blocked ? '<p class="error">' + tr("当前设备电量不足。", "The current robot battery is too low.") + "</p>" : "") +
        '<form class="form card" data-form="calibration-size"><label class="field">' + tr("标定板方格边长（毫米）", "Board cell size (mm)") +
        '<input type="number" name="size" required min="5" max="100" value="' + item.size + '"></label>' +
        button(tr("继续", "Continue"), "calibration-size-submit", "primary", { type: "submit", disabled: blocked }) + "</form></div>";
      break;
    case "align":
      content = '<div class="calib-view"><div class="board" aria-hidden="true"></div></div><div class="card stack"><p>' +
        tr("切换到行走模式后，对齐画面中的模拟标定板。", "Switch to Walking, then align the mock board in the feed.") +
        '</p><div class="row">' + chip(modeLabel(session.mode)) +
        (session.mode === "damp" ? button(tr("进入准备", "Set Ready"), "calibration-mode", "", { value: "ready" }) : "") +
        (session.mode === "ready" ? button(tr("确认站稳并进入行走", "Confirm standing and set Walking"), "calibration-mode", "", { value: "walk" }) : "") +
        '</div><label class="check"><input name="aligned" type="checkbox"' + (item.aligned ? " checked" : "") +
        (session.mode !== "walk" ? " disabled" : "") + ">" + tr("标定板已在取景框内", "Board is inside the frame") +
        "</label>" + button(tr("开始标定", "Start calibration"), "calibration-run", "primary", { disabled: session.mode !== "walk" }) +
        alertMessage() + "</div>";
      break;
    case "running":
      content = '<div class="card stack"><div class="steps">' + stages.map((stage, index) =>
        chip(stage, index === item.stage ? "green" : "")).join("") + '</div><progress max="3" value="' + (item.stage + 1) +
        '" aria-label="' + tr("模拟标定进度", "Mock calibration progress") + '"></progress><p role="status">' +
        stages[item.stage] + "…</p></div>";
      break;
    case "result":
      content = '<div class="card stack"><h3>' + tr("模拟标定已完成", "Simulated calibration complete") + '</h3><p>' +
        tr("方格边长 ", "Cell size ") + item.size + " mm</p>" + button(tr("保存结果", "Save result"), "calibration-save", "primary") + "</div>";
      break;
    case "failed":
      content = '<div class="card stack"><p role="alert" class="error">' +
        tr("未检测到标定板。确认取景后再试。", "Board not detected. Check alignment and retry.") + "</p>" +
        button(tr("重新对齐", "Realign"), "calibration-retry", "primary") + "</div>";
      break;
  }
  return screen(tr("手眼标定", "Hand–eye calibration"), robot.id + " · " + tr("模拟工具", "Simulation tool"), content, "nav", true, "settings");
}

function calibrationNext() {
  const item = session.calibration;
  render();
  operationTimer = setTimeout(() => {
    if (item.stage < 2) {
      item.stage += 1;
      calibrationNext();
    } else {
      item.step = "result";
      operationTimer = undefined;
      render();
    }
  }, 650);
}

function groupChoose() {
  clearOperation();
  session.error = "";
  session.group.step = "choose";
  render();
}

function rejoin() {
  const { id, kind } = session.connection;
  session.join = { step: "", permissions: false, id, kind };
  route("connect");
  finishJoin(id, kind, true);
}

function toggleCamera() {
  if (!connected()) return;
  clearInputs();
  session.camera = !session.camera;
  render();
}

function managedAgent(id) {
  const robot = currentRobot();
  const item = agentById(id);
  if (!connected() || !item || item.builtIn) return;
  const remove = installed(robot, item);
  if (!remove && !compatible(item, robot)) return;
  demoUpdate(remove ? tr("正在卸载 Agent", "Uninstalling Agent") : tr("正在安装 Agent", "Installing Agent"), () => {
    const current = saved.installed[robot.id] || [];
    saved.installed[robot.id] = remove ? current.filter(value => value !== id) : [...current, id];
    if (remove && session.agent === id) session.agent = "base";
    persist();
  });
}

function skillTarget(value) {
  const item = session.teaching;
  if (value) item.targets = item.targets.filter(target => target !== value);
  else {
    const target = root.querySelector('[name="skill-target"]').value;
    if (target && !item.targets.includes(target)) item.targets = [...item.targets, target];
  }
  render();
}

function joinBack() {
  const { step, kind } = session.join;
  const prev = { scanning: "permissions", permissions: "lan", nearby: "lan", method: "nearby", wifi: "method",
    direct: "method", failed: "method", progress: kind === "lan" ? "lan" : kind === "wifi" ? "wifi" : "direct" };
  joinStep(prev[step] || "lan");
}

function confirmRegister() {
  session.register = !session.register;
  session.error = "";
  render();
}

const actions = {
  nav: value => route(value),
  "demo-login": () => signIn(tr("体验员", "Demo operator")),
  register: confirmRegister,
  "sign-out": () => {
    saved.user = "";
    persist();
    session.connection = null;
    session.group = null;
    session.teaching = null;
    session.join = null;
    session.register = false;
    route("auth");
  },
  "begin-connect": startJoin,
  "join-back": joinBack,
  "join-method-back": () => joinStep("method"),
  discover: () => session.join.permissions ? startScan() : joinStep("permissions"),
  scan: startScan,
  "join-lan": id => finishJoin(id, "lan", true),
  "join-device": id => {
    session.join.id = id;
    joinStep("method");
  },
  "join-wifi": () => joinStep("wifi"),
  "join-direct": () => joinStep("direct"),
  "direct-confirm": () => finishJoin(session.join.id, "direct", true),
  reconnect: rejoin,
  "drop-link": () => {
    session.connection.status = "lost";
    session.mode = "damp";
    route("control");
  },
  disconnect: () => {
    session.connection = null;
    route("home");
    toast(tr("模拟连接已断开", "Demo robot disconnected"));
  },
  mode: askMode,
  run: runAction,
  emergency,
  "release-stop": releaseStop,
  "toggle-actions": () => {
    clearInputs();
    session.actionsExpanded = !session.actionsExpanded;
    render();
  },
  camera: toggleCamera,
  "agent-picker": () => openControlDialog("agents"),
  "agent-settings": () => openControlDialog("settings"),
  "open-chat": () => openControlDialog("chat"),
  "close-dialog": () => {
    session.dialog = "";
    render();
  },
  "switch-agent": id => {
    const agent = agentById(id);
    const robot = currentRobot();
    if (!connected() || !agent || !compatible(agent, robot) || !installed(robot, agent)) return;
    stopAction();
    clearInputs();
    session.agent = id;
    saved.robotAgents[robot.id] = id;
    persist();
    session.dialog = "";
    render();
    toast(tr("已切换到 ", "Switched to ") + agentLabel(agent));
  },
  "manage-agent": managedAgent,
  "sync-directory": () => demoUpdate(tr("正在同步目录", "Syncing catalog"), () => {
    saved.directory = Math.max(saved.directory, ...catalog.agents.map(agent => agent.catalogRevision || 1));
    persist();
  }),
  "device-update": () => demoUpdate(tr("正在检查演示设备版本", "Checking demo firmware"), () =>
    setTimeout(() => toast(tr("设备已在当前演示版本", "Robot is on the current demo version")), 0)),
  "begin-teach": () => startTeaching(),
  "edit-skill": startTeaching,
  "record-skill": () => {
    const item = session.teaching;
    if (item.playing) return;
    item.recording = !item.recording;
    render();
  },
  "record-frame": () => {
    const item = session.teaching;
    if (!item.recording || item.poses.length >= 12) return;
    item.poses.push(item.pose);
    render();
  },
  "play-poses": () => playPoses(),
  "trim-poses": position => {
    if (position === "first") session.teaching.poses.shift();
    else session.teaching.poses.pop();
    render();
  },
  "generate-icon": () => {
    const set = [["✺", "clay"], ["◆", "iris"], ["✣", "moss"], ["◇", "sky"]];
    const item = session.teaching;
    const next = (set.findIndex(icon => icon[0] === item.icon) + 1) % set.length;
    [item.icon, item.tone] = set[next];
    render();
    toast(tr("已生成模拟图标", "Mock icon generated"));
  },
  "add-skill-target": () => skillTarget(),
  "remove-skill-target": skillTarget,
  "delete-skill": () => {
    const item = session.teaching;
    if (!item.deletePrompt) {
      item.deletePrompt = true;
      render();
      return;
    }
    saved.skills = saved.skills.filter(skill => skill.id !== item.id);
    persist();
    route("skills");
    toast(tr("技能已删除", "Skill deleted"));
  },
  "begin-group": startGroup,
  "group-batch": () => {
    session.group.ids = [...root.querySelectorAll('[name="members"]:checked')].map(node => node.value);
    session.group.step = "batch";
    session.error = "";
    render();
  },
  "group-choose": groupChoose,
  "group-retry": id => batchNext(id ? [id] : session.group.batch.filter(entry => session.group.results[entry] === "failed")),
  "group-walk": () => {
    clearGroupTimer();
    session.group.walk = !session.group.walk;
    render();
  },
  "group-stop": () => {
    clearGroupTimer();
    render();
    toast(tr("群控动作已停止", "Group action stopped"));
  },
  "group-run": startGroupAction,
  "start-calibration": startCalibration,
  "calibration-mode": mode => {
    session.mode = mode;
    render();
  },
  "calibration-run": () => {
    const item = session.calibration;
    if (session.mode !== "walk") return;
    item.step = item.aligned ? "running" : "failed";
    if (item.aligned) calibrationNext();
    else render();
  },
  "calibration-retry": () => {
    session.calibration.step = "align";
    render();
  },
  "calibration-save": () => {
    saved.calibration[currentRobot().id] = { size: session.calibration.size };
    persist();
    route("settings");
    toast(tr("模拟结果已保存", "Simulation result saved"));
  }
};

const forms = {
  account: (data, form) => {
    const name = String(data.get("name") || "").trim();
    const region = data.get("region");
    const known = saved.accounts.some(account => account.name === name && account.region === region);
    if (!name) showFormError(form, tr("请输入昵称。", "Enter a display name."));
    else if (!session.register && !known) showFormError(form, tr("请先注册，或使用演示账号。", "Create an account first or use the demo account."));
    else signIn(name, region);
  },
  "account-settings": data => {
    const name = String(data.get("name") || "").trim();
    if (!name) {
      session.error = tr("请输入昵称。", "Enter a display name.");
      render();
      return;
    }
    const prior = saved.accounts.find(account => account.name === saved.user && account.region === saved.region);
    saved.user = name;
    saved.region = data.get("region");
    saved.accounts = [...saved.accounts.filter(account => account !== prior && (account.name !== name || account.region !== saved.region)),
      { name, region: saved.region }];
    saved.language = data.get("language");
    if (currentRobot() && !compatible(getAgent(), currentRobot())) session.agent = "base";
    session.error = "";
    persist();
    render();
    toast(tr("偏好已保存", "Preferences saved"));
  },
  permissions: (data, form) => {
    if (data.has("bluetooth") && data.has("location")) {
      session.join.permissions = true;
      startScan();
    } else {
      showFormError(form, tr("完成两项模拟授权后才能发现设备。", "Enable both mock permissions to discover devices."));
    }
  },
  wifi: data => {
    const network = catalog.networks.find(item => item.id === data.get("network"));
    const password = String(data.get("password") || "");
    finishJoin(session.join.id, "wifi", password === network.secret, network.id);
  },
  "agent-preference": data => {
    const id = currentRobot().id + "/" + session.agent;
    saved.preferences[id] = data.get("preference");
    session.dialog = "";
    persist();
    render();
    toast(tr("Agent 设置已保存", "Agent settings saved"));
  },
  chat: (data, form) => {
    const message = String(data.get("chat") || "").trim();
    if (!message) return;
    const preference = saved.preferences[currentRobot().id + "/talk"];
    const response = preference === "slow" ? tr("语言教练：你好，我们来练习打招呼。", "Language coach: Hello, let’s practice a greeting.") :
      tr("日常伙伴：你好！准备好一起训练了吗？", "Everyday companion: Hello! Ready to practice together?");
    root.querySelector("#chat-reply").textContent = response;
    form.reset();
  },
  "save-skill": data => persistSkill(String(data.get("skill-name") || "")),
  "group-choose": data => {
    session.group.ids = data.getAll("members");
    session.error = groupChecks(session.group.ids);
    if (!session.error) session.group.step = "lead";
    render();
  },
  "group-lead": data => {
    session.group.lead = data.get("lead");
    session.group.step = "run";
    render();
  },
  "group-batch": (data, form) => {
    const batch = data.getAll("batch");
    if (!data.has("permission") || !batch.length || data.get("password") !== catalog.networks[0].secret) {
      showFormError(form, tr("请勾选模拟授权和设备，并输入示例密码。", "Allow mock permissions, choose robots and use the demo password."));
      return;
    }
    session.group.batch = batch;
    session.group.results = Object.fromEntries(batch.map(id => [id, "waiting"]));
    session.group.step = "results";
    session.error = "";
    batchNext(batch, batch.includes("K1-04") ? "K1-04" : "");
  },
  "calibration-size": data => {
    session.calibration.size = Number(data.get("size"));
    session.calibration.step = "align";
    render();
  }
};

function showFormError(form, message) {
  const alert = form.querySelector("[role=alert]") || document.createElement("p");
  alert.className = "error";
  alert.setAttribute("role", "alert");
  alert.textContent = message;
  if (!alert.parentNode) form.insertBefore(alert, form.lastElementChild);
}

root.addEventListener("click", event => {
  const target = event.target.closest('button[data-action]:not([type="submit"])');
  if (!target || target.disabled || (session.dialog && !target.closest("[role=dialog]"))) return;
  actions[target.dataset.action]?.(target.dataset.value);
});
root.addEventListener("submit", event => {
  const form = event.target;
  if (!form.dataset.form) return;
  event.preventDefault();
  forms[form.dataset.form]?.(new FormData(form), form);
});
root.addEventListener("input", event => {
  const { name, value } = event.target;
  if (session.page === "teaching" && name === "pose") {
    session.teaching.pose = Number(value);
    root.querySelector(".pose-figure").style.setProperty("--pose", value + "deg");
  }
  if (session.page === "teaching" && name === "skill-name") session.teaching.name = value;
  if (session.page === "calibration" && name === "aligned") session.calibration.aligned = event.target.checked;
});
root.addEventListener("change", event => {
  if (event.target.name === "confirm-mode") {
    confirmMode(event.target);
    return;
  }
  if (session.page === "connect" && event.target.name === "network") {
    session.join.network = event.target.value;
    render();
    root.querySelector('[name="network"]')?.focus();
  }
});
root.addEventListener("keydown", event => {
  const dialog = root.querySelector("[role=dialog]");
  if (!dialog) return;
  if (event.key === "Escape") {
    event.preventDefault();
    actions["close-dialog"]();
  }
  if (event.key === "Tab") {
    const controls = [...dialog.querySelectorAll("button:not(:disabled), input, select")];
    const first = controls[0];
    const last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
});
render();
