const topNav = document.getElementById("topNav");
const sections = document.querySelectorAll(".section-fade");

window.addEventListener("scroll", () => {
  topNav.classList.toggle("scrolled", window.scrollY > 18);
});

const sectionObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
      }
    });
  },
  { threshold: 0.18 }
);

sections.forEach((section) => sectionObserver.observe(section));

const galleryData = [
  {
    src: "https://images.unsplash.com/photo-1499856871958-5b9627545d1a?auto=format&fit=crop&w=1800&q=80",
    title: "Golden Street",
    meta: "Paris · 2024",
  },
  {
    src: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1800&q=80",
    title: "City Breathes",
    meta: "Tokyo · 2026",
  },
  {
    src: "https://images.unsplash.com/photo-1474511320723-9a56873867b5?auto=format&fit=crop&w=1800&q=80",
    title: "Wind over Hills",
    meta: "Iceland · 2023",
  },
  {
    src: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1800&q=80",
    title: "Morning Silence",
    meta: "Kyoto · 2025",
  },
];

const carouselTrack = document.getElementById("carouselTrack");
const dotsWrap = document.getElementById("carouselDots");
const prevBtn = document.querySelector(".carousel-btn.prev");
const nextBtn = document.querySelector(".carousel-btn.next");
const carousel = document.getElementById("carousel");

let current = 0;
let startX = 0;
let isDragging = false;

function buildSlides() {
  galleryData.forEach((item, index) => {
    const slide = document.createElement("article");
    slide.className = "slide";
    slide.innerHTML = `
      <img src="${item.src}" alt="${item.title}">
      <div class="slide-card">
        <h3>${item.title}</h3>
        <p>${item.meta}</p>
      </div>
    `;
    if (index === 0) slide.classList.add("active");
    carouselTrack.appendChild(slide);

    const dot = document.createElement("button");
    dot.type = "button";
    dot.setAttribute("aria-label", `切换到第 ${index + 1} 张`);
    if (index === 0) dot.classList.add("active");
    dot.addEventListener("click", () => goTo(index));
    dotsWrap.appendChild(dot);
  });
}

function updateCarousel() {
  const slides = [...document.querySelectorAll(".slide")];
  const dots = [...dotsWrap.children];
  const gap = 19.2;
  const moveRatio = window.innerWidth <= 640 ? 0.92 : window.innerWidth <= 920 ? 0.88 : 0.8;
  const offset = (carousel.clientWidth * moveRatio + gap) * current;
  carouselTrack.style.transform = `translateX(-${offset}px)`;
  slides.forEach((slide, i) => slide.classList.toggle("active", i === current));
  dots.forEach((dot, i) => dot.classList.toggle("active", i === current));
}

function goTo(index) {
  current = (index + galleryData.length) % galleryData.length;
  updateCarousel();
}

prevBtn.addEventListener("click", () => goTo(current - 1));
nextBtn.addEventListener("click", () => goTo(current + 1));
window.addEventListener("resize", updateCarousel);

carousel.addEventListener("pointerdown", (e) => {
  startX = e.clientX;
  isDragging = true;
});

carousel.addEventListener("pointerup", (e) => {
  if (!isDragging) return;
  const diff = e.clientX - startX;
  if (Math.abs(diff) > 45) {
    goTo(diff < 0 ? current + 1 : current - 1);
  }
  isDragging = false;
});

carousel.addEventListener("pointerleave", () => {
  isDragging = false;
});

buildSlides();
updateCarousel();

const chatHistory = document.getElementById("chatHistory");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const quickPrompts = document.getElementById("quickPrompts");
const sendBtn = chatForm.querySelector(".send-btn");

const conversationHistory = [];
let chatLoading = false;

// 网站相关：三条建议问题 + 同类关键词 → 本地固定回答
// 其余问题 → POST /api/chat（本地 chat.js / 线上 Vercel api/chat）

const quickPromptReplies = {
  "🗺 他去过哪些地方？": "他去过不少城市，喜欢在不同地方体验本地生活方式，并从真实场景里寻找产品灵感。",
  "💼 他是做什么的？": "他是一名产品经理，主要负责需求洞察、产品方案设计、跨团队协作和项目推进落地。",
  "📷 他有哪些爱好？": "他喜欢旅行和摄影，也会持续关注用户行为与产品体验细节。",
};

const aiKnowledge = [
  {
    keys: ["地方", "城市", "去过", "travel", "旅行"],
    answer: quickPromptReplies["🗺 他去过哪些地方？"],
  },
  {
    keys: ["做什么", "职业", "工作", "product", "pm", "产品经理"],
    answer: quickPromptReplies["💼 他是做什么的？"],
  },
  {
    keys: ["爱好", "兴趣", "hobby", "摄影"],
    answer: quickPromptReplies["📷 他有哪些爱好？"],
  },
  {
    keys: ["邮箱", "联系", "email", "mail", "微信", "电话", "手机"],
    answer: "可以通过邮箱联系他：icey66@sina.com，电话 17301302676。",
  },
  {
    keys: ["刘宇", "你是谁", "介绍", "关于你", "关于我"],
    answer:
      "我是刘宇，产品经理，专注用户体验与可落地的产品方案，也喜欢旅行和摄影。",
  },
];

