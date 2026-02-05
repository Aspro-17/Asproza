const SUPABASE_URL = "https://yxoayhodehdspcosrsnp.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_r_cFaw7XbhZMj6fEigHBvg_35uIdNr2";

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const el = (id) => document.getElementById(id);
const loginForm = el("login-form");
const resetBtn = el("reset-password");
const authStatus = el("auth-status");
const appSection = el("app");
const userName = el("user-name");
const userRole = el("user-role");
const logoutBtn = el("logout");
const feedList = el("feed-list");
const mineList = el("mine-list");
const itemForm = el("item-form");
const itemStatus = el("item-status");
const projectForm = el("project-form");
const projectList = el("project-list");
const projectSelect = el("item-project");
const chatList = el("chat-list");
const chatForm = el("chat-form");

let currentUser = null;
let profile = null;

const tabs = document.querySelectorAll(".tab");
const panels = {
  feed: el("tab-feed"),
  mine: el("tab-mine"),
  upload: el("tab-upload"),
  projects: el("tab-projects"),
  chat: el("tab-chat"),
};

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    Object.values(panels).forEach((p) => p.classList.add("hidden"));
    panels[tab.dataset.tab].classList.remove("hidden");
  });
});

async function setAuthUI(user) {
  currentUser = user;
  if (user) {
    appSection.classList.remove("hidden");
    await loadProfile();
    await Promise.all([loadFeed(), loadMine(), loadProjects(), loadChat()]);
  } else {
    appSection.classList.add("hidden");
  }
}

async function loadProfile() {
  const { data, error } = await sb.from("profiles").select("id, full_name, role").eq("id", currentUser.id).single();
  if (error) {
    authStatus.textContent = error.message;
    return;
  }
  profile = data;
  userName.textContent = profile.full_name || "user";
  userRole.textContent = profile.role || "user";
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  authStatus.textContent = "";
  const email = el("email").value.trim();
  const password = el("password").value;
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    authStatus.textContent = error.message;
  }
});

resetBtn.addEventListener("click", async () => {
  const email = el("email").value.trim();
  if (!email) {
    authStatus.textContent = "Enter your email first.";
    return;
  }
  const { error } = await sb.auth.resetPasswordForEmail(email);
  authStatus.textContent = error ? error.message : "Password reset email sent.";
});

logoutBtn.addEventListener("click", async () => {
  await sb.auth.signOut();
});

sb.auth.onAuthStateChange((_event, session) => {
  setAuthUI(session?.user || null);
});

async function loadFeed() {
  const { data, error } = await sb
    .from("items")
    .select("id, title, content, visibility, created_at, media, owner:profiles(full_name)")
    .eq("visibility", "public")
    .order("created_at", { ascending: false })
    .limit(30);

  feedList.innerHTML = "";
  if (error) {
    feedList.textContent = error.message;
    return;
  }
  const nodes = await Promise.all(data.map(renderItem));
  nodes.forEach((node) => feedList.appendChild(node));
}

async function loadMine() {
  const { data, error } = await sb
    .from("items")
    .select("id, title, content, visibility, created_at, media")
    .eq("owner_id", currentUser.id)
    .order("created_at", { ascending: false })
    .limit(30);

  mineList.innerHTML = "";
  if (error) {
    mineList.textContent = error.message;
    return;
  }
  const nodes = await Promise.all(data.map(renderItem));
  nodes.forEach((node) => mineList.appendChild(node));
}

async function loadProjects() {
  const { data, error } = await sb
    .from("projects")
    .select("id, title, created_at")
    .order("created_at", { ascending: false });

  projectList.innerHTML = "";
  projectSelect.innerHTML = "<option value=\"\">No project</option>";
  if (error) {
    projectList.textContent = error.message;
    return;
  }

  data.forEach((project) => {
    const row = document.createElement("div");
    row.className = "list-item";
    row.textContent = project.title;
    projectList.appendChild(row);

    const opt = document.createElement("option");
    opt.value = project.id;
    opt.textContent = project.title;
    projectSelect.appendChild(opt);
  });
}

projectForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = el("project-title").value.trim();
  if (!title) return;
  const { error } = await sb.from("projects").insert({ title, owner_id: currentUser.id });
  if (error) {
    projectList.textContent = error.message;
    return;
  }
  el("project-title").value = "";
  loadProjects();
});

itemForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  itemStatus.textContent = "";

  const title = el("item-title").value.trim();
  const visibility = el("item-visibility").value;
  const projectId = el("item-project").value || null;
  const content = el("item-text").value.trim();
  const file = el("item-file").files[0];
  const tags = el("item-tags").value
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  let media = null;
  if (file) {
    const bucket = visibility === "public" ? "media_public" : "media_private";
    const filePath = `${currentUser.id}/${Date.now()}-${file.name}`;
    const { data, error } = await sb.storage.from(bucket).upload(filePath, file);
    if (error) {
      itemStatus.textContent = error.message;
      return;
    }
    media = {
      bucket,
      path: data.path,
      name: file.name,
      mime: file.type,
      size: file.size,
    };
  }

  const { data: item, error } = await sb
    .from("items")
    .insert({
      title,
      content: content || null,
      media,
      visibility,
      project_id: projectId,
      owner_id: currentUser.id,
    })
    .select("id")
    .single();

  if (error) {
    itemStatus.textContent = error.message;
    return;
  }

  if (tags.length) {
    await attachTags(item.id, tags);
  }

  itemStatus.textContent = "Saved.";
  itemForm.reset();
  loadFeed();
  loadMine();
});

async function attachTags(itemId, tags) {
  const { data: existing } = await sb.from("tags").select("id, name").in("name", tags);
  const existingNames = new Set(existing?.map((t) => t.name));
  const toInsert = tags.filter((t) => !existingNames.has(t)).map((name) => ({ name }));

  if (toInsert.length) {
    await sb.from("tags").insert(toInsert);
  }

  const { data: allTags } = await sb.from("tags").select("id, name").in("name", tags);
  const tagLinks = allTags.map((tag) => ({ item_id: itemId, tag_id: tag.id }));
  if (tagLinks.length) {
    await sb.from("item_tags").insert(tagLinks);
  }
}

async function resolveMediaUrl(media) {
  if (!media?.bucket || !media?.path) return null;
  const { data, error } = await sb.storage.from(media.bucket).createSignedUrl(media.path, 3600);
  if (error) return null;
  return data.signedUrl;
}

async function renderItem(item) {
  const div = document.createElement("div");
  div.className = "list-item";
  const owner = item.owner?.full_name ? ` by ${item.owner.full_name}` : "";
  const meta = new Date(item.created_at).toLocaleString();

  let mediaHtml = "";
  if (item.media?.path) {
    const url = await resolveMediaUrl(item.media);
    if (url) {
      if (item.media.mime?.startsWith("image/")) {
        mediaHtml = `<img src="${url}" alt="${item.media.name}" style="max-width:100%;border-radius:8px;margin-top:8px;" />`;
      } else if (item.media.mime?.startsWith("audio/")) {
        mediaHtml = `<audio controls src="${url}" style="width:100%;margin-top:8px;"></audio>`;
      } else if (item.media.mime?.startsWith("video/")) {
        mediaHtml = `<video controls src="${url}" style="width:100%;margin-top:8px;"></video>`;
      } else {
        mediaHtml = `<a href="${url}" target="_blank">Download ${item.media.name}</a>`;
      }
    }
  }

  div.innerHTML = `
    <strong>${item.title}</strong>
    <div><small>${meta}${owner}</small></div>
    <p>${item.content || ""}</p>
    ${mediaHtml}
  `;
  return div;
}

async function loadChat() {
  const { data, error } = await sb
    .from("messages")
    .select("id, content, created_at, sender:profiles(full_name)")
    .order("created_at", { ascending: true })
    .limit(50);

  chatList.innerHTML = "";
  if (error) {
    chatList.textContent = error.message;
    return;
  }
  data.forEach((m) => appendChat(m));
  chatList.scrollTop = chatList.scrollHeight;
}

chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const content = el("chat-input").value.trim();
  if (!content) return;
  await sb.from("messages").insert({ content, sender_id: currentUser.id });
  el("chat-input").value = "";
});

function appendChat(message) {
  const div = document.createElement("div");
  div.className = "chat-line";
  const name = message.sender?.full_name || "user";
  const time = new Date(message.created_at).toLocaleTimeString();
  div.textContent = `${name} • ${time}: ${message.content}`;
  chatList.appendChild(div);
}

sb.channel("messages")
  .on(
    "postgres_changes",
    { event: "INSERT", schema: "public", table: "messages" },
    (payload) => {
      appendChat(payload.new);
      chatList.scrollTop = chatList.scrollHeight;
    }
  )
  .subscribe();

(async () => {
  const { data } = await sb.auth.getSession();
  setAuthUI(data.session?.user || null);
})();