function isSiteRelatedQuestion(message) {
  const trimmed = message.trim();
  if (quickPromptReplies[trimmed]) return true;

  const lower = message.toLowerCase();
  return aiKnowledge.some((item) =>
    item.keys.some((k) => lower.includes(k.toLowerCase()))
  );
}

function getLocalReply(message) {
  const trimmed = message.trim();
  if (quickPromptReplies[trimmed]) return quickPromptReplies[trimmed];

  const lower = message.toLowerCase();
  const hit = aiKnowledge.find((item) =>
    item.keys.some((k) => lower.includes(k.toLowerCase()))
  );
  return hit?.answer ?? null;
}

function appendBubble(role, text) {
  const bubble = document.createElement("div");
  bubble.className = `bubble ${role}`;
  bubble.textContent = text;
  chatHistory.appendChild(bubble);
  chatHistory.scrollTop = chatHistory.scrollHeight;
  return bubble;
}

function appendTyping() {
  const bubble = document.createElement("div");
  bubble.className = "bubble ai";
  bubble.innerHTML =
    '<span class="typing"><span></span><span></span><span></span></span>';
  chatHistory.appendChild(bubble);
  chatHistory.scrollTop = chatHistory.scrollHeight;
  return bubble;
}

function typewriter(target, text, speed = 22) {
  return new Promise((resolve) => {
    let i = 0;
    target.textContent = "";
    const timer = setInterval(() => {
      target.textContent += text.charAt(i);
      i += 1;
      chatHistory.scrollTop = chatHistory.scrollHeight;
      if (i >= text.length) {
        clearInterval(timer);
        resolve();
      }
    }, speed);
  });
}

function setChatLoading(loading) {
  chatLoading = loading;
  chatInput.disabled = loading;
  sendBtn.disabled = loading;
  chatForm.classList.toggle("is-loading", loading);
}

async function fetchAiReply() {
  let response;
  try {
    response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: conversationHistory }),
    });
  } catch {
    throw new Error("无法连接 AI 服务，请稍后重试");
  }

  let data = {};
  try {
    data = await response.json();
  } catch {
    throw new Error("AI 服务返回异常");
  }

  if (!response.ok) {
    throw new Error(data.error || `请求失败（${response.status}）`);
  }

  if (!data.content) throw new Error("模型未返回内容");
  return data.content;
}

async function showAiReply(reply, typingNode, { delay = 0 } = {}) {
  if (delay) await new Promise((r) => setTimeout(r, delay));
  typingNode.remove();
  const bubble = appendBubble("ai", "");
  await typewriter(bubble, reply);
}

async function sendMessage(text) {
  const content = text.trim();
  if (!content || chatLoading) return;

  appendBubble("user", content);
  conversationHistory.push({ role: "user", content });
  quickPrompts.style.display = "none";

  setChatLoading(true);
  const typingNode = appendTyping();

  const localReply = isSiteRelatedQuestion(content) ? getLocalReply(content) : null;

  try {
    if (localReply) {
      conversationHistory.push({ role: "assistant", content: localReply });
      await showAiReply(localReply, typingNode, { delay: 650 });
      return;
    }

    const reply = await fetchAiReply();
    conversationHistory.push({ role: "assistant", content: reply });
    await showAiReply(reply, typingNode);
  } catch (err) {
    typingNode.remove();
    conversationHistory.pop();
    appendBubble(
      "ai",
      err.message || "抱歉，暂时无法连接 AI，请稍后再试。"
    );
  } finally {
    setChatLoading(false);
  }
}

appendBubble("ai", "Hi！有什么想问我的？");

chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const value = chatInput.value;
  chatInput.value = "";
  chatInput.style.height = "44px";
  await sendMessage(value);
});

chatInput.addEventListener("input", () => {
  chatInput.style.height = "44px";
  chatInput.style.height = `${Math.min(chatInput.scrollHeight, 120)}px`;
});

chatInput.addEventListener("keydown", async (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    chatForm.requestSubmit();
  }
});

quickPrompts.addEventListener("click", async (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  await sendMessage(btn.textContent || "");
});

const wechatCard = document.getElementById("wechatCard");
const wechatModal = document.getElementById("wechatModal");
const closeModal = document.getElementById("closeModal");
const modalOverlay = document.getElementById("modalOverlay");

function openModal() {
  wechatModal.classList.add("active");
  wechatModal.setAttribute("aria-hidden", "false");
}

function hideModal() {
  wechatModal.classList.remove("active");
  wechatModal.setAttribute("aria-hidden", "true");
}

wechatCard.addEventListener("click", openModal);
closeModal.addEventListener("click", hideModal);
modalOverlay.addEventListener("click", hideModal);
